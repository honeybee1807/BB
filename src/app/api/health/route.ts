import { json } from "@/lib/http";
import { getClientIp } from "@/lib/security/client-info";
import { getPublicClient } from "@/lib/supabase/public";

const MAX_PER_MINUTE = 30;
// In memory rather than in the database, so the limit still holds while the database is down.
const hits = new Map<string, { count: number; resetAt: number }>();

function allowed(ip: string, now: number): boolean {
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_MINUTE;
}

export async function GET(request: Request) {
  if (!allowed(getClientIp(request.headers), Date.now())) {
    return Response.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  try {
    const { error } = await getPublicClient()
      .from("regions")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (!error) return json({ status: "ok" });
  } catch {}
  return json({ status: "failing" }, 503);
}
