import "server-only";

import { type ZodType } from "zod";

import { DomainError } from "../domain/shared/errors";

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError("VALIDATION_ERROR", "Input validation failed");
  }
  return result.data;
}
