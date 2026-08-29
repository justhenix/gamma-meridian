import "server-only";

import { createClient, type Client } from "@libsql/client";
import { z } from "zod";

const databaseConfigSchema = z
  .object({
    url: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value === ":memory:" ||
          value.startsWith("file:") ||
          value.startsWith("libsql:") ||
          value.startsWith("https:"),
        "Database URL must use file:, libsql:, https:, or :memory:",
      ),
    authToken: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.url.startsWith("libsql:") || value.url.startsWith("https:")) &&
      !value.authToken
    ) {
      context.addIssue({
        code: "custom",
        path: ["authToken"],
        message: "TURSO_AUTH_TOKEN is required for remote databases",
      });
    }
  });

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

let databaseClient: Client | undefined;

export function createDatabaseClient(input: DatabaseConfig): Client {
  const config = databaseConfigSchema.parse(input);
  return createClient({
    url: config.url,
    authToken: config.authToken,
    intMode: "number",
  });
}

export function getDatabaseClient(): Client {
  if (databaseClient) {
    return databaseClient;
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required");
  }

  databaseClient = createDatabaseClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return databaseClient;
}
