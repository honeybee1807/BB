import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";
import { logoutSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();
  const body = (await readJsonBody(request)) ?? {};
  const parsed = logoutSchema.safeParse(body);
  if (!parsed.success) return responses.badRequest();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.signOut({ scope: "local" });
    await audit({
      actorId: user.id,
      action: parsed.data.reason === "idle" ? "logout.idle" : "logout",
      entityType: "admin",
      entityId: user.id,
      ipHash: hashIdentifier("ip", getClientIp(request.headers)),
    });
  }
  return json({ ok: true, next: parsed.data.reason === "idle" ? "/admin/login?reason=idle" : "/admin/login" });
}
