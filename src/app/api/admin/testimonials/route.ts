import { adminRequest, dbError, refresh } from "@/lib/admin-route";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { testimonialSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const req = await adminRequest(request, testimonialSchema);
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase.from("testimonials").insert(req.data).select("id").single();
  if (error) return dbError(error);
  await audit({
    actorId: req.identity.userId,
    action: "testimonial.create",
    entityType: "testimonial",
    entityId: saved.id,
    ipHash: req.ipHash,
  });
  refresh("testimonials");
  return json({ ok: true, id: saved.id });
}
