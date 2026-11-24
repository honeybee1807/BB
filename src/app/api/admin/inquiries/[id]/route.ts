import { z } from "zod";
import { requireActiveAdmin } from "@/lib/auth/admin-session";
import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";
import { inquiryUpdateSchema } from "@/lib/validation/admin";

const NOT_FOUND = () => json({ ok: false, error: "That inquiry could not be found." }, 404);

// Status, assignee and notes only. The column grant stops guest details being changed here.
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/inquiries/[id]">) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();
  const auth = await requireActiveAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NOT_FOUND();
  const parsed = inquiryUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return responses.badRequest();
  const change = parsed.data;
  const { supabase, identity } = auth;

  const { data: current, error: readError } = await supabase
    .from("inquiries")
    .select("status, assigned_to, internal_notes")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return responses.serverError();
  if (!current) return NOT_FOUND();

  if (change.assignedTo) {
    const { data: admins, error } = await supabase.rpc("list_active_admins");
    if (error) return responses.serverError();
    if (!admins.some((a) => a.id === change.assignedTo)) {
      return responses.badRequest("Choose someone from the team.");
    }
  }

  const notes = change.notes === undefined ? undefined : change.notes.trim() || null;
  const update: { status?: typeof current.status; assigned_to?: string | null; internal_notes?: string | null } = {};
  if (change.status !== undefined && change.status !== current.status) update.status = change.status;
  if (change.assignedTo !== undefined && change.assignedTo !== current.assigned_to)
    update.assigned_to = change.assignedTo;
  if (notes !== undefined && notes !== current.internal_notes) update.internal_notes = notes;
  // Unless a status is chosen too, taking a new inquiry claims it and letting go of a claimed one reopens it.
  if (update.assigned_to !== undefined && update.status === undefined && change.status === undefined) {
    if (update.assigned_to && current.status === "new") update.status = "claimed";
    if (!update.assigned_to && current.status === "claimed") update.status = "new";
  }
  if (Object.keys(update).length === 0) return json({ ok: true });

  let query = supabase.from("inquiries").update(update).eq("id", id);
  // One conditional update, so two people can never take the same inquiry at once.
  if (update.assigned_to !== undefined) {
    query = current.assigned_to === null ? query.is("assigned_to", null) : query.eq("assigned_to", current.assigned_to);
  }
  const { data: saved, error } = await query.select("id").maybeSingle();
  if (error) return responses.serverError();
  if (!saved) {
    if (update.assigned_to === undefined) return NOT_FOUND();
    return json({ ok: false, error: "Someone else has just picked this up. Refresh to see who." }, 409);
  }

  // ids and status names only: never guest details or the text of the notes
  const base = {
    actorId: identity.userId,
    entityType: "inquiry",
    entityId: id,
    ipHash: hashIdentifier("ip", getClientIp(request.headers)),
  };
  if (update.status)
    await audit({ ...base, action: "inquiry.status", metadata: { from: current.status, to: update.status } });
  if (update.assigned_to !== undefined) {
    await audit({ ...base, action: "inquiry.assign", metadata: { from: current.assigned_to, to: update.assigned_to } });
  }
  if (update.internal_notes !== undefined) await audit({ ...base, action: "inquiry.notes" });

  return json({ ok: true });
}
