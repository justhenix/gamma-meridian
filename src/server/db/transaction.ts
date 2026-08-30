import "server-only";

import type { Client, Transaction } from "@libsql/client";

function isUnsupportedHostedPragma(error: unknown, pragma: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes("SQL not allowed statement") &&
    error.message.toLowerCase().includes(pragma.toLowerCase())
  );
}

export async function withWriteTransaction<T>(
  client: Client,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const transaction = await client.transaction("write");

  try {
    const foreignKeys = await transaction.execute("PRAGMA foreign_keys");
    if (foreignKeys.rows[0]?.foreign_keys !== 1) {
      throw new Error("Database integrity constraints are not enabled");
    }
    try {
      const ignoredChecks = await transaction.execute("PRAGMA ignore_check_constraints");
      if (ignoredChecks.rows[0]?.ignore_check_constraints !== 0) {
        throw new Error("Database check constraints are not enabled");
      }
    } catch (error) {
      // Turso Cloud enforces CHECK constraints but its hosted HTTP transaction
      // protocol can reject this read-only SQLite pragma even though local
      // libSQL exposes it. Other errors remain fatal.
      if (!isUnsupportedHostedPragma(error, "ignore_check_constraints")) {
        throw error;
      }
    }

    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    if (!transaction.closed) {
      await transaction.rollback();
    }
    throw error;
  } finally {
    transaction.close();
  }
}
