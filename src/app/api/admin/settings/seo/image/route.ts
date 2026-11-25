import { adminRequest, refresh } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { ImageError, processUpload, removeImages } from "@/lib/images";
import { audit } from "@/lib/security/audit";
import { seoImageSchema } from "@/lib/validation/settings";

// Sets a page's share image from a finished upload, or removes it when path is null.
export async function PUT(request: Request) {
  const req = await adminRequest(request, seoImageSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  const { supabase, identity, data } = req;
  if (data.path && !data.path.startsWith(`${identity.userId}/`)) return responses.badRequest();

  const { data: current, error: readError } = await supabase
    .from("seo_pages")
    .select("og_image_path")
    .eq("path", data.page)
    .maybeSingle();
  if (readError) return responses.serverError();

  let stored: string | null = null;
  if (data.path) {
    try {
      stored = (await processUpload(data.path, "property-photos", "seo", false)).storage_path;
    } catch (e) {
      return e instanceof ImageError ? responses.badRequest(e.message) : responses.serverError();
    }
  }

  const { error } = current
    ? await supabase.from("seo_pages").update({ og_image_path: stored }).eq("path", data.page)
    : await supabase.from("seo_pages").insert({ path: data.page, og_image_path: stored });
  if (error) {
    if (stored) await removeImages("property-photos", [stored]);
    return responses.serverError();
  }
  if (current?.og_image_path) await removeImages("property-photos", [current.og_image_path]);

  await audit({
    actorId: identity.userId,
    action: "seo.image",
    entityType: "page",
    entityId: data.page,
    metadata: { removed: !stored },
    ipHash: req.ipHash,
  });
  refresh("seo");
  return json({ ok: true });
}
