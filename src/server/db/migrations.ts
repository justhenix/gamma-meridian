import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Client } from "@libsql/client";

const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/;

export interface AppliedMigration {
  name: string;
  appliedAt: string;
}

async function tableExists(database: Client, tableName: string): Promise<boolean> {
  const result = await database.execute({
    sql: "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ? LIMIT 1",
    args: [tableName],
  });
  return result.rows.length === 1;
}

export async function applyMigrations(
  database: Client,
  migrationsDirectory = resolve(process.cwd(), "db/migrations"),
): Promise<AppliedMigration[]> {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => migrationFilePattern.test(file))
    .sort();
  const appliedResult = await database.execute(
    "SELECT name FROM schema_migrations ORDER BY name",
  );
  const applied = new Set(appliedResult.rows.map((row) => String(row.name)));
  const appliedNow: AppliedMigration[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const appliedAt = new Date().toISOString();
    const isAdoptingExistingBaseline =
      file === "0001_human_case_workflow.sql" &&
      (await tableExists(database, "users"));

    if (!isAdoptingExistingBaseline) {
      const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
      await database.executeMultiple(sql);
    }

    await database.execute({
      sql: "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
      args: [file, appliedAt],
    });
    appliedNow.push({ name: file, appliedAt });
  }

  const foreignKeyCheck = await database.execute("PRAGMA foreign_key_check");
  if (foreignKeyCheck.rows.length > 0) {
    throw new Error("Migration left invalid foreign-key references");
  }

  return appliedNow;
}
