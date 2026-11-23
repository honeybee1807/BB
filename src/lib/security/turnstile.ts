import "server-only";
import { serverEnv } from "@/lib/env.server";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Fails closed: no secret, a timeout or an unexpected reply all count as a failed check.
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = serverEnv.turnstileSecretKey;
  if (!secret) {
    console.error("[turnstile] secret key is not configured");
    return false;
  }
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const result = (await res.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
