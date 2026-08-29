import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import type {
  CaseMemberRecord,
  CaseRecord,
  CaseRole,
  CaseStatus,
  RiskLevel,
} from "../../domain/shared/types";
import {
  optionalString,
  parseJson,
  requiredNumber,
  requiredString,
} from "../row";
import type { SqlExecutor } from "../types";

export interface CreateCaseInput {
  caseReference: string;
  intakeSessionId: string;
  clientAccountId: string | null;
  createdByUserId: string | null;
  submissionIdempotencyKey: string;
  title: string;
  primaryJurisdiction: string;
  taxTopics: string[];
  taxPeriodStart: string | null;
  taxPeriodEnd: string | null;
}

export interface UpsertCaseMemberInput {
  caseId: string;
  userId: string;
  caseRole: CaseRole;
  addedByUserId: string;
  reason: string;
}

export interface UpdateCaseStatusInput {
  id: string;
  expectedVersion: number;
  toStatus: CaseStatus;
  resolutionCode: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

function mapCase(row: Row): CaseRecord {
  return {
    id: requiredString(row, "id"),
    caseReference: requiredString(row, "case_reference"),
    intakeSessionId: requiredString(row, "intake_session_id"),
    clientAccountId: optionalString(row, "client_account_id"),
    createdByUserId: optionalString(row, "created_by_user_id"),
    submissionIdempotencyKey: requiredString(row, "submission_idempotency_key"),
    title: requiredString(row, "title"),
    primaryJurisdiction: requiredString(row, "primary_jurisdiction"),
    taxTopics: parseJson<string[]>(row, "tax_topics_json"),
    taxPeriodStart: optionalString(row, "tax_period_start"),
    taxPeriodEnd: optionalString(row, "tax_period_end"),
    status: requiredString(row, "status") as CaseStatus,
    riskLevel: requiredString(row, "risk_level") as RiskLevel,
    resolutionCode: optionalString(row, "resolution_code"),
    resolutionNote: optionalString(row, "resolution_note"),
    rowVersion: requiredNumber(row, "row_version"),
    receivedAt: requiredString(row, "received_at"),
    resolvedAt: optionalString(row, "resolved_at"),
    closedAt: optionalString(row, "closed_at"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

function mapCaseMember(row: Row): CaseMemberRecord {
  return {
    id: requiredString(row, "id"),
    caseId: requiredString(row, "case_id"),
    userId: requiredString(row, "user_id"),
    caseRole: requiredString(row, "case_role") as CaseRole,
    addedByUserId: requiredString(row, "added_by_user_id"),
    reason: requiredString(row, "reason"),
    createdAt: requiredString(row, "created_at"),
    removedAt: optionalString(row, "removed_at"),
  };
}

const caseColumns = `
  id, case_reference, intake_session_id, client_account_id, created_by_user_id,
  submission_idempotency_key, title, primary_jurisdiction, tax_topics_json,
  tax_period_start, tax_period_end, status, risk_level, resolution_code,
  resolution_note, row_version, received_at, resolved_at, closed_at,
  created_at, updated_at
`;

export class CasesRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createCase(input: CreateCaseInput): Promise<CaseRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO cases (
          id, case_reference, intake_session_id, client_account_id,
          created_by_user_id, submission_idempotency_key, title,
          primary_jurisdiction, tax_topics_json, tax_period_start,
          tax_period_end, status, risk_level, resolution_code, resolution_note,
          row_version, received_at, resolved_at, closed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', 'unknown',
                  NULL, NULL, 1, ?, NULL, NULL, ?, ?)
      `,
      args: [
        id,
        input.caseReference,
        input.intakeSessionId,
        input.clientAccountId,
        input.createdByUserId,
        input.submissionIdempotencyKey,
        input.title,
        input.primaryJurisdiction,
        JSON.stringify(input.taxTopics),
        input.taxPeriodStart,
        input.taxPeriodEnd,
        timestamp,
        timestamp,
        timestamp,
      ],
    });
    return (await this.findCaseById(id))!;
  }

  async findCaseById(id: string): Promise<CaseRecord | null> {
    const result = await this.database.execute({
      sql: `SELECT ${caseColumns} FROM cases WHERE id = ?`,
      args: [id],
    });
    return result.rows[0] ? mapCase(result.rows[0]) : null;
  }

  async findCaseByIntakeSession(intakeSessionId: string): Promise<CaseRecord | null> {
    const result = await this.database.execute({
      sql: `SELECT ${caseColumns} FROM cases WHERE intake_session_id = ?`,
      args: [intakeSessionId],
    });
    return result.rows[0] ? mapCase(result.rows[0]) : null;
  }

  async upsertMember(input: UpsertCaseMemberInput): Promise<CaseMemberRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO case_members (
          id, case_id, user_id, case_role, added_by_user_id, reason,
          created_at, removed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(case_id, user_id) DO UPDATE SET
          case_role = excluded.case_role,
          added_by_user_id = excluded.added_by_user_id,
          reason = excluded.reason,
          created_at = excluded.created_at,
          removed_at = NULL
      `,
      args: [
        id,
        input.caseId,
        input.userId,
        input.caseRole,
        input.addedByUserId,
        input.reason,
        timestamp,
      ],
    });
    return (await this.findActiveMembership(input.caseId, input.userId))!;
  }

  async findActiveMembership(
    caseId: string,
    userId: string,
  ): Promise<CaseMemberRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, user_id, case_role, added_by_user_id, reason,
               created_at, removed_at
        FROM case_members
        WHERE case_id = ? AND user_id = ? AND removed_at IS NULL
      `,
      args: [caseId, userId],
    });
    return result.rows[0] ? mapCaseMember(result.rows[0]) : null;
  }

  async updateStatus(input: UpdateCaseStatusInput): Promise<boolean> {
    const result = await this.database.execute({
      sql: `
        UPDATE cases
        SET status = ?, resolution_code = ?, resolution_note = ?,
            resolved_at = ?, closed_at = ?, row_version = row_version + 1,
            updated_at = ?
        WHERE id = ? AND row_version = ?
      `,
      args: [
        input.toStatus,
        input.resolutionCode,
        input.resolutionNote,
        input.resolvedAt,
        input.closedAt,
        nowIso(),
        input.id,
        input.expectedVersion,
      ],
    });
    return result.rowsAffected === 1;
  }
}
