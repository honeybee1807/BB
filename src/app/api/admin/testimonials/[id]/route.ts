import { z } from "zod";
import { adminRequest, dbError, notFound, refresh } from "@/lib/admin-route";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { testimonialSchema } from "@/lib/validation/admin";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/testimonials/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("testimonial");
  const schema = z.union([z.strictObject({ is_visible: z.boolean() }), testimonialSchema]);
  const req = await adminRequest(request, schema);
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase
    .from("testimonials")
    .update(req.data)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!saved) return notFound("testimonial");
  await audit({
    actorId: req.identity.userId,
    action: "testimonial.update",
    entityType: "testimonial",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("testimonials");
  return json({ ok: true });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/testimonials/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("testimonial");
  const req = await adminRequest(request, z.undefined(), { ownerOnly: true });
  if (req instanceof Response) return req;
  const { data: gone, error } = await req.supabase
    .from("testimonials")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!gone) return notFound("testimonial");
  await audit({
    actorId: req.identity.userId,
    action: "testimonial.delete",
    entityType: "testimonial",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("testimonials");
  return json({ ok: true });
}
