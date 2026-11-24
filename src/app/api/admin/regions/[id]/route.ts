import { z } from "zod";
import { adminRequest, dbError, notFound, refresh } from "@/lib/admin-route";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { regionSchema } from "@/lib/validation/admin";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/regions/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("region");
  const req = await adminRequest(request, regionSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase
    .from("regions")
    .update(req.data)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!saved) return notFound("region");
  await audit({
    actorId: req.identity.userId,
    action: "region.update",
    entityType: "region",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/regions/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("region");
  const req = await adminRequest(request, z.undefined(), { ownerOnly: true });
  if (req instanceof Response) return req;
  const { data: gone, error } = await req.supabase.from("regions").delete().eq("id", id).select("id").maybeSingle();
  if (error?.code === "23503") return json({ ok: false, error: "Move or delete its estates first." }, 409);
  if (error) return dbError(error);
  if (!gone) return notFound("region");
  await audit({
    actorId: req.identity.userId,
    action: "region.delete",
    entityType: "region",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true });
}
