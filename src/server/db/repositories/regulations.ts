import "server-only";

import type { InStatement, ResultSet, Row } from "@libsql/client";

import type {
  RegulatorySectionRecord,
  RegulatorySourceRecord,
  RegulatorySourceVersionRecord,
  RetrievedRegulatorySection,
} from "../../domain/regulations/types";
import { createId, nowIso } from "../../domain/shared/ids";
import {
  optionalString,
  parseJson,
  requiredNumber,
  requiredString,
} from "../row";
import type { SqlExecutor } from "../types";

function mapSource(row: Row): RegulatorySourceRecord {
  return {
    id: requiredString(row, "source_id"),
    officialIdentifier: requiredString(row, "official_identifier"),
    title: requiredString(row, "source_title"),
    authority: requiredString(row, "authority"),
    jurisdiction: requiredString(row, "jurisdiction"),
    sourceType: requiredString(row, "source_type"),
    canonicalUrl: requiredString(row, "canonical_url"),
    status: requiredString(row, "source_status") as "active" | "retired",
    createdAt: requiredString(row, "source_created_at"),
    updatedAt: requiredString(row, "source_updated_at"),
  };
}

function mapVersion(row: Row): RegulatorySourceVersionRecord {
  return {
    id: requiredString(row, "version_id"),
    regulatorySourceId: requiredString(row, "regulatory_source_id"),
    versionLabel: requiredString(row, "version_label"),
    publicationDate: requiredString(row, "publication_date"),
    effectiveFrom: requiredString(row, "effective_from"),
    effectiveTo: optionalString(row, "effective_to"),
    retrievedAt: requiredString(row, "retrieved_at"),
    contentSha256: requiredString(row, "content_sha256"),
    reviewStatus: requiredString(row, "review_status") as RegulatorySourceVersionRecord["reviewStatus"],
    reviewedByUserId: optionalString(row, "reviewed_by_user_id"),
    reviewedAt: optionalString(row, "reviewed_at"),
    createdAt: requiredString(row, "version_created_at"),
  };
}

function mapSection(row: Row): RegulatorySectionRecord {
  return {
    id: requiredString(row, "section_id"),
    sourceVersionId: requiredString(row, "source_version_id"),
    heading: requiredString(row, "heading"),
    locator: requiredString(row, "locator"),
    ordinal: requiredNumber(row, "ordinal"),
    bodyText: requiredString(row, "body_text"),
    bodySha256: requiredString(row, "body_sha256"),
    taxTopics: parseJson<string[]>(row, "tax_topics_json"),
    createdAt: requiredString(row, "section_created_at"),
  };
}

const joinedColumns = `
  section.id AS section_id, section.source_version_id, section.heading,
  section.locator, section.ordinal, section.body_text, section.body_sha256,
  section.tax_topics_json, section.created_at AS section_created_at,
  version.id AS version_id, version.regulatory_source_id, version.version_label,
  version.publication_date, version.effective_from, version.effective_to,
  version.retrieved_at, version.content_sha256, version.review_status,
  version.reviewed_by_user_id, version.reviewed_at,
  version.created_at AS version_created_at,
  source.id AS source_id, source.official_identifier,
  source.title AS source_title, source.authority, source.jurisdiction,
  source.source_type, source.canonical_url, source.status AS source_status,
  source.created_at AS source_created_at, source.updated_at AS source_updated_at
`;

function mapRetrieved(
  row: Row,
  retrievalMethod: RetrievedRegulatorySection["retrievalMethod"],
): RetrievedRegulatorySection {
  return {
    ...mapSection(row),
    source: mapSource(row),
    version: mapVersion(row),
    retrievalMethod,
    retrievalScore:
      row.retrieval_score === null || row.retrieval_score === undefined
        ? null
        : Number(row.retrieval_score),
  };
}

function topicFilter(topics: string[]): { sql: string; args: string[] } {
  if (topics.length === 0) return { sql: "", args: [] };
  const placeholders = topics.map(() => "?").join(", ");
  return {
    sql: `
      AND EXISTS (
        SELECT 1 FROM json_each(section.tax_topics_json) AS topic
        WHERE topic.value IN (${placeholders})
      )
    `,
    args: topics,
  };
}

export class RegulationsRepository {
  constructor(private readonly database: SqlExecutor) {}

  async findSource(authority: string, officialIdentifier: string) {
    const result = await this.database.execute({
      sql: `
        SELECT id AS source_id, official_identifier, title AS source_title,
               authority, jurisdiction, source_type, canonical_url,
               status AS source_status, created_at AS source_created_at,
               updated_at AS source_updated_at
        FROM regulatory_sources
        WHERE authority = ? AND official_identifier = ?
      `,
      args: [authority, officialIdentifier],
    });
    return result.rows[0] ? mapSource(result.rows[0]) : null;
  }

