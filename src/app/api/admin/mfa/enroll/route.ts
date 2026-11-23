import { requireActiveAdminAnyLevel } from "@/lib/auth/admin-session";
import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { mfaEnrolSchema } from "@/lib/validation/auth";

// Any assurance level, so the owner can enrol before reaching aal2.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();
  if (!mfaEnrolSchema.safeParse((await readJsonBody(request)) ?? {}).success) return responses.badRequest();

  const auth = await requireActiveAdminAnyLevel();
  if (auth instanceof Response) return auth;
  const { identity, supabase } = auth;

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return responses.serverError();
  if (factors.totp.some((f) => f.status === "verified")) {
    return json({ ok: false, error: "Two-factor sign-in is already set up for this account." }, 409);
  }
  for (const factor of factors.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Bargain Breaks admin" });
  if (error) return responses.serverError();

  await audit({ actorId: identity.userId, action: "mfa.enrol_started", entityType: "admin", entityId: identity.userId });
  return json({ ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
}
