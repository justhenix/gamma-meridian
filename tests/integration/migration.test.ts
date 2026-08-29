import assert from "node:assert/strict";
import test from "node:test";

import { createTestDatabase } from "../helpers/database";

test("initial migration creates only the selected domain tables", async (context) => {
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
      "audit_events",
      "case_members",
      "cases",
      "client_account_members",
      "client_accounts",
      "conversations",
      "intake_answers",
      "intake_sessions",
      "messages",
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
