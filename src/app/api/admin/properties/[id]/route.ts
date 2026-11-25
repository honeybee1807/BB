import { after } from "next/server";
import { z } from "zod";
import { adminRequest, dbError, notFound, refresh } from "@/lib/admin-route";
import { sendSecurityAlert } from "@/lib/email/send";
import { deleteAlertEmail } from "@/lib/email/templates";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { propertySchema, publishSchema } from "@/lib/validation/admin";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/properties/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("home");
  const req = await adminRequest(request, z.union([publishSchema, propertySchema]), { maxBytes: 40_000 });
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase
    .from("properties")
    .update(req.data)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!saved) return notFound("home");
  const publishOnly = Object.keys(req.data).length === 1;
  await audit({
    actorId: req.identity.userId,
    action: publishOnly ? "property.publish" : "property.update",
    entityType: "property",
    entityId: id,
    metadata: publishOnly ? { published: req.data.is_published } : undefined,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true });
}

// Soft delete. The database only lets the owner set deleted_at; the alert never holds up the delete.
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/properties/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("home");
  const req = await adminRequest(request, z.undefined(), { ownerOnly: true });
  if (req instanceof Response) return req;
  const { data: gone, error } = await req.supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name")
    .maybeSingle();
  if (error) return dbError(error);
  if (!gone) return notFound("home");
  await audit({
    actorId: req.identity.userId,
    action: "property.delete",
    entityType: "property",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  const actorName = req.identity.fullName;
  after(() =>
    sendSecurityAlert(
      "property delete",
      deleteAlertEmail({
        actorName,
        action: "deleted",
        entityLabel: `Home "${gone.name}"`,
        when: new Date(),
        restoreHint: "The home is hidden, not erased. Olideen Technologies can restore it if it was a mistake.",
      }),
    ),
  );
  return json({ ok: true });
}
