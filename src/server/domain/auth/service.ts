import "server-only";

import { randomInt, timingSafeEqual } from "node:crypto";
import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor, UserActor } from "../../auth/actor";
import type { AuthTokenService } from "../../auth/auth-token";
import type { GuestTokenService } from "../../auth/guest-token";
import { AuthorizationPolicy } from "../../auth/policy";
import type { EmailVerificationProvider } from "../../auth/verification-provider";
import type { AiRuntimeConfig } from "../../config/ai";
import { AuthRepository } from "../../db/repositories/auth";
import { CasesRepository } from "../../db/repositories/cases";
import { ClientsRepository } from "../../db/repositories/clients";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { IntakeRepository } from "../../db/repositories/intake";
import { UsersRepository } from "../../db/repositories/users";
import { withWriteTransaction } from "../../db/transaction";
import { AuditService } from "../audit/service";
import { EscalationsService } from "../escalations/escalateConversation";
import { DomainError } from "../shared/errors";
import { sha256 } from "../shared/hash";
import type { Locale, UserRecord } from "../shared/types";

const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const startVerificationSchema = z.object({
  purpose: z.enum(["claim", "consultations"]),
  email: z.email().trim().transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(200).optional(),
  companyName: z.string().trim().min(1).max(240).optional(),
});

const verifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export interface VerificationStartResult {
  challengeId: string;
  expiresAt: string;
  developmentCode?: string;
}

export interface VerificationResult {
  sessionToken: string;
  sessionExpiresAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
  };
  claim?: {
    caseId: string;
    conversationId: string;
    caseReference: string;
  };
}

