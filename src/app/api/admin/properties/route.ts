import { adminRequest, dbError, refresh } from "@/lib/admin-route";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { propertySchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const req = await adminRequest(request, propertySchema, { maxBytes: 40_000 });
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase.from("properties").insert(req.data).select("id").single();
  if (error) return dbError(error);
  await audit({
    actorId: req.identity.userId,
    action: "property.create",
    entityType: "property",
    entityId: saved.id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true, id: saved.id });
}
