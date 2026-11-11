const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function assertSingleOwnerRecord(configuredEmail: string, databaseOwnerEmails: string[]): void {
  const configured = String(configuredEmail ?? "").trim().toLowerCase();
  const owners = databaseOwnerEmails.map((email) => String(email ?? "").trim().toLowerCase());

  if (owners.length !== 1 || owners[0] !== configured) {
    throw new Error("Startup aborted: SQLite must contain exactly one Owner record matching OWNER_EMAILS.");
  }
}
