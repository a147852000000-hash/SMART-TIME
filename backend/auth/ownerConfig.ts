const EMAIL_PATTERN = /^[^\s@]+@[^s@]+\.[^s@]+$/;

export function parseSingleOwnerEmail(value: unknown): string {
  const configured = String(value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length !== 1 || !EMAIL_PATTERN.test(configured[0])) {
    throw new Error("OWNER_EMAILS must contain exactly one valid owner email address.");
  }

  return configured[0];
}
