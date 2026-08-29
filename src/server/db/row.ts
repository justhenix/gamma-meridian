import type { Row } from "@libsql/client";

export function requiredString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Database column ${key} is not a string`);
  }
  return value;
}

export function optionalString(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Database column ${key} is not a nullable string`);
  }
  return value;
}

export function requiredNumber(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new Error(`Database column ${key} is not a number`);
  }
  return value;
}

export function parseJson<T>(row: Row, key: string): T {
  return JSON.parse(requiredString(row, key)) as T;
}
