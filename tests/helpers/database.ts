import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { TestContext } from "node:test";

import type { Client } from "@libsql/client";

import { createDatabaseClient } from "../../src/server/db/client";
import { applyMigrations } from "../../src/server/db/migrations";
import { DomainError, type DomainErrorCode } from "../../src/server/domain/shared/errors";

export async function createTestDatabase(context: TestContext): Promise<Client> {
  const directory = await mkdtemp(join(tmpdir(), "meridian-test-"));
  const databasePath = join(directory, "meridian.db");
  const client = createDatabaseClient({ url: pathToFileURL(databasePath).href });
  await applyMigrations(client);

  context.after(async () => {
    client.close();
    (globalThis as { gc?: () => void }).gc?.();
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 50,
    });
  });
  return client;
}

export function hasDomainError(code: DomainErrorCode) {
  return (error: unknown): boolean =>
    error instanceof DomainError && error.code === code;
}
