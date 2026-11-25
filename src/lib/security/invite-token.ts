import { createHash, randomBytes } from "node:crypto";

// 256 random bits, so an unkeyed hash is enough: the token can't be worked back from it.
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}
