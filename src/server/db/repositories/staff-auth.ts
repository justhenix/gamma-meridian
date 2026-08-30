import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import { optionalString, requiredNumber, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface StaffAuthVerificationChallengeRecord {
  id: string;
  emailNormalized: string;
  codeHash: string;
  verifiedUserId: string | null;
  expiresAt: string;
  consumedAt: string | null;
  attempts: number;
  createdAt: string;
}

function mapChallenge(row: Row): StaffAuthVerificationChallengeRecord {
  return {
    id: requiredString(row, "id"),
    emailNormalized: requiredString(row, "email_normalized"),
    codeHash: requiredString(row, "code_hash"),
    verifiedUserId: optionalString(row, "verified_user_id"),
    expiresAt: requiredString(row, "expires_at"),
    consumedAt: optionalString(row, "consumed_at"),
    attempts: requiredNumber(row, "attempts"),
    createdAt: requiredString(row, "created_at"),
  };
}

export class StaffAuthRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createChallenge(input: {
    emailNormalized: string;
    codeHash: string;
    expiresAt: string;
  }): Promise<StaffAuthVerificationChallengeRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO staff_auth_verification_challenges (
          id, email_normalized, code_hash, verified_user_id, expires_at,
          consumed_at, attempts, created_at
        ) VALUES (?, ?, ?, NULL, ?, NULL, 0, ?)
      `,
      args: [id, input.emailNormalized, input.codeHash, input.expiresAt, nowIso()],
    });
    return (await this.findChallengeById(id))!;
  }

  async findChallengeById(id: string): Promise<StaffAuthVerificationChallengeRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, email_normalized, code_hash, verified_user_id, expires_at,
               consumed_at, attempts, created_at
        FROM staff_auth_verification_challenges
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapChallenge(result.rows[0]) : null;
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.database.execute({
      sql: `
        UPDATE staff_auth_verification_challenges
        SET attempts = attempts + 1
        WHERE id = ? AND consumed_at IS NULL AND attempts < 10
      `,
      args: [id],
    });
  }

  async consumeChallenge(id: string, userId: string): Promise<StaffAuthVerificationChallengeRecord> {
    await this.database.execute({
      sql: `
        UPDATE staff_auth_verification_challenges
        SET verified_user_id = ?, consumed_at = COALESCE(consumed_at, ?)
        WHERE id = ? AND (verified_user_id IS NULL OR verified_user_id = ?)
      `,
      args: [userId, nowIso(), id, userId],
    });
    const challenge = await this.findChallengeById(id);
    if (!challenge || challenge.verifiedUserId !== userId) {
      throw new Error("Staff verification challenge consumption conflict");
    }
    return challenge;
  }
}