  async findSourceById(sourceId: string) {
    const result = await this.database.execute({
      sql: `
        SELECT id AS source_id, official_identifier, title AS source_title,
               authority, jurisdiction, source_type, canonical_url,
               status AS source_status, created_at AS source_created_at,
               updated_at AS source_updated_at
        FROM regulatory_sources
        WHERE id = ?
      `,
      args: [sourceId],
    });
    return result.rows[0] ? mapSource(result.rows[0]) : null;
  }

  async createSource(input: {
    officialIdentifier: string;
    title: string;
    authority: string;
    jurisdiction: string;
    sourceType: string;
    canonicalUrl: string;
  }): Promise<RegulatorySourceRecord> {
    const id = createId();
    const timestamp = nowIso();
    await this.database.execute({
      sql: `
        INSERT INTO regulatory_sources (
          id, official_identifier, title, authority, jurisdiction, source_type,
          canonical_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `,
      args: [
        id,
        input.officialIdentifier,
        input.title,
        input.authority,
        input.jurisdiction,
        input.sourceType,
        input.canonicalUrl,
        timestamp,
        timestamp,
      ],
    });
    return (await this.findSource(input.authority, input.officialIdentifier))!;
  }

  async findVersion(sourceId: string, versionLabel: string) {
    const result = await this.database.execute({
      sql: `
        SELECT id AS version_id, regulatory_source_id, version_label,
               publication_date, effective_from, effective_to, retrieved_at,
               content_sha256, review_status, reviewed_by_user_id, reviewed_at,
               created_at AS version_created_at
        FROM regulatory_source_versions
        WHERE regulatory_source_id = ? AND version_label = ?
      `,
      args: [sourceId, versionLabel],
    });
    return result.rows[0] ? mapVersion(result.rows[0]) : null;
  }

  async findVersionById(versionId: string) {
    const result = await this.database.execute({
      sql: `
        SELECT id AS version_id, regulatory_source_id, version_label,
               publication_date, effective_from, effective_to, retrieved_at,
               content_sha256, review_status, reviewed_by_user_id, reviewed_at,
               created_at AS version_created_at
        FROM regulatory_source_versions
        WHERE id = ?
      `,
      args: [versionId],
    });
    return result.rows[0] ? mapVersion(result.rows[0]) : null;
  }

