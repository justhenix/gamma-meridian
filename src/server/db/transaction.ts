import "server-only";

import type { Client, Transaction } from "@libsql/client";

export async function withWriteTransaction<T>(
  client: Client,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const transaction = await client.transaction("write");

  try {
    const foreignKeys = await transaction.execute("PRAGMA foreign_keys");
    const ignoredChecks = await transaction.execute("PRAGMA ignore_check_constraints");
    if (
      foreignKeys.rows[0]?.foreign_keys !== 1 ||
      ignoredChecks.rows[0]?.ignore_check_constraints !== 0
    ) {
      throw new Error("Database integrity constraints are not enabled");
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
