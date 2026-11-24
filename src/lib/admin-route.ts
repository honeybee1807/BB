import "server-only";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import { requireActiveAdmin } from "@/lib/auth/admin-session";
import { json, readJsonBody, responses } from "@/lib/http";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";

type Auth = Exclude<Awaited<ReturnType<typeof requireActiveAdmin>>, Response>;

export type AdminRequest<T> = Auth & { data: T; ipHash: string };

// Origin, active admin (and owner where asked), then a strict parse of the body.
export async function adminRequest<S extends z.ZodType>(
  request: Request,
  schema: S,
  options: { ownerOnly?: boolean; maxBytes?: number } = {},
): Promise<AdminRequest<z.output<S>> | Response> {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();
  const auth = await requireActiveAdmin();
  if (auth instanceof Response) return auth;
  if (options.ownerOnly && auth.identity.role !== "owner") return json({ ok: false, error: "Not found." }, 404);
  const parsed = schema.safeParse(await readJsonBody(request, options.maxBytes));
  if (!parsed.success) return responses.badRequest(parsed.error.issues[0]?.message);
  return { ...auth, data: parsed.data, ipHash: hashIdentifier("ip", getClientIp(request.headers)) };
}

export const notFound = (what: string) => json({ ok: false, error: `That ${what} could not be found.` }, 404);

// Postgres codes the admin forms can explain; anything else is a generic failure.
export function dbError(error: { code?: string }, duplicate = "That web address is already in use."): Response {
  if (error.code === "23505") return json({ ok: false, error: duplicate }, 409);
  if (error.code === "23514") return responses.badRequest();
  if (error.code === "23503") return json({ ok: false, error: "That item is still in use." }, 409);
  if (error.code === "42501") return json({ ok: false, error: "You don't have permission to do that." }, 403);
  return responses.serverError();
}

export type PublicTag = "listings" | "journal" | "testimonials" | "seo";

// Admin changes should show on the public site at the next visit, not after the cache expires.
export function refresh(...tags: PublicTag[]): void {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
