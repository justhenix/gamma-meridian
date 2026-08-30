import "server-only";

export function getStaffEmailAllowlist(): ReadonlySet<string> {
  const emails = new Set(
    (process.env.MERIDIAN_STAFF_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (emails.size === 0) {
    throw new Error("MERIDIAN_STAFF_EMAILS must contain at least one authorized staff email");
  }
  return emails;
}
