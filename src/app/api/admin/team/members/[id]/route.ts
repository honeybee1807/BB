import { z } from "zod";
import { adminRequest, notFound, type AdminRequest } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { getAdminClient } from "@/lib/supabase/admin";
import { memberUpdateSchema } from "@/lib/validation/team";

const NOT_YOURSELF = () => json({ ok: false, error: "You can't change your own role or access." }, 400);
const LAST_OWNER = () => json({ ok: false, error: "There must always be at least one active owner." }, 409);

// Long enough to mean "until switched back on"; Supabase has no permanent ban.
const BANNED = "876000h";

async function findMember(req: AdminRequest<unknown>, id: string) {
  const { data, error } = await req.supabase.rpc("list_team");
  if (error) throw new Error("Team lookup failed");
  return { member: data.find((m) => m.id === id), team: data };
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/team/members/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("team member");
  const req = await adminRequest(request, memberUpdateSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  if (id === req.identity.userId) return NOT_YOURSELF();

  let member;
  try {
    ({ member } = await findMember(req, id));
  } catch {
    return responses.serverError();
  }
  if (!member) return notFound("team member");

  const change = "role" in req.data ? { role: req.data.role } : { is_active: req.data.active };
  const { data: saved, error } = await req.supabase
    .from("admin_profiles")
    .update(change)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23514") return LAST_OWNER();
  if (error?.code === "42501") return NOT_YOURSELF();
  if (error) return responses.serverError();
  if (!saved) return notFound("team member");

  const base = { actorId: req.identity.userId, entityType: "admin", entityId: id, ipHash: req.ipHash };
  if ("role" in req.data) {
    await audit({ ...base, action: "team.role", metadata: { from: member.role, to: req.data.role } });
    return json({ ok: true });
  }

  // The profile change already stops access; the ban also ends any open session at its next refresh.
  const { error: banError } = await getAdminClient().auth.admin.updateUserById(id, {
    ban_duration: req.data.active ? "none" : BANNED,
  });
  await audit({ ...base, action: req.data.active ? "team.reactivate" : "team.deactivate" });
  if (banError) {
    return json({ ok: false, error: "Their access changed, but their sign-in didn't update. Please try again." }, 502);
  }
  return json({ ok: true });
}

// Inquiries they held stay where they are and show as unassigned.
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/team/members/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("team member");
  const req = await adminRequest(request, z.undefined(), { ownerOnly: true });
  if (req instanceof Response) return req;
  if (id === req.identity.userId) return json({ ok: false, error: "You can't remove yourself." }, 400);

  let found;
  try {
    found = await findMember(req, id);
  } catch {
    return responses.serverError();
  }
  const { member, team } = found;
  if (!member) return notFound("team member");
  const otherOwners = team.filter((m) => m.role === "owner" && m.is_active && m.id !== id);
  if (member.role === "owner" && member.is_active && otherOwners.length === 0) return LAST_OWNER();

  // a database trigger refuses this too if the last owner would go
  const { error } = await getAdminClient().auth.admin.deleteUser(id);
  if (error) return responses.serverError();
  await audit({
    actorId: req.identity.userId,
    action: "team.remove",
    entityType: "admin",
    entityId: id,
    ipHash: req.ipHash,
  });
  return json({ ok: true });
}
