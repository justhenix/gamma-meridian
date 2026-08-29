import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

export function createId(): string {
  return randomUUID();
}

export function createCaseReference(now = new Date()): string {
  const year = now.getUTCFullYear();
  const randomPart = randomBytes(6).toString("hex").toUpperCase();
  return `M-${year}-${randomPart}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
