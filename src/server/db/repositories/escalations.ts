import "server-only";

import type { Row } from "@libsql/client";
import type { JsonValue } from "../../domain/shared/types";
import { createId, nowIso } from "../../domain/shared/ids";
import { optionalString, parseJson, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface EscalationRecord {
  id: string;
  caseId: string;
  conversationId: string;
  aiRunId: string | null;
  triggerType: "rule" | "ai_validation" | "client_request" | "consultant" | "system_failure";
  reasonCodes: string[];
  reasonText: string;
  handoffSummary: Record<string, JsonValue>;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "assigned" | "resolved" | "cancelled";
  createdAt: string;
}

function mapEscalation(row: Row): EscalationRecord {
  return {
    id: requiredString(row, "id"),
    caseId: requiredString(row, "case_id"),
    conversationId: requiredString(row, "conversation_id"),
    aiRunId: optionalString(row, "ai_run_id"),
    triggerType: requiredString(row, "trigger_type") as EscalationRecord["triggerType"],
    reasonCodes: parseJson<string[]>(row, "reason_codes_json"),
    reasonText: requiredString(row, "reason_text"),
    handoffSummary: parseJson<Record<string, JsonValue>>(row, "handoff_summary_json"),
    severity: requiredString(row, "severity") as EscalationRecord["severity"],
    status: requiredString(row, "status") as EscalationRecord["status"],
    createdAt: requiredString(row, "created_at"),
  };
}

const columns = `
  id, case_id, conversation_id, ai_run_id, trigger_type, reason_codes_json,
  reason_text, handoff_summary_json, severity, status, created_at
`;

export class EscalationsRepository {
  constructor(private readonly database: SqlExecutor) {}

  async findActive(caseId: string): Promise<EscalationRecord | null> {
    const result = await this.database.execute({
      sql: `SELECT ${columns} FROM escalations WHERE case_id = ? AND status IN ('open', 'assigned') LIMIT 1`,
      args: [caseId],
    });
    return result.rows[0] ? mapEscalation(result.rows[0]) : null;
  }

  async createOrUpdateActive(input: {
    caseId: string;
    conversationId: string;
    aiRunId: string | null;
    triggerType: EscalationRecord["triggerType"];
    reasonCodes: string[];
    reasonText: string;
    handoffSummary: Record<string, JsonValue>;
    severity: EscalationRecord["severity"];
  }): Promise<EscalationRecord> {
    const existing = await this.findActive(input.caseId);
    if (existing) {
      const mergedReasonCodes = [...new Set([...existing.reasonCodes, ...input.reasonCodes])];
      await this.database.execute({
        sql: `
          UPDATE escalations
          SET ai_run_id = COALESCE(?, ai_run_id), trigger_type = ?,
              reason_codes_json = ?, reason_text = ?, handoff_summary_json = ?,
              severity = ?
          WHERE id = ? AND status IN ('open', 'assigned')
        `,
        args: [
          input.aiRunId,
          input.triggerType,
          JSON.stringify(mergedReasonCodes),
          input.reasonText,
          JSON.stringify(input.handoffSummary),
          input.severity,
          existing.id,
        ],
      });
      return (await this.findById(existing.id))!;
    }

    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO escalations (
          id, case_id, conversation_id, ai_run_id, trigger_type,
          reason_codes_json, reason_text, handoff_summary_json, severity,
          status, assigned_to_user_id, resolved_by_user_id, resolution_code,
          resolution_note, created_at, assigned_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, NULL, ?, NULL, NULL)
      `,
      args: [
        id,
        input.caseId,
        input.conversationId,
        input.aiRunId,
        input.triggerType,
        JSON.stringify(input.reasonCodes),
        input.reasonText,
        JSON.stringify(input.handoffSummary),
        input.severity,
        nowIso(),
      ],
    });
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<EscalationRecord | null> {
    const result = await this.database.execute({
      sql: `SELECT ${columns} FROM escalations WHERE id = ?`,
      args: [id],
    });
    return result.rows[0] ? mapEscalation(result.rows[0]) : null;
  }
}
