import type { InStatement, ResultSet } from "@libsql/client";

export interface SqlExecutor {
  execute(statement: InStatement): Promise<ResultSet>;
  batch?(statements: InStatement[]): Promise<ResultSet[]>;
}
