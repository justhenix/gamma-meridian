import "server-only";

import { randomInt, timingSafeEqual } from "node:crypto";
import type { Client } from "@libsql/client";
import { z } from "zod";

import type { AuthTokenService } from "../../auth/auth-token";
import type { EmailVerificationProvider } from "../../auth/verification-provider";
import { AuthRepository } from "../../db/repositories/auth";
import { StaffAuthRepository } from "../../db/repositories/staff-auth";
import { UsersRepository } from "../../db/repositories/users";
import { withWriteTransaction } from "../../db/transaction";
import { DomainError } from "../shared/errors";
import { sha256 } from "../shared/hash";

const STAFF_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const startSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
});

const verifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

function codeMatches(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class StaffAuthService {
  private readonly allowedEmails: ReadonlySet<string>;

  constructor(
    private readonly database: Client,
    private readonly authTokens: AuthTokenService,
    private readonly verificationProvider: EmailVerificationProvider,
    allowedEmails: ReadonlySet<string>,
  ) {
    this.allowedEmails = new Set(
      [...allowedEmails].map((email) => email.trim().toLowerCase()).filter(Boolean),
    );
  }

  async startVerification(input: unknown): Promise<{
    challengeId: string;
    expiresAt: string;
    developmentCode?: string;
  }> {
    const data = startSchema.parse(input);
    if (!this.allowedEmails.has(data.email)) {
      throw new DomainError("FORBIDDEN", "This email is not authorized for Meridian staff access");
    }

    const existing = await new UsersRepository(this.database).findByEmail(data.email);
    if (
      existing &&
      (existing.status !== "active" || !["consultant", "admin"].includes(existing.globalRole))
    ) {
      throw new DomainError("FORBIDDEN", "This email is not eligible for Meridian staff access");
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + STAFF_VERIFICATION_TTL_MS).toISOString();
    const challenge = await new StaffAuthRepository(this.database).createChallenge({
      emailNormalized: data.email,
      codeHash: this.authTokens.hash(code),
      expiresAt,
    });
    const delivery = await this.verificationProvider.deliverCode({
      email: data.email,
      code,
      purpose: "staff_login",
    });
    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      ...delivery,
    };
  }

  async verify(input: unknown): Promise<{
    sessionToken: string;
    sessionExpiresAt: string;
    user: { displayName: string; email: string; role: "consultant" | "admin" };
  }> {
    const data = verifySchema.parse(input);
    const before = await new StaffAuthRepository(this.database).findChallengeById(data.challengeId);
    if (!before) throw new DomainError("NOT_FOUND", "Staff verification challenge was not found");
    if (before.consumedAt !== null) {
      throw new DomainError("UNAUTHENTICATED", "Staff verification challenge was already used");
    }
    if (new Date(before.expiresAt).getTime() <= Date.now()) {
      throw new DomainError("UNAUTHENTICATED", "Staff verification challenge expired");
    }
    if (before.attempts >= 10) {
      throw new DomainError("UNAUTHENTICATED", "Staff verification challenge is locked");
    }
    if (!codeMatches(before.codeHash, this.authTokens.hash(data.code))) {
      await new StaffAuthRepository(this.database).recordFailedAttempt(before.id);
      throw new DomainError("UNAUTHENTICATED", "Verification code is invalid");
    }
    if (!this.allowedEmails.has(before.emailNormalized)) {
      throw new DomainError("FORBIDDEN", "This email is no longer authorized for Meridian staff access");
    }

    return withWriteTransaction(this.database, async (transaction) => {
      const staffAuth = new StaffAuthRepository(transaction);
      const users = new UsersRepository(transaction);
      const auth = new AuthRepository(transaction);
      const challenge = await staffAuth.findChallengeById(data.challengeId);
      if (!challenge) throw new DomainError("NOT_FOUND", "Staff verification challenge was not found");
      if (challenge.consumedAt !== null) {
        throw new DomainError("UNAUTHENTICATED", "Staff verification challenge was already used");
      }

      let user = await users.findByEmail(challenge.emailNormalized);
      if (user) {
        if (user.status !== "active" || !["consultant", "admin"].includes(user.globalRole)) {
          throw new DomainError("FORBIDDEN", "This email is not eligible for Meridian staff access");
        }
      } else {
        user = await users.create({
          authSubject: `verified-staff-email:${sha256(challenge.emailNormalized)}`,
          email: challenge.emailNormalized,
          displayName: challenge.emailNormalized.split("@")[0]!,
          globalRole: "consultant",
          locale: "en",
          status: "active",
          emailVerifiedAt: new Date().toISOString(),
        });
      }

      await staffAuth.consumeChallenge(challenge.id, user.id);
      const issued = this.authTokens.issue();
      const sessionExpiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
      await auth.createSession({
        tokenHash: issued.hash,
        userId: user.id,
        expiresAt: sessionExpiresAt,
      });

      return {
        sessionToken: issued.token,
        sessionExpiresAt,
        user: {
          displayName: user.displayName,
          email: user.emailNormalized,
          role: user.globalRole as "consultant" | "admin",
        },
      };
    });
  }
}