  async createVersion(input: {
    sourceId: string;
    versionLabel: string;
    publicationDate: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    retrievedAt: string;
    contentSha256: string;
  }): Promise<RegulatorySourceVersionRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO regulatory_source_versions (
          id, regulatory_source_id, version_label, publication_date,
          effective_from, effective_to, retrieved_at, content_sha256,
          review_status, reviewed_by_user_id, reviewed_at,
          supersedes_version_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)
      `,
      args: [
        id,
        input.sourceId,
        input.versionLabel,
        input.publicationDate,
        input.effectiveFrom,
        input.effectiveTo,
        input.retrievedAt,
        input.contentSha256,
        nowIso(),
      ],
    });
    return (await this.findVersion(input.sourceId, input.versionLabel))!;
  }

  async addSection(input: {
    sourceVersionId: string;
    heading: string;
    locator: string;
    ordinal: number;
    bodyText: string;
    bodySha256: string;
    taxTopics: string[];
  }): Promise<RegulatorySectionRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO regulatory_source_sections (
          id, source_version_id, heading, locator, ordinal, body_text,
          body_sha256, tax_topics_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        input.sourceVersionId,
        input.heading,
        input.locator,
        input.ordinal,
        input.bodyText,
        input.bodySha256,
        JSON.stringify(input.taxTopics),
        nowIso(),
      ],
    });
    return (await this.findSectionById(id))!;
  }

  async addSections(
    inputs: Array<{
      sourceVersionId: string;
      heading: string;
      locator: string;
      ordinal: number;
      bodyText: string;
      bodySha256: string;
      taxTopics: string[];
    }>,
  ): Promise<RegulatorySectionRecord[]> {
    const statements: InStatement[] = inputs.map((input) => ({
      sql: `
        INSERT INTO regulatory_source_sections (
          id, source_version_id, heading, locator, ordinal, body_text,
          body_sha256, tax_topics_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        createId(),
        input.sourceVersionId,
        input.heading,
        input.locator,
        input.ordinal,
        input.bodyText,
        input.bodySha256,
        JSON.stringify(input.taxTopics),
        nowIso(),
      ],
    }));
    const batchExecutor = this.database as SqlExecutor & {
      batch?: (statements: InStatement[]) => Promise<ResultSet[]>;
    };
    if (batchExecutor.batch) {
      for (let index = 0; index < statements.length; index += 25) {
        await batchExecutor.batch(statements.slice(index, index + 25));
      }
    } else {
      for (const statement of statements) {
        await this.database.execute(statement);
      }
    }
    return this.listSections(inputs[0]!.sourceVersionId);
  }

  async listSections(versionId: string): Promise<RegulatorySectionRecord[]> {
    const result = await this.database.execute({
      sql: `
        SELECT id AS section_id, source_version_id, heading, locator, ordinal,
               body_text, body_sha256, tax_topics_json,
               created_at AS section_created_at
        FROM regulatory_source_sections
        WHERE source_version_id = ?
        ORDER BY ordinal, id
      `,
      args: [versionId],
    });
    return result.rows.map(mapSection);
  }

  async approveVersion(versionId: string, reviewerUserId: string): Promise<boolean> {
    const result = await this.database.execute({
      sql: `
        UPDATE regulatory_source_versions
        SET review_status = 'approved', reviewed_by_user_id = ?, reviewed_at = ?
        WHERE id = ? AND review_status = 'pending'
      `,
      args: [reviewerUserId, nowIso(), versionId],
    });
    return result.rowsAffected === 1;
  }

  async findSectionById(sectionId: string): Promise<RegulatorySectionRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id AS section_id, source_version_id, heading, locator, ordinal,
               body_text, body_sha256, tax_topics_json,
               created_at AS section_created_at
        FROM regulatory_source_sections
        WHERE id = ?
      `,
      args: [sectionId],
    });
    return result.rows[0] ? mapSection(result.rows[0]) : null;
  }

  async findRetrievedSectionById(sectionId: string) {
    const result = await this.database.execute({
      sql: `
        SELECT ${joinedColumns}, NULL AS retrieval_score
        FROM regulatory_source_sections AS section
        JOIN regulatory_source_versions AS version ON version.id = section.source_version_id
        JOIN regulatory_sources AS source ON source.id = version.regulatory_source_id
        WHERE section.id = ?
      `,
      args: [sectionId],
    });
    return result.rows[0] ? mapRetrieved(result.rows[0], "metadata") : null;
  }

  async retrieve(input: {
    ftsQuery: string | null;
    jurisdiction: string;
    taxTopics: string[];
    effectiveAt: string;
    limit: number;
  }): Promise<RetrievedRegulatorySection[]> {
    const topics = topicFilter(input.taxTopics);
    if (input.ftsQuery) {
      try {
        const ftsResult = await this.database.execute({
          sql: `
            SELECT ${joinedColumns},
                   bm25(regulatory_source_sections_fts) AS retrieval_score
            FROM regulatory_source_sections_fts
            JOIN regulatory_source_sections AS section
              ON section.id = regulatory_source_sections_fts.section_id
            JOIN regulatory_source_versions AS version
              ON version.id = section.source_version_id
            JOIN regulatory_sources AS source
              ON source.id = version.regulatory_source_id
            WHERE regulatory_source_sections_fts MATCH ?
              AND source.status = 'active'
              AND source.jurisdiction = ?
              AND version.review_status = 'approved'
              AND version.effective_from <= ?
              AND (version.effective_to IS NULL OR version.effective_to >= ?)
              ${topics.sql}
            ORDER BY retrieval_score, section.ordinal
            LIMIT ?
          `,
          args: [
            input.ftsQuery,
            input.jurisdiction,
            input.effectiveAt,
            input.effectiveAt,
            ...topics.args,
            input.limit,
          ],
        });
        if (ftsResult.rows.length > 0) {
          return ftsResult.rows.map((row) => mapRetrieved(row, "fts5_bm25"));
        }
      } catch {
        // Turso deployments without FTS5 fall back to approved metadata filters.
      }
    }

    const metadataResult = await this.database.execute({
      sql: `
        SELECT ${joinedColumns}, NULL AS retrieval_score
        FROM regulatory_source_sections AS section
        JOIN regulatory_source_versions AS version ON version.id = section.source_version_id
        JOIN regulatory_sources AS source ON source.id = version.regulatory_source_id
        WHERE source.status = 'active'
          AND source.jurisdiction = ?
          AND version.review_status = 'approved'
          AND version.effective_from <= ?
          AND (version.effective_to IS NULL OR version.effective_to >= ?)
          ${topics.sql}
        ORDER BY version.publication_date DESC, section.ordinal
        LIMIT ?
      `,
      args: [
        input.jurisdiction,
        input.effectiveAt,
        input.effectiveAt,
        ...topics.args,
        input.limit,
      ],
    });
    return metadataResult.rows.map((row) => mapRetrieved(row, "metadata"));
  }
}
