import "server-only";

const sensitiveKey = /(email|name|phone|token|secret|password|npwp|nik|address)/i;

function redactString(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted-number]")
    .slice(0, 20000);
}

export function sanitizeForAi(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizeForAi);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        sensitiveKey.test(key) ? "[redacted]" : sanitizeForAi(child),
      ]),
    );
  }
  return value;
}
