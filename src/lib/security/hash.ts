import { createHash } from "node:crypto";

/**
 * One-way hash for identifiers used as rate-limit keys and in audit rows
 * (IP addresses, email addresses), so the raw values are never stored.
 * Values are normalised (trimmed, lower-cased) and namespaced by kind.
 *
 * NOTE (decision pending): a plain SHA-256 of an IPv4 address can be reversed
 * by brute force. A keyed HMAC needs a new server secret, which is not in the
 * approved environment variable list.
 */
export type HashKind = "ip" | "email" | "user";

export function hashIdentifier(kind: HashKind, value: string): string {
  const normalised = value.trim().toLowerCase();
  return createHash("sha256").update(`bargain-breaks:${kind}:${normalised}`).digest("hex");
}
