import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

import type { UserActor } from "../src/server/auth/actor";
import { getGuestTokenService } from "../src/server/auth/guest-token";
import { getDatabaseClient } from "../src/server/db/client";
import { applyMigrations } from "../src/server/db/migrations";
import { UsersRepository } from "../src/server/db/repositories/users";
import { RegulatoryIngestionService } from "../src/server/domain/regulations/ingestSource";

interface CatalogEntry {
  key: string;
  identifier: string;
  decision: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
}

async function resolveAdminUserId(): Promise<string> {
  const configured = process.env.MERIDIAN_INGEST_ACTOR_USER_ID?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MERIDIAN_INGEST_ACTOR_USER_ID is required in production");
  }
  const syntheticAdmin = await new UsersRepository(getDatabaseClient()).findByEmail(
    "admin@synthetic.meridian.test",
  );
  if (!syntheticAdmin) {
    throw new Error(
      "No ingestion admin is configured. Run npm run seed:development or set MERIDIAN_INGEST_ACTOR_USER_ID.",
    );
  }
  return syntheticAdmin.id;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const database = getDatabaseClient();
  try {
    await applyMigrations(database);
    const actor: UserActor = {
      kind: "user",
      userId: await resolveAdminUserId(),
      requestId: `regulatory-corpus-ingest-${crypto.randomUUID()}`,
    };
    const catalog = JSON.parse(
      await readFile(resolve("data/regulations/corpus-catalog.json"), "utf8"),
    ) as CatalogEntry[];
    const service = new RegulatoryIngestionService(database, getGuestTokenService());
    const result = { approved: 0, needsReview: 0, rejected: 0, sections: 0 };

    for (const entry of catalog) {
      if (entry.decision === "REJECTED") {
        result.rejected += 1;
        continue;
      }
      const bundle = JSON.parse(
        await readFile(resolve(`data/regulations/ingestion/${entry.key}.json`), "utf8"),
      ) as unknown;
      const ingested = await service.ingestSource(actor, bundle);
      const final = entry.decision === "APPROVED"
        ? await service.approveSourceVersion(actor, ingested.version.id)
        : ingested;
      result.sections += final.sections.length;
      if (final.version.reviewStatus === "approved") result.approved += 1;
      else result.needsReview += 1;
      console.log(
        `${entry.identifier}: ${final.version.reviewStatus} (${final.sections.length} sections)`,
      );
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    database.close();
  }
}

void main();
