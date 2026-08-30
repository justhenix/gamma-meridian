import "server-only";

import type { Row } from "@libsql/client";

import type { VerificationPurpose } from "../../auth/verification-provider";
import { createId, nowIso } from "../../domain/shared/ids";
import { optionalString, requiredNumber, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface AuthVerificationChallengeRecord {
  id: string;
  emailNormalized: string;
  codeHash: string;
  fullName: string | null;
  companyName: string | null;
  purpose: VerificationPurpose;
  guestIntakeSessionId: string | null;
  verifiedUserId: string | null;
  expiresAt: string;
  consumedAt: string | null;
  attempts: number;
  createdAt: string;
}

export interface AuthSessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

function mapChallenge(row: Row): AuthVerificationChallengeRecord {
  return {
    id: requiredString(row, "id"),
    emailNormalized: requiredString(row, "email_normalized"),
    codeHash: requiredString(row, "code_hash"),
    fullName: optionalString(row, "full_name"),
    companyName: optionalString(row, "company_name"),
    purpose: requiredString(row, "purpose") as VerificationPurpose,
    guestIntakeSessionId: optionalString(row, "guest_intake_session_id"),
    verifiedUserId: optionalString(row, "verified_user_id"),
    expiresAt: requiredString(row, "expires_at"),
    consumedAt: optionalString(row, "consumed_at"),
    attempts: requiredNumber(row, "attempts"),
    createdAt: requiredString(row, "created_at"),
  };
}

function mapSession(row: Row): AuthSessionRecord {
  return {
    id: requiredString(row, "id"),
    tokenHash: requiredString(row, "token_hash"),
    userId: requiredString(row, "user_id"),
    expiresAt: requiredString(row, "expires_at"),
    createdAt: requiredString(row, "created_at"),
    revokedAt: optionalString(row, "revoked_at"),
  };
}

export class AuthRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createChallenge(input: {
    emailNormalized: string;
    codeHash: string;
    fullName: string | null;
    companyName: string | null;
    purpose: VerificationPurpose;
    guestIntakeSessionId: string | null;
    expiresAt: string;
  }): Promise<AuthVerificationChallengeRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO auth_verification_challenges (
          id, email_normalized, code_hash, full_name, company_name, purpose,
          guest_intake_session_id, verified_user_id, expires_at, consumed_at,
          attempts, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 0, ?)
      `,
      args: [
        id,
        input.emailNormalized,
        input.codeHash,
        input.fullName,
        input.companyName,
        input.purpose,
        input.guestIntakeSessionId,
        input.expiresAt,
        nowIso(),
      ],
    });
    return (await this.findChallengeById(id))!;
  }

  async findChallengeById(id: string): Promise<AuthVerificationChallengeRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, email_normalized, code_hash, full_name, company_name, purpose,
               guest_intake_session_id, verified_user_id, expires_at, consumed_at,
               attempts, created_at
        FROM auth_verification_challenges
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapChallenge(result.rows[0]) : null;
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.database.execute({
      sql: `
        UPDATE auth_verification_challenges
        SET attempts = attempts + 1
        WHERE id = ? AND consumed_at IS NULL AND attempts < 10
      `,
      args: [id],
    });
  }

  async consumeChallenge(id: string, userId: string): Promise<AuthVerificationChallengeRecord> {
    await this.database.execute({
      sql: `
        UPDATE auth_verification_challenges
        SET verified_user_id = ?, consumed_at = COALESCE(consumed_at, ?)
        WHERE id = ? AND (verified_user_id IS NULL OR verified_user_id = ?)
      `,
      args: [userId, nowIso(), id, userId],
    });
    const challenge = await this.findChallengeById(id);
    if (!challenge || challenge.verifiedUserId !== userId) {
      throw new Error("Verification challenge consumption conflict");
    }
    return challenge;
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: string;
  }): Promise<AuthSessionRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO auth_sessions (
          id, token_hash, user_id, expires_at, created_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, NULL)
      `,
      args: [id, input.tokenHash, input.userId, input.expiresAt, nowIso()],
    });
    return (await this.findSessionByTokenHash(input.tokenHash))!;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, token_hash, user_id, expires_at, created_at, revoked_at
        FROM auth_sessions
        WHERE token_hash = ?
        LIMIT 1
      `,
      args: [tokenHash],
    });
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.database.execute({
      sql: `
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, ?)
        WHERE token_hash = ?
      `,
      args: [nowIso(), tokenHash],
    });
  }
}
