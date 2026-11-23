import { createHmac } from "node:crypto";
import type { Db } from "./local-stack";

/** RFC 4648 base32 decode (Supabase returns TOTP secrets in base32). */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP: SHA-1, 30-second step, 6 digits (Supabase defaults). Test use only. */
export function totpCode(secretBase32: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    ((hmac[offset + 1] ?? 0) << 16) |
    ((hmac[offset + 2] ?? 0) << 8) |
    (hmac[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Enrols a TOTP factor from the current (aal1) session and verifies it, raising the session to aal2. */
export async function enrolAndVerifyTotp(c: Db): Promise<{ factorId: string; secret: string }> {
  const enrolled = await c.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw new Error(`TOTP enrolment failed: ${enrolled.error.message}`);
  const { id: factorId, totp } = enrolled.data;
  const verified = await c.auth.mfa.challengeAndVerify({ factorId, code: totpCode(totp.secret) });
  if (verified.error) throw new Error(`TOTP verification failed: ${verified.error.message}`);
  return { factorId, secret: totp.secret };
}

