import { loadEnvConfig } from "@next/env";
import { getDatabaseClient } from "../src/server/db/client";
import { applyMigrations } from "../src/server/db/migrations";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const database = getDatabaseClient();
  try {
    const applied = await applyMigrations(database);
    if (applied.length === 0) {
      console.log("Database is already up to date.");
    } else {
      for (const migration of applied) {
        console.log(`Applied ${migration.name}`);
      }
    }
  } finally {
    database.close();
  }
}

void main();
