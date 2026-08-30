import "server-only";

import type { InStatement, Row } from "@libsql/client";
import type { AiAnswerContract } from "../../domain/ai/contract";
import type { RetrievedRegulatorySection } from "../../domain/regulations/types";
import { createId, nowIso } from "../../domain/shared/ids";
import { optionalString, parseJson, requiredNumber, requiredString } from "../row";
import type { SqlExecutor } from "../types";

export interface RecommendationRecord {
  id: string;
  caseId: string;
  conversationId: string;
  versionNumber: number;
  aiRunId: string | null;
  language: "id" | "en";
  content: AiAnswerContract;
  status: "published" | "draft" | "in_review" | "approved" | "superseded" | "withdrawn";
  publishedAt: string | null;
}

function mapRecommendation(row: Row): RecommendationRecord {
  return {
    id: requiredString(row, "id"),
    caseId: requiredString(row, "case_id"),
    conversationId: requiredString(row, "conversation_id"),
    versionNumber: requiredNumber(row, "version_number"),
    aiRunId: optionalString(row, "ai_run_id"),
    language: requiredString(row, "language") as "id" | "en",
    content: parseJson<AiAnswerContract>(row, "content_json"),
    status: requiredString(row, "status") as RecommendationRecord["status"],
    publishedAt: optionalString(row, "published_at"),
  };
}

export class RecommendationsRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createPublishedAiRecommendation(input: {
    caseId: string;
    conversationId: string;
    aiRunId: string;
    language: "id" | "en";
    content: AiAnswerContract;
    contentJson: string;
    contentSha256: string;
    sources: RetrievedRegulatorySection[];
  }): Promise<RecommendationRecord> {
    const versionResult = await this.database.execute({
      sql: "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM recommendation_versions WHERE case_id = ?",
      args: [input.caseId],
    });
    const versionNumber = requiredNumber(versionResult.rows[0]!, "next_version");
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO recommendation_versions (
          id, case_id, conversation_id, version_number, origin, ai_run_id,
          author_user_id, language, content_json, content_sha256, status,
          supersedes_version_id, approved_by_user_id, approved_at,
          published_by_user_id, published_at, created_at
        ) VALUES (?, ?, ?, ?, 'ai', ?, NULL, ?, ?, ?, 'published',
                  NULL, NULL, NULL, NULL, ?, ?)
      `,
      args: [
        id,
        input.caseId,
        input.conversationId,
        versionNumber,
        input.aiRunId,
        input.language,
        input.contentJson,
        input.contentSha256,
        timestamp,
        timestamp,
      ],
    });

    const sourceById = new Map(input.sources.map((source) => [source.id, source]));
    const citationStatements: InStatement[] = [];
    for (let index = 0; index < input.content.citations.length; index += 1) {
      const citation = input.content.citations[index]!;
      const source = sourceById.get(citation.sourceSectionId);
      if (!source) continue;
      citationStatements.push({
        sql: `
          INSERT INTO recommendation_citations (
            id, recommendation_version_id, source_section_id, claim_key,
            claim_text, locator_snapshot, excerpt_snapshot, support_status,
            verified_by_user_id, verified_at, display_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', NULL, ?, ?)
        `,
        args: [
          createId(),
          id,
          citation.sourceSectionId,
          `claim_${index + 1}`,
          citation.claim,
          source.locator,
          source.bodyText.slice(0, 4000),
          timestamp,
          index,
        ],
      });
    }
    if (citationStatements.length > 0) {
      if (this.database.batch) {
        await this.database.batch(citationStatements);
      } else {
        for (const statement of citationStatements) {
          await this.database.execute(statement);
        }
      }
    }
    return {
      id,
      caseId: input.caseId,
      conversationId: input.conversationId,
      versionNumber,
      aiRunId: input.aiRunId,
      language: input.language,
      content: input.content,
      status: "published",
      publishedAt: timestamp,
    };
  }

  async findById(id: string): Promise<RecommendationRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, conversation_id, version_number, ai_run_id,
               language, content_json, status, published_at
        FROM recommendation_versions WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapRecommendation(result.rows[0]) : null;
  }

  async findByAiRun(aiRunId: string): Promise<RecommendationRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, conversation_id, version_number, ai_run_id,
               language, content_json, status, published_at
        FROM recommendation_versions WHERE ai_run_id = ?
      `,
      args: [aiRunId],
    });
    return result.rows[0] ? mapRecommendation(result.rows[0]) : null;
  }
}