function codeMatches(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class AuthService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
    private readonly authTokens: AuthTokenService,
    private readonly verificationProvider: EmailVerificationProvider,
    private readonly runtimeConfig: AiRuntimeConfig,
  ) {}

  async startVerification(actor: Actor, input: unknown): Promise<VerificationStartResult> {
    const data = startVerificationSchema.parse(input);
    if (data.purpose === "claim") {
      if (actor.kind !== "guest") {
        throw new DomainError("UNAUTHENTICATED", "The guest conversation credential is required");
      }
      await new AuthorizationPolicy(this.database, this.guestTokens).requireIntakeAccess(
        actor,
        actor.intakeSessionId,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    const challenge = await withWriteTransaction(this.database, async (transaction) => {
      return new AuthRepository(transaction).createChallenge({
        emailNormalized: data.email,
        codeHash: this.authTokens.hash(code),
        fullName: data.fullName ?? null,
        companyName: data.companyName ?? null,
        purpose: data.purpose,
        guestIntakeSessionId: data.purpose === "claim" && actor.kind === "guest"
          ? actor.intakeSessionId
          : null,
        expiresAt,
      });
    });
    const delivery = await this.verificationProvider.deliverCode({
      email: data.email,
      code,
      purpose: data.purpose,
    });
    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      ...delivery,
    };
  }

  async verify(actor: Actor, input: unknown): Promise<VerificationResult> {
    const data = verifySchema.parse(input);
    const before = await new AuthRepository(this.database).findChallengeById(data.challengeId);
    if (!before) throw new DomainError("NOT_FOUND", "Verification challenge was not found");
    if (new Date(before.expiresAt).getTime() <= Date.now()) {
      throw new DomainError("UNAUTHENTICATED", "Verification challenge expired");
    }
    if (before.attempts >= 10) {
      throw new DomainError("UNAUTHENTICATED", "Verification challenge is locked");
    }
    if (!codeMatches(before.codeHash, this.authTokens.hash(data.code))) {
      await withWriteTransaction(this.database, async (transaction) => {
        await new AuthRepository(transaction).recordFailedAttempt(before.id);
      });
      throw new DomainError("UNAUTHENTICATED", "Verification code is invalid");
    }
    if (
      before.purpose === "claim" &&
      before.consumedAt === null &&
      (actor.kind !== "guest" || actor.intakeSessionId !== before.guestIntakeSessionId)
    ) {
      throw new DomainError("UNAUTHENTICATED", "The original guest credential is required to claim this conversation");
    }
    if (before.consumedAt !== null) {
      if (actor.kind !== "user") {
        throw new DomainError("UNAUTHENTICATED", "Verification challenge was already used");
      }
      if (actor.userId !== before.verifiedUserId) {
        throw new DomainError("FORBIDDEN", "This verification belongs to another user");
      }
    }

    const verified = await withWriteTransaction(this.database, async (transaction) => {
      const auth = new AuthRepository(transaction);
      const users = new UsersRepository(transaction);
      const clients = new ClientsRepository(transaction);
      const cases = new CasesRepository(transaction);
      const intakes = new IntakeRepository(transaction);
      const conversations = new ConversationsRepository(transaction);
      const challenge = await auth.findChallengeById(data.challengeId);
      if (!challenge) throw new DomainError("NOT_FOUND", "Verification challenge was not found");

      let user: UserRecord;
      if (challenge.verifiedUserId) {
        const existingVerified = await users.findById(challenge.verifiedUserId);
        if (!existingVerified) throw new DomainError("INVALID_STATE", "Verified user was not found");
        user = existingVerified;
      } else {
        const existing = await users.findByEmail(challenge.emailNormalized);
        const displayName = challenge.fullName ?? existing?.displayName ?? challenge.emailNormalized.split("@")[0]!;
        if (existing) {
          if (existing.globalRole !== "client" || existing.status === "suspended") {
            throw new DomainError("FORBIDDEN", "This email is not eligible for client access");
          }
          user = await users.markEmailVerified({ userId: existing.id, displayName });
        } else {
          user = await users.create({
            authSubject: `verified-email:${sha256(challenge.emailNormalized)}`,
            email: challenge.emailNormalized,
            displayName,
            globalRole: "client",
            locale: "en" satisfies Locale,
            status: "active",
            emailVerifiedAt: new Date().toISOString(),
          });
        }
      }

      let claim: VerificationResult["claim"];
      if (challenge.purpose === "claim") {
        if (!challenge.guestIntakeSessionId) {
          throw new DomainError("INVALID_STATE", "Claim challenge has no guest session");
        }
        const intake = await intakes.findSessionById(challenge.guestIntakeSessionId);
        if (!intake) throw new DomainError("NOT_FOUND", "Guest session was not found");
        if (intake.status === "claimed" && intake.ownerUserId !== user.id) {
          throw new DomainError("CONFLICT", "Guest conversation is already claimed");
        }
        if (intake.status !== "submitted" && intake.status !== "claimed") {
          throw new DomainError("INVALID_STATE", "Guest conversation cannot be claimed");
        }
        const caseRecord = await cases.findCaseByIntakeSession(intake.id);
        if (!caseRecord) throw new DomainError("NOT_FOUND", "Guest case was not found");
        if (caseRecord.createdByUserId && caseRecord.createdByUserId !== user.id) {
          throw new DomainError("CONFLICT", "Case is already owned by another user");
        }

        let account = caseRecord.clientAccountId
          ? await clients.findAccountById(caseRecord.clientAccountId)
          : null;
        if (!account) {
          const accountType = challenge.companyName ? "company" as const : "individual" as const;
          const accountName = challenge.companyName ?? user.displayName;
          account = await clients.findReusableAccountForUser({
            userId: user.id,
            accountType,
            displayName: accountName,
          });
          if (!account) {
            account = await clients.createAccount({
              accountType,
              legalName: accountName,
              displayName: accountName,
              countryCode: "ID",
              preferredLocale: user.locale,
              createdByUserId: user.id,
            });
          }
        }
        await clients.addMember({
          clientAccountId: account.id,
          userId: user.id,
          membershipRole: "owner",
          invitedByUserId: user.id,
        });
        const claimedCase = await cases.claimGuestCase({
          caseId: caseRecord.id,
          userId: user.id,
          clientAccountId: account.id,
        });
        const member = await cases.upsertMember({
          caseId: claimedCase.id,
          userId: user.id,
          caseRole: "client_owner",
          addedByUserId: user.id,
          reason: "guest_conversation_claim",
        });
        await intakes.claimSubmittedSession(intake.id, user.id);
        const conversation = await conversations.findConversationByChannel(claimedCase.id, "client");
        if (!conversation) throw new DomainError("INVALID_STATE", "Client conversation is missing");
        const userActor: UserActor = { kind: "user", userId: user.id, requestId: actor.requestId };
        const audit = new AuditService(transaction);
        await audit.write(userActor, {
          caseId: claimedCase.id,
          eventType: "conversation.claimed",
          targetType: "conversation",
          targetId: conversation.id,
          changedFields: ["client_account_id", "created_by_user_id", "owner_user_id", "guest_token_hash"],
        });
        await audit.write(userActor, {
          caseId: claimedCase.id,
          eventType: "case.member_assigned",
          targetType: "case_member",
          targetId: member.id,
          reasonCode: "guest_conversation_claim",
          changedFields: ["case_role"],
        });
        claim = {
          caseId: claimedCase.id,
          conversationId: conversation.id,
          caseReference: claimedCase.caseReference,
        };
      }

      await auth.consumeChallenge(challenge.id, user.id);
      const issued = this.authTokens.issue();
      const sessionExpiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
      await auth.createSession({
        tokenHash: issued.hash,
        userId: user.id,
        expiresAt: sessionExpiresAt,
      });
      return { user, claim, sessionToken: issued.token, sessionExpiresAt };
    });

    if (verified.claim) {
      const userActor: UserActor = {
        kind: "user",
        userId: verified.user.id,
        requestId: actor.requestId,
      };
      await new EscalationsService(
        this.database,
        this.guestTokens,
        this.runtimeConfig,
      ).escalateConversation(userActor, {
        caseId: verified.claim.caseId,
        conversationId: verified.claim.conversationId,
        reason: "Client requested a Meridian expert after the assistant conversation.",
        reasonCodes: ["user_requested_human"],
      });
    }

    return {
      sessionToken: verified.sessionToken,
      sessionExpiresAt: verified.sessionExpiresAt,
      user: {
        id: verified.user.id,
        displayName: verified.user.displayName,
        email: verified.user.emailNormalized,
      },
      ...(verified.claim ? { claim: verified.claim } : {}),
    };
  }
}
