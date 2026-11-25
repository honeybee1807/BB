import { adminRequest, dbError, refresh } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { seoPageSchema } from "@/lib/validation/settings";

// Saves a page's search title and description. Blank fields fall back to the built-in defaults.
export async function PUT(request: Request) {
  const req = await adminRequest(request, seoPageSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  const { supabase, identity, data } = req;
  const { page, title, description } = data;

  const { data: current, error: readError } = await supabase
    .from("seo_pages")
    .select("title, description")
    .eq("path", page)
    .maybeSingle();
  if (readError) return responses.serverError();

  const fields = [
    title !== (current?.title ?? null) && "title",
    description !== (current?.description ?? null) && "description",
  ].filter((f): f is string => Boolean(f));
  if (fields.length === 0) return json({ ok: true });

  const { error } = current
    ? await supabase.from("seo_pages").update({ title, description }).eq("path", page)
    : await supabase.from("seo_pages").insert({ path: page, title, description });
  if (error) return dbError(error);

  await audit({
    actorId: identity.userId,
    action: "seo.update",
    entityType: "page",
    entityId: page,
    metadata: { fields },
    ipHash: req.ipHash,
  });
  refresh("seo");
  return json({ ok: true });
}
