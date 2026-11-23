import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

export const LOGIN_LIMIT = { max: 5, windowSeconds: 15 * 60 } as const;
export const MFA_LIMIT = { max: 5, windowSeconds: 15 * 60 } as const;

// Hourly first, so attempts refused by the hourly limit don't use up the daily allowance.
export const INQUIRY_LIMITS = [
  { bucket: "inquiry_ip_hour", max: 5, windowSeconds: 60 * 60 },
  { bucket: "inquiry_ip_day", max: 20, windowSeconds: 24 * 60 * 60 },
] as const;

type RateLimitBucket =
  "login_fail_email" | "login_fail_ip" | "mfa_fail_user" | (typeof INQUIRY_LIMITS)[number]["bucket"];

// Counts and records in one locked step, so parallel requests can't slip past the limit.
export async function hit(bucket: RateLimitBucket, keyHash: string, windowSeconds: number, max: number) {
  const { data, error } = await getAdminClient().rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) throw new Error("Rate limit check failed");
  return data === true;
}

export async function countEvents(bucket: RateLimitBucket, keyHash: string, windowSeconds: number): Promise<number> {
  const { data, error } = await getAdminClient().rpc("rate_limit_count", {
    p_bucket: bucket,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Rate limit check failed");
  return data ?? 0;
}

export async function recordEvent(bucket: RateLimitBucket, keyHash: string): Promise<void> {
  const { error } = await getAdminClient().rpc("rate_limit_record", { p_bucket: bucket, p_key_hash: keyHash });
  if (error) throw new Error("Rate limit record failed");
}

export async function clearEvents(bucket: RateLimitBucket, keyHash: string): Promise<void> {
  const { error } = await getAdminClient().rpc("rate_limit_clear", { p_bucket: bucket, p_key_hash: keyHash });
  if (error) throw new Error("Rate limit clear failed");
}
