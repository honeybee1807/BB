import { z } from "zod";
import { adminRequest, dbError, notFound } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { newInviteToken } from "@/lib/security/invite-token";
import { EMAIL_FAILED, TOO_MANY_INVITES, deliverInvite, inviteAllowed } from "@/lib/team";
import { inviteActionSchema } from "@/lib/validation/team";

// Resending swaps in a new token, so the old link stops working and the 7 days start again.
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/team/invites/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("invite");
  const req = await adminRequest(request, inviteActionSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  const { supabase, identity } = req;

  const { data: invite, error: readError } = await supabase
    .from("team_invites")
    .select("email, role")
    .eq("id", id)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  if (readError) return responses.serverError();
  if (!invite) return notFound("invite");

  if (req.data.action === "cancel") {
    const { data: saved, error } = await supabase
      .from("team_invites")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return dbError(error);
    if (!saved) return notFound("invite");
    await audit({
      actorId: identity.userId,
      action: "team.invite_cancel",
      entityType: "team_invite",
      entityId: id,
      ipHash: req.ipHash,
    });
    return json({ ok: true });
  }

  try {
    if (!(await inviteAllowed(identity.userId, invite.email))) return TOO_MANY_INVITES();
  } catch {
    return responses.serverError();
  }

  const { token, hash } = newInviteToken();
  const { data: saved, error } = await supabase
    .from("team_invites")
    .update({ token_hash: hash })
    .eq("id", id)
    .select("expires_at")
    .maybeSingle();
  if (error) return dbError(error);
  if (!saved) return notFound("invite");
  await audit({
    actorId: identity.userId,
    action: "team.invite_resend",
    entityType: "team_invite",
    entityId: id,
    ipHash: req.ipHash,
  });

  const sent = await deliverInvite({ ...invite, token, expiresAt: saved.expires_at, inviterName: identity.fullName });
  if (!sent) return EMAIL_FAILED();
  return json({ ok: true });
}
