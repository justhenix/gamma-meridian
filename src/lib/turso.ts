import { createClient } from "@libsql/client/web";

const url = process.env.TURSO_DATABASE_URL || "libsql://placeholder.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const turso = createClient({
  url,
  authToken,
});
