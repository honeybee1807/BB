import { adminRequest, dbError } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { hashIdentifier } from "@/lib/security/hash";
import { newInviteToken } from "@/lib/security/invite-token";
import { EMAIL_FAILED, TOO_MANY_INVITES, deliverInvite, inviteAllowed } from "@/lib/team";
import { inviteSchema } from "@/lib/validation/team";

export async function POST(request: Request) {
  const req = await adminRequest(request, inviteSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  const { supabase, identity, data } = req;
  const { email, role } = data;

  try {
    if (!(await inviteAllowed(identity.userId, email))) return TOO_MANY_INVITES();
  } catch {
    return responses.serverError();
  }

  const { data: team, error: teamError } = await supabase.rpc("list_team");
  if (teamError) return responses.serverError();
  // same reply as a new invite, so the response never says who is already on the team
  if (team.some((m) => m.email.toLowerCase() === email)) return json({ ok: true });

  // a fresh invite replaces any earlier one for the same address
  const { error: cancelError } = await supabase
    .from("team_invites")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("email", email)
    .is("accepted_at", null)
    .is("cancelled_at", null);
  if (cancelError) return dbError(cancelError);

  const { token, hash } = newInviteToken();
  const { data: invite, error } = await supabase
    .from("team_invites")
    .insert({ email, role, token_hash: hash })
    .select("id, expires_at")
    .single();
  if (error) return dbError(error, "There is already an invite waiting for that address.");

  await audit({
    actorId: identity.userId,
    action: "team.invite",
    entityType: "team_invite",
    entityId: invite.id,
    metadata: { role, email_hash: hashIdentifier("email", email).slice(0, 16) },
    ipHash: req.ipHash,
  });

  const sent = await deliverInvite({
    email,
    role,
    token,
    expiresAt: invite.expires_at,
    inviterName: identity.fullName,
  });
  if (!sent) return EMAIL_FAILED();
  return json({ ok: true });
}
