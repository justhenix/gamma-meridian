import "server-only";

import type { Client, Transaction } from "@libsql/client";

export async function withWriteTransaction<T>(
  client: Client,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const transaction = await client.transaction("write");

  try {
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
