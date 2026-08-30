import assert from "node:assert/strict";
import test from "node:test";

import { createTestDatabase } from "../helpers/database";

test("numbered migrations create the human, regulatory, AI, and escalation tables", async (context) => {
  const database = await createTestDatabase(context);
  const result = await database.execute(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  assert.deepEqual(
    result.rows.map((row) => row.name),
    [
      "ai_run_sources",
      "ai_runs",
      "audit_events",
      "case_members",
      "cases",
      "client_account_members",
      "client_accounts",
      "conversations",
      "escalations",
      "intake_answers",
      "intake_sessions",
      "messages",
      "recommendation_citations",
      "recommendation_versions",
      "regulatory_source_sections",
      "regulatory_source_sections_fts",
      "regulatory_source_sections_fts_config",
      "regulatory_source_sections_fts_content",
      "regulatory_source_sections_fts_data",
      "regulatory_source_sections_fts_docsize",
      "regulatory_source_sections_fts_idx",
      "regulatory_source_versions",
      "regulatory_sources",
      "schema_migrations",
      "users",
    ],
  );

  const foreignKeys = await database.execute("PRAGMA foreign_keys");
  assert.equal(foreignKeys.rows[0]?.foreign_keys, 1);
  await assert.rejects(
    database.execute({
      sql: `
        INSERT INTO case_members (
          id, case_id, user_id, case_role, added_by_user_id, reason,
          created_at, removed_at
        ) VALUES (?, ?, ?, 'consultant', ?, 'invalid orphan', ?, NULL)
      `,
      args: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
        "00000000-0000-4000-8000-000000000003",
        new Date().toISOString(),
      ],
    }),
  );
});
