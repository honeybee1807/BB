import { after } from "next/server";
import { z } from "zod";
import { adminRequest, dbError, notFound, refresh } from "@/lib/admin-route";
import { sendSecurityAlert } from "@/lib/email/send";
import { deleteAlertEmail } from "@/lib/email/templates";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { postSchema, publishSchema } from "@/lib/validation/admin";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/posts/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("post");
  const req = await adminRequest(request, z.union([publishSchema, postSchema]), { maxBytes: 120_000 });
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase
    .from("blog_posts")
    .update(req.data)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!saved) return notFound("post");
  const publishOnly = Object.keys(req.data).length === 1;
  await audit({
    actorId: req.identity.userId,
    action: publishOnly ? "post.publish" : "post.update",
    entityType: "post",
    entityId: id,
    metadata: publishOnly ? { published: req.data.is_published } : undefined,
    ipHash: req.ipHash,
  });
  refresh("journal");
  return json({ ok: true });
}

// Soft delete. The database only lets the owner set deleted_at.
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/posts/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound("post");
  const req = await adminRequest(request, z.undefined(), { ownerOnly: true });
  if (req instanceof Response) return req;
  const { data: gone, error } = await req.supabase
    .from("blog_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, title")
    .maybeSingle();
  if (error) return dbError(error);
  if (!gone) return notFound("post");
  await audit({
    actorId: req.identity.userId,
    action: "post.delete",
    entityType: "post",
    entityId: id,
    ipHash: req.ipHash,
  });
  refresh("journal");
  const actorName = req.identity.fullName;
  after(() =>
    sendSecurityAlert(
      "post delete",
      deleteAlertEmail({
        actorName,
        action: "deleted",
        entityLabel: `Journal post "${gone.title}"`,
        when: new Date(),
        restoreHint: "The post is hidden, not erased. Olideen Technologies can restore it if it was a mistake.",
      }),
    ),
  );
  return json({ ok: true });
}
