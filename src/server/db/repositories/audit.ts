import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import type {
  AuditEventRecord,
  JsonValue,
} from "../../domain/shared/types";
import { optionalString, parseJson, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface AppendAuditEventInput {
  caseId: string | null;
  actorType: "user" | "guest" | "system";
  actorUserId: string | null;
  actorReferenceId: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  requestId: string;
  reasonCode?: string | null;
  changedFields?: string[];
  metadata?: Record<string, JsonValue>;
}

function mapAuditEvent(row: Row): AuditEventRecord {
  return {
    id: requiredString(row, "id"),
    caseId: optionalString(row, "case_id"),
    actorType: requiredString(row, "actor_type") as "user" | "guest" | "system",
    actorUserId: optionalString(row, "actor_user_id"),
    actorReferenceId: optionalString(row, "actor_reference_id"),
    eventType: requiredString(row, "event_type"),
    targetType: requiredString(row, "target_type"),
    targetId: requiredString(row, "target_id"),
    requestId: requiredString(row, "request_id"),
    reasonCode: optionalString(row, "reason_code"),
    changedFields: parseJson<string[]>(row, "changed_fields_json"),
    metadata: parseJson<Record<string, JsonValue>>(row, "metadata_json"),
    createdAt: requiredString(row, "created_at"),
  };
}

export class AuditRepository {
  constructor(private readonly database: SqlExecutor) {}

  async append(input: AppendAuditEventInput): Promise<AuditEventRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO audit_events (
          id, case_id, actor_type, actor_user_id, actor_reference_id,
          event_type, target_type, target_id, request_id, reason_code,
          changed_fields_json, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        input.caseId,
        input.actorType,
        input.actorUserId,
        input.actorReferenceId,
        input.eventType,
        input.targetType,
        input.targetId,
        input.requestId,
        input.reasonCode ?? null,
        JSON.stringify(input.changedFields ?? []),
        JSON.stringify(input.metadata ?? {}),
        nowIso(),
      ],
    });
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<AuditEventRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, actor_type, actor_user_id, actor_reference_id,
               event_type, target_type, target_id, request_id, reason_code,
               changed_fields_json, metadata_json, created_at
        FROM audit_events
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapAuditEvent(result.rows[0]) : null;
  }

  async listByCase(caseId: string): Promise<AuditEventRecord[]> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, actor_type, actor_user_id, actor_reference_id,
               event_type, target_type, target_id, request_id, reason_code,
               changed_fields_json, metadata_json, created_at
        FROM audit_events
        WHERE case_id = ?
        ORDER BY created_at, id
      `,
      args: [caseId],
    });
    return result.rows.map(mapAuditEvent);
  }
}
