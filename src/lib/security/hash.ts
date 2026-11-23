import { createHmac } from "node:crypto";

// Keyed, so a stored hash can't be reversed by trying every IPv4 address.
// Rotating the secret only resets rate-limit windows.
type HashKind = "ip" | "email" | "user";

const MIN_SECRET_LENGTH = 32;

function hashSecret(): string {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    // never fall back to an unkeyed hash
    throw new Error("IP_HASH_SECRET is missing or shorter than 32 characters.");
  }
  return secret;
}

export function hashIdentifier(kind: HashKind, value: string): string {
  const normalised = value.trim().toLowerCase();
  return createHmac("sha256", hashSecret()).update(`${kind}:${normalised}`).digest("hex");
}
