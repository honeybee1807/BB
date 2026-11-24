import { adminRequest, dbError, refresh } from "@/lib/admin-route";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { postSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const req = await adminRequest(request, postSchema, { maxBytes: 120_000 });
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase
    .from("blog_posts")
    .insert({ ...req.data, author_id: req.identity.userId })
    .select("id")
    .single();
  if (error) return dbError(error);
  await audit({
    actorId: req.identity.userId,
    action: "post.create",
    entityType: "post",
    entityId: saved.id,
    ipHash: req.ipHash,
  });
  refresh("journal");
  return json({ ok: true, id: saved.id });
}
