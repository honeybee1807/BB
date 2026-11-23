import { after } from "next/server";
import { requireActiveAdminAnyLevel } from "@/lib/auth/admin-session";
import { sendSecurityAlert } from "@/lib/email/send";
import { lockoutAlertEmail } from "@/lib/email/templates";
import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";
import { MFA_FAILURE_LIMIT, clearEvents, countEvents, recordEvent } from "@/lib/security/rate-limit";
import { mfaVerifySchema } from "@/lib/validation/auth";

const LOCKED = "Too many incorrect codes. Please wait 15 minutes and try again.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();
  const parsed = mfaVerifySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return responses.badRequest("Enter the 6-digit code from your authenticator app.");

  const auth = await requireActiveAdminAnyLevel();
  if (auth instanceof Response) return auth;
  const { identity, supabase } = auth;

  const userKey = hashIdentifier("user", identity.userId);
  const ipHash = hashIdentifier("ip", getClientIp(request.headers));
  const { max, windowSeconds } = MFA_FAILURE_LIMIT;

  let failures: number;
  try {
    failures = await countEvents("mfa_fail_user", userKey, windowSeconds);
  } catch {
    return responses.serverError();
  }
  if (failures >= max) return json({ ok: false, error: LOCKED, locked: true }, 429);

  // never trust a factor id from the browser
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.all.find((f) => f.id === parsed.data.factorId && f.factor_type === "totp");
  if (!factor) return responses.badRequest("Two-factor setup has expired. Please start again.");
  const wasEnrolment = factor.status === "unverified";

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
  if (error) {
    try {
      await recordEvent("mfa_fail_user", userKey);
    } catch {
      return responses.serverError();
    }
    await audit({ actorId: identity.userId, action: "mfa.failed", entityType: "admin", entityId: identity.userId, ipHash });
    if (failures + 1 === max) {
      await audit({ actorId: identity.userId, action: "mfa.lockout", entityType: "admin", entityId: identity.userId, ipHash });
      after(() =>
        sendSecurityAlert("mfa-lockout", lockoutAlertEmail({ targetEmail: identity.email, attempts: max, when: new Date(), reason: "two-factor" })),
      );
      return json({ ok: false, error: LOCKED, locked: true }, 429);
    }
    return json({ ok: false, error: "That code is not correct. Check your authenticator app and try again." }, 401);
  }

  try {
    await clearEvents("mfa_fail_user", userKey);
  } catch {
    // not fatal
  }
  await audit({
    actorId: identity.userId,
    action: "mfa.verified",
    entityType: "admin",
    entityId: identity.userId,
    metadata: { enrolment: wasEnrolment },
    ipHash,
  });
  return json({ ok: true, next: "/admin" });
}
