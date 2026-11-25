import { z } from "zod";
import { adminRequest, notFound, refresh } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { discardUpload, ImageError, processUpload, removeImages } from "@/lib/images";
import { audit } from "@/lib/security/audit";
import { photoAddSchema, photoOrderSchema } from "@/lib/validation/admin";

const MAX_PHOTOS = 20;

// Turns a finished upload into a stored photo: resized, re-encoded and added at the end.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/properties/[id]/photos">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("home");
  const req = await adminRequest(request, photoAddSchema);
  if (req instanceof Response) return req;
  const { supabase, identity, data } = req;
  if (!data.path.startsWith(`${identity.userId}/`)) return responses.badRequest();

  const { data: home, error: homeError } = await supabase
    .from("properties")
    .select("id, photos:property_photos(sort_order, is_cover)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (homeError) return responses.serverError();
  if (!home) return notFound("home");
  if (home.photos.length >= MAX_PHOTOS) {
    await discardUpload(data.path);
    return responses.badRequest(`A home can have up to ${MAX_PHOTOS} photos. Delete one first.`);
  }

  let image;
  try {
    image = await processUpload(data.path, "property-photos", id, true);
  } catch (e) {
    return e instanceof ImageError ? responses.badRequest(e.message) : responses.serverError();
  }

  const insert = (is_cover: boolean) =>
    supabase
      .from("property_photos")
      .insert({
        property_id: id,
        storage_path: image.storage_path,
        thumb_path: image.thumb_path!,
        width: image.width,
        height: image.height,
        alt_text: data.alt_text,
        sort_order: Math.max(-1, ...home.photos.map((p) => p.sort_order)) + 1,
        is_cover,
      })
      .select("id")
      .single();
  let result = await insert(!home.photos.some((p) => p.is_cover));
  // two first photos uploaded together both ask to be the cover; the one that loses is added as a normal photo
  if (result.error?.code === "23505") result = await insert(false);
  const { data: saved, error } = result;
  if (error) {
    await removeImages("property-photos", [image.storage_path, image.thumb_path!]);
    return error.code === "23514"
      ? responses.badRequest("This home already has the most photos allowed.")
      : responses.serverError();
  }
  await audit({
    actorId: identity.userId,
    action: "photo.add",
    entityType: "property",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true, id: saved.id });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/properties/[id]/photos">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("home");
  const req = await adminRequest(request, photoOrderSchema);
  if (req instanceof Response) return req;
  const { supabase, data } = req;

  const { data: current, error: readError } = await supabase.from("property_photos").select("id").eq("property_id", id);
  if (readError) return responses.serverError();
  const known = new Set(current.map((p) => p.id));
  if (data.ids.length !== known.size || !data.ids.every((photoId) => known.has(photoId))) {
    return json({ ok: false, error: "The photos changed while you were working. Refresh and try again." }, 409);
  }
  const results = await Promise.all(
    data.ids.map((photoId, i) =>
      supabase.from("property_photos").update({ sort_order: i }).eq("id", photoId).eq("property_id", id),
    ),
  );
  if (results.some((r) => r.error)) return responses.serverError();
  await audit({
    actorId: req.identity.userId,
    action: "photo.order",
    entityType: "property",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true });
}
