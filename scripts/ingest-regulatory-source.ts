import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

import type { UserActor } from "../src/server/auth/actor";
import { getGuestTokenService } from "../src/server/auth/guest-token";
import { getDatabaseClient } from "../src/server/db/client";
import { applyMigrations } from "../src/server/db/migrations";
import { RegulatoryIngestionService } from "../src/server/domain/regulations/ingestSource";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run ingest:regulation -- <source.json> [--approve]");
  }
  const actorUserId = process.env.MERIDIAN_INGEST_ACTOR_USER_ID;
  if (!actorUserId) {
    throw new Error("MERIDIAN_INGEST_ACTOR_USER_ID is required");
  }

  const database = getDatabaseClient();
  try {
    await applyMigrations(database);
    const document = JSON.parse(await readFile(resolve(inputPath), "utf8")) as unknown;
    const service = new RegulatoryIngestionService(database, getGuestTokenService());
    const actor: UserActor = {
      kind: "user",
      userId: actorUserId,
      requestId: `manual-regulation-ingest-${crypto.randomUUID()}`,
    };
    const ingested = await service.ingestSource(actor, document);
    const result = process.argv.includes("--approve")
      ? await service.approveSourceVersion(actor, ingested.version.id)
      : ingested;
    console.log(
      JSON.stringify(
        {
          sourceId: result.source.id,
          versionId: result.version.id,
          reviewStatus: result.version.reviewStatus,
          contentSha256: result.version.contentSha256,
          sectionCount: result.sections.length,
        },
        null,
        2,
      ),
    );
  } finally {
    database.close();
  }
}

void main();
