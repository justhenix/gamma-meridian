import assert from "node:assert/strict";
import test from "node:test";

import { createDatabaseClient } from "../../src/server/db/client";

test("database configuration fails closed for remote URLs without a token", () => {
  assert.throws(() =>
    createDatabaseClient({ url: "libsql://example-database.turso.io" }),
  );
});

test("database configuration permits local SQLite without a remote token", () => {
  const database = createDatabaseClient({ url: ":memory:" });
  database.close();
});
