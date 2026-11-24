import { requireActiveAdmin } from "@/lib/auth/admin-session";
import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";
import { availabilitySchema } from "@/lib/validation/admin";

// Blocks or opens one date or a range. block_dates and open_dates run as the user, so RLS applies.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();
  const auth = await requireActiveAdmin();
  if (auth instanceof Response) return auth;

  const parsed = availabilitySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return responses.badRequest(parsed.error.issues[0]?.message);
  const { propertyId, from, to, action } = parsed.data;
  const { supabase, identity } = auth;

  const { data: property, error: readError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return responses.serverError();
  if (!property) return json({ ok: false, error: "That home could not be found." }, 404);

  const fn = action === "block" ? "block_dates" : "open_dates";
  const { data: changed, error } = await supabase.rpc(fn, { p_property_id: propertyId, p_from: from, p_to: to });
  if (error) return responses.serverError();

  await audit({
    actorId: identity.userId,
    action: action === "block" ? "availability.block" : "availability.open",
    entityType: "property",
    entityId: propertyId,
    metadata: { from, to, changed: changed ?? 0 },
    ipHash: hashIdentifier("ip", getClientIp(request.headers)),
  });

  return json({ ok: true, changed: changed ?? 0 });
}
