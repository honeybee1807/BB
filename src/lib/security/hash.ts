import { createHmac } from "node:crypto";

/**
 * Keyed one-way hash (HMAC-SHA256) for identifiers used as rate-limit keys and
 * in audit rows (IP addresses, email addresses, user ids), so raw values are
 * never stored. Keyed with the server-only IP_HASH_SECRET, so a stored hash
 * cannot be reversed by trying every IPv4 address or a list of emails.
 * Values are normalised (trimmed, lower-cased) and namespaced by kind.
 *
 * Rotating IP_HASH_SECRET only resets rate-limit windows and breaks the link
 * between old and new audit hashes; nothing else depends on it.
 */
export type HashKind = "ip" | "email" | "user";

const MIN_SECRET_LENGTH = 32;

function hashSecret(): string {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    // Never fall back to an unkeyed hash.
    throw new Error("IP_HASH_SECRET is missing or shorter than 32 characters.");
  }
  return secret;
}

export function hashIdentifier(kind: HashKind, value: string): string {
  const normalised = value.trim().toLowerCase();
  return createHmac("sha256", hashSecret()).update(`${kind}:${normalised}`).digest("hex");
}
