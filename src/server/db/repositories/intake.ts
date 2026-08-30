import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import type {
  DataClassification,
  IntakeAnswerRecord,
  IntakeSessionRecord,
  IntakeStatus,
  JsonValue,
  Locale,
} from "../../domain/shared/types";
import {
  optionalString,
  parseJson,
  requiredNumber,
  requiredString,
} from "../row";
import type { SqlExecutor } from "../types";

export interface CreateIntakeSessionInput {
  ownerUserId: string | null;
  guestTokenHash: string | null;
  intakeSchemaVersion: string;
  locale: Locale;
  expiresAt: string | null;
}

export interface SaveIntakeAnswerInput {
  intakeSessionId: string;
  questionKey: string;
  questionVersion: string;
  answer: JsonValue;
  dataClassification: DataClassification;
}

function mapSession(row: Row): IntakeSessionRecord {
  return {
    id: requiredString(row, "id"),
    ownerUserId: optionalString(row, "owner_user_id"),
    guestTokenHash: optionalString(row, "guest_token_hash"),
    intakeSchemaVersion: requiredString(row, "intake_schema_version"),
    locale: requiredString(row, "locale") as Locale,
    status: requiredString(row, "status") as IntakeStatus,
    expiresAt: optionalString(row, "expires_at"),
    submittedAt: optionalString(row, "submitted_at"),
    rowVersion: requiredNumber(row, "row_version"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

function mapAnswer(row: Row): IntakeAnswerRecord {
  return {
    id: requiredString(row, "id"),
    intakeSessionId: requiredString(row, "intake_session_id"),
    questionKey: requiredString(row, "question_key"),
    questionVersion: requiredString(row, "question_version"),
    answer: parseJson<JsonValue>(row, "answer_json"),
    dataClassification: requiredString(
      row,
      "data_classification",
    ) as DataClassification,
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

export class IntakeRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createSession(input: CreateIntakeSessionInput): Promise<IntakeSessionRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO intake_sessions (
          id, owner_user_id, guest_token_hash, intake_schema_version, locale,
          status, expires_at, submitted_at, row_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, 1, ?, ?)
      `,
      args: [
        id,
        input.ownerUserId,
        input.guestTokenHash,
        input.intakeSchemaVersion,
        input.locale,
        input.expiresAt,
        timestamp,
        timestamp,
      ],
    });
    return (await this.findSessionById(id))!;
  }

  async findSessionById(id: string): Promise<IntakeSessionRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, owner_user_id, guest_token_hash, intake_schema_version, locale,
               status, expires_at, submitted_at, row_version, created_at, updated_at
        FROM intake_sessions
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async findSessionByGuestTokenHash(hash: string): Promise<IntakeSessionRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, owner_user_id, guest_token_hash, intake_schema_version, locale,
               status, expires_at, submitted_at, row_version, created_at, updated_at
        FROM intake_sessions
        WHERE guest_token_hash = ?
        LIMIT 1
      `,
      args: [hash],
    });
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async saveAnswer(input: SaveIntakeAnswerInput): Promise<IntakeAnswerRecord> {
    const existing = await this.findAnswer(input.intakeSessionId, input.questionKey);
    const id = existing?.id ?? createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO intake_answers (
          id, intake_session_id, question_key, question_version, answer_json,
          data_classification, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(intake_session_id, question_key) DO UPDATE SET
          question_version = excluded.question_version,
          answer_json = excluded.answer_json,
          data_classification = excluded.data_classification,
          updated_at = excluded.updated_at
      `,
      args: [
        id,
        input.intakeSessionId,
        input.questionKey,
        input.questionVersion,
        JSON.stringify(input.answer),
        input.dataClassification,
        timestamp,
        timestamp,
      ],
    });
    return (await this.findAnswer(input.intakeSessionId, input.questionKey))!;
  }

  async findAnswer(
    intakeSessionId: string,
    questionKey: string,
  ): Promise<IntakeAnswerRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, intake_session_id, question_key, question_version, answer_json,
               data_classification, created_at, updated_at
        FROM intake_answers
        WHERE intake_session_id = ? AND question_key = ?
      `,
      args: [intakeSessionId, questionKey],
    });
    return result.rows[0] ? mapAnswer(result.rows[0]) : null;
  }

  async listAnswers(intakeSessionId: string): Promise<IntakeAnswerRecord[]> {
    const result = await this.database.execute({
      sql: `
        SELECT id, intake_session_id, question_key, question_version, answer_json,
               data_classification, created_at, updated_at
        FROM intake_answers
        WHERE intake_session_id = ?
        ORDER BY question_key
      `,
      args: [intakeSessionId],
    });
    return result.rows.map(mapAnswer);
  }

  async advanceDraftVersion(id: string, expectedVersion: number): Promise<boolean> {
    const result = await this.database.execute({
      sql: `
        UPDATE intake_sessions
        SET row_version = row_version + 1, updated_at = ?
        WHERE id = ? AND status = 'draft' AND row_version = ?
      `,
      args: [nowIso(), id, expectedVersion],
    });
    return result.rowsAffected === 1;
  }

  async markSubmitted(id: string, expectedVersion: number): Promise<boolean> {
    const timestamp = nowIso();
    const result = await this.database.execute({
      sql: `
        UPDATE intake_sessions
        SET status = 'submitted', submitted_at = ?, updated_at = ?,
            row_version = row_version + 1
        WHERE id = ? AND status = 'draft' AND row_version = ?
      `,
      args: [timestamp, timestamp, id, expectedVersion],
    });
    return result.rowsAffected === 1;
  }

  async claimSubmittedSession(id: string, userId: string): Promise<IntakeSessionRecord> {
    const timestamp = nowIso();
    const result = await this.database.execute({
      sql: `
        UPDATE intake_sessions
        SET owner_user_id = ?, guest_token_hash = NULL, expires_at = NULL,
            status = 'claimed', row_version = row_version + 1, updated_at = ?
        WHERE id = ?
          AND status = 'submitted'
          AND owner_user_id IS NULL
          AND guest_token_hash IS NOT NULL
      `,
      args: [userId, timestamp, id],
    });
    const session = await this.findSessionById(id);
    if (!session) throw new Error("Claimed intake session disappeared");
    if (result.rowsAffected === 0 && !(session.status === "claimed" && session.ownerUserId === userId)) {
      throw new Error("Intake session cannot be claimed by this user");
    }
    return session;
  }
}
