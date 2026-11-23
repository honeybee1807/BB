import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

export const LOGIN_FAILURE_LIMIT = { max: 5, windowSeconds: 15 * 60 } as const;
export const MFA_FAILURE_LIMIT = { max: 5, windowSeconds: 15 * 60 } as const;

type RateLimitBucket = "login_fail_email" | "login_fail_ip" | "mfa_fail_user";

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
