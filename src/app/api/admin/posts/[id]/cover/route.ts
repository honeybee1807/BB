import { z } from "zod";
import { adminRequest, notFound, refresh } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { ImageError, processUpload, removeImages } from "@/lib/images";
import { audit } from "@/lib/security/audit";
import { coverSchema } from "@/lib/validation/admin";

// Sets the cover from a finished upload, or removes it when path is null.
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/posts/[id]/cover">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("post");
  const req = await adminRequest(request, coverSchema);
  if (req instanceof Response) return req;
  const { supabase, identity, data } = req;
  if (data.path && !data.path.startsWith(`${identity.userId}/`)) return responses.badRequest();

  const { data: post, error: readError } = await supabase
    .from("blog_posts")
    .select("featured_image_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return responses.serverError();
  if (!post) return notFound("post");

  let path: string | null = null;
  if (data.path) {
    try {
      path = (await processUpload(data.path, "blog-images", `posts/${id}`, false)).storage_path;
    } catch (e) {
      return e instanceof ImageError ? responses.badRequest(e.message) : responses.serverError();
    }
  }
  const { error } = await supabase.from("blog_posts").update({ featured_image_path: path }).eq("id", id);
  if (error) {
    if (path) await removeImages("blog-images", [path]);
    return responses.serverError();
  }
  if (post.featured_image_path) await removeImages("blog-images", [post.featured_image_path]);
  await audit({ actorId: identity.userId, action: "post.cover", entityType: "post", entityId: id, ipHash: req.ipHash });
  refresh("journal");
  return json({ ok: true });
}
