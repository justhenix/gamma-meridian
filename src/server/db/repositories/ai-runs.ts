import "server-only";

import type { Row } from "@libsql/client";
import type { AiRunRecord, AiRunStatus } from "../../domain/ai/types";
import type { RetrievedRegulatorySection } from "../../domain/regulations/types";
import { createId, nowIso } from "../../domain/shared/ids";
import {
  optionalString,
  parseJson,
  requiredString,
} from "../row";
import type { SqlExecutor } from "../types";

function optionalNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "number") throw new Error(`Database column ${key} is not nullable number`);
  return value;
}

function mapRun(row: Row): AiRunRecord {
  return {
    id: requiredString(row, "id"),
    caseId: requiredString(row, "case_id"),
    conversationId: requiredString(row, "conversation_id"),
    purpose: requiredString(row, "purpose") as AiRunRecord["purpose"],
    triggerType: requiredString(row, "trigger_type"),
    triggerId: requiredString(row, "trigger_id"),
    requestedByUserId: optionalString(row, "requested_by_user_id"),
    status: requiredString(row, "status") as AiRunStatus,
    provider: requiredString(row, "provider"),
    model: requiredString(row, "model"),
    providerRequestId: optionalString(row, "provider_request_id"),
    promptKey: requiredString(row, "prompt_key"),
    promptVersion: requiredString(row, "prompt_version"),
    rulesetVersion: requiredString(row, "ruleset_version"),
    inputSnapshot: parseJson<unknown>(row, "input_snapshot_json"),
    inputSha256: requiredString(row, "input_sha256"),
    output: row.output_json === null ? null : parseJson<unknown>(row, "output_json"),
    outputSha256: optionalString(row, "output_sha256"),
    inputTokens: optionalNumber(row, "input_tokens"),
    outputTokens: optionalNumber(row, "output_tokens"),
    latencyMs: optionalNumber(row, "latency_ms"),
    errorCode: optionalString(row, "error_code"),
    idempotencyKey: requiredString(row, "idempotency_key"),
    startedAt: optionalString(row, "started_at"),
    completedAt: optionalString(row, "completed_at"),
    createdAt: requiredString(row, "created_at"),
  };
}

const runColumns = `
  id, case_id, conversation_id, purpose, trigger_type, trigger_id,
  requested_by_user_id, status, provider, model, provider_request_id,
  prompt_key, prompt_version, ruleset_version, input_snapshot_json,
  input_sha256, output_json, output_sha256, input_tokens, output_tokens,
  latency_ms, error_code, idempotency_key, started_at, completed_at, created_at
`;

export class AiRunsRepository {
  constructor(private readonly database: SqlExecutor) {}

  async claim(input: {
    caseId: string;
    conversationId: string;
    triggerType: string;
    triggerId: string;
    requestedByUserId: string;
    provider: string;
    model: string;
    promptKey: string;
    promptVersion: string;
    rulesetVersion: string;
    inputSnapshotJson: string;
    inputSha256: string;
    idempotencyKey: string;
  }): Promise<{ run: AiRunRecord; created: boolean }> {
    const id = createId();
    const timestamp = nowIso();
    const result = await this.database.execute({
      sql: `
        INSERT OR IGNORE INTO ai_runs (
          id, case_id, conversation_id, purpose, trigger_type, trigger_id,
          requested_by_user_id, status, provider, model, provider_request_id,
          prompt_key, prompt_version, ruleset_version, input_snapshot_json,
          input_sha256, output_json, output_sha256, input_tokens, output_tokens,
          latency_ms, error_code, idempotency_key, started_at, completed_at, created_at
        ) VALUES (
          ?, ?, ?, 'answer_case_question', ?, ?, ?, 'running', ?, ?, NULL,
          ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL, ?
        )
      `,
      args: [
        id,
        input.caseId,
        input.conversationId,
        input.triggerType,
        input.triggerId,
        input.requestedByUserId,
        input.provider,
        input.model,
        input.promptKey,
        input.promptVersion,
        input.rulesetVersion,
        input.inputSnapshotJson,
        input.inputSha256,
        input.idempotencyKey,
        timestamp,
        timestamp,
      ],
    });
    const run = result.rowsAffected === 1
      ? await this.findById(id)
      : await this.findByIdempotency(input.conversationId, input.idempotencyKey);
    if (!run) throw new Error("Failed to claim or recover AI run");
    return { run, created: result.rowsAffected === 1 };
  }

  async findById(id: string): Promise<AiRunRecord | null> {
    const result = await this.database.execute({
      sql: `SELECT ${runColumns} FROM ai_runs WHERE id = ?`,
      args: [id],
    });
    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async findByIdempotency(conversationId: string, idempotencyKey: string) {
    const result = await this.database.execute({
      sql: `SELECT ${runColumns} FROM ai_runs WHERE conversation_id = ? AND idempotency_key = ?`,
      args: [conversationId, idempotencyKey],
    });
    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async findLatestByCase(caseId: string) {
    const result = await this.database.execute({
      sql: `SELECT ${runColumns} FROM ai_runs WHERE case_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      args: [caseId],
    });
    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async attachSources(runId: string, sources: RetrievedRegulatorySection[]): Promise<void> {
    for (const [index, source] of sources.entries()) {
      await this.database.execute({
        sql: `
          INSERT INTO ai_run_sources (
            ai_run_id, source_section_id, context_ordinal, context_sha256,
            retrieval_method, retrieval_score
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          runId,
          source.id,
          index,
          source.bodySha256,
          source.retrievalMethod,
          source.retrievalScore,
        ],
      });
    }
  }

  async listSourceSectionIds(runId: string): Promise<string[]> {
    const result = await this.database.execute({
      sql: `SELECT source_section_id FROM ai_run_sources WHERE ai_run_id = ? ORDER BY context_ordinal`,
      args: [runId],
    });
    return result.rows.map((row) => requiredString(row, "source_section_id"));
  }

  async finalize(input: {
    id: string;
    status: Exclude<AiRunStatus, "pending" | "running">;
    providerRequestId?: string | null;
    outputJson?: string | null;
    outputSha256?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number | null;
    errorCode?: string | null;
  }): Promise<AiRunRecord> {
    const result = await this.database.execute({
      sql: `
        UPDATE ai_runs
        SET status = ?, provider_request_id = ?, output_json = ?, output_sha256 = ?,
            input_tokens = ?, output_tokens = ?, latency_ms = ?, error_code = ?,
            completed_at = ?
        WHERE id = ? AND status = 'running'
      `,
      args: [
        input.status,
        input.providerRequestId ?? null,
        input.outputJson ?? null,
        input.outputSha256 ?? null,
        input.inputTokens ?? null,
        input.outputTokens ?? null,
        input.latencyMs ?? null,
        input.errorCode ?? null,
        nowIso(),
        input.id,
      ],
    });
    if (result.rowsAffected !== 1) throw new Error("AI run finalization conflict");
    return (await this.findById(input.id))!;
  }
}
