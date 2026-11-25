import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { hashInviteToken } from "@/lib/security/invite-token";
import { isSameOrigin } from "@/lib/security/origin";
import { ACCEPT_LIMIT, hit } from "@/lib/security/rate-limit";
import { getAdminClient } from "@/lib/supabase/admin";
import { acceptInviteSchema } from "@/lib/validation/team";

// One message for every refusal, so the reply says nothing about the address or the account.
const UNUSABLE = () =>
  json(
    {
      ok: false,
      error: "This invite link can't be used. It may have expired or been used already. Ask for a new one.",
    },
    400,
  );

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();

  const ipHash = hashIdentifier("ip", getClientIp(request.headers));
  try {
    if (!(await hit(ACCEPT_LIMIT.bucket, ipHash, ACCEPT_LIMIT.windowSeconds, ACCEPT_LIMIT.max))) {
      return json({ ok: false, error: "Too many attempts. Please wait 15 minutes and try again." }, 429);
    }
  } catch {
    return responses.serverError();
  }

  const parsed = acceptInviteSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return responses.badRequest(parsed.error.issues[0]?.message);
  const { token, fullName, password } = parsed.data;
  const tokenHash = hashInviteToken(token);
  const db = getAdminClient();

  const { data: invite, error: readError } = await db
    .from("team_invites")
    .select("email")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (readError) return responses.serverError();
  if (!invite) return UNUSABLE();

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) return UNUSABLE();
  const userId = created.user.id;

  // Uses up the invite and creates the profile together. If that fails, the new login goes too.
  const { data: role, error } = await db.rpc("accept_team_invite", {
    p_token_hash: tokenHash,
    p_user_id: userId,
    p_full_name: fullName,
  });
  if (error || !role) {
    await db.auth.admin.deleteUser(userId);
    return error ? responses.serverError() : UNUSABLE();
  }

  await audit({
    actorId: userId,
    action: "team.join",
    entityType: "admin",
    entityId: userId,
    metadata: { role },
    ipHash,
  });
  return json({ ok: true });
}
