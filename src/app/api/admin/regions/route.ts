import { adminRequest, dbError, refresh } from "@/lib/admin-route";
import { json } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { regionSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const req = await adminRequest(request, regionSchema, { ownerOnly: true });
  if (req instanceof Response) return req;
  const { data: saved, error } = await req.supabase.from("regions").insert(req.data).select("id").single();
  if (error) return dbError(error);
  await audit({
    actorId: req.identity.userId,
    action: "region.create",
    entityType: "region",
    entityId: saved.id,
    ipHash: req.ipHash,
  });
  refresh("listings");
  return json({ ok: true, id: saved.id });
}
