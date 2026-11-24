import { z } from "zod";
import { adminRequest, notFound, refresh } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { removeImages } from "@/lib/images";
import { audit } from "@/lib/security/audit";
import { photoUpdateSchema } from "@/lib/validation/admin";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/photos/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("photo");
  const req = await adminRequest(request, photoUpdateSchema);
  if (req instanceof Response) return req;
  const { supabase, data } = req;

  const { data: photo, error: readError } = await supabase
    .from("property_photos")
    .select("property_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return responses.serverError();
  if (!photo) return notFound("photo");

  // The unique index allows one cover per home, so the old one is cleared first.
  if (data.is_cover) {
    const { error } = await supabase
      .from("property_photos")
      .update({ is_cover: false })
      .eq("property_id", photo.property_id)
      .neq("id", id);
    if (error) return responses.serverError();
  }
  const { error } = await supabase.from("property_photos").update(data).eq("id", id);
  if (error) return responses.serverError();
  await audit({
    actorId: req.identity.userId,
    action: "photo.update",
    entityType: "property",
    entityId: photo.property_id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/photos/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("photo");
  const req = await adminRequest(request, z.undefined());
  if (req instanceof Response) return req;
  const { supabase } = req;

  const { data: photo, error } = await supabase
    .from("property_photos")
    .delete()
    .eq("id", id)
    .select("property_id, storage_path, thumb_path, is_cover")
    .maybeSingle();
  if (error) return responses.serverError();
  if (!photo) return notFound("photo");
  await removeImages("property-photos", [photo.storage_path, photo.thumb_path]);

  if (photo.is_cover) {
    const { data: next } = await supabase
      .from("property_photos")
      .select("id")
      .eq("property_id", photo.property_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from("property_photos").update({ is_cover: true }).eq("id", next.id);
  }
  await audit({
    actorId: req.identity.userId,
    action: "photo.delete",
    entityType: "property",
    entityId: photo.property_id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true });
}
