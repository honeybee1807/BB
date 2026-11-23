import { after } from "next/server";
import { needsTwoFactor } from "@/lib/auth/two-factor-rule";
import { lockoutAlertEmail, loginAlertEmail } from "@/lib/email/templates";
import { sendSecurityAlert } from "@/lib/email/send";
import { json, readJsonBody, responses } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { approximateLocation, describeDevice, getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";
import { LOGIN_FAILURE_LIMIT, clearEvents, countEvents, recordEvent } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

const INVALID = "Email or password is incorrect.";
const LOCKED = "Too many sign-in attempts. Please wait 15 minutes and try again.";

// Same error whether or not the email exists. While locked, the password isn't checked.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();

  const parsed = loginSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return responses.badRequest("Enter your email and password.");

  const email = parsed.data.email.trim().toLowerCase();
  const emailKey = hashIdentifier("email", email);
  const ipKey = hashIdentifier("ip", getClientIp(request.headers));
  const { max, windowSeconds } = LOGIN_FAILURE_LIMIT;

  let emailFailures: number;
  let ipFailures: number;
  try {
    [emailFailures, ipFailures] = await Promise.all([
      countEvents("login_fail_email", emailKey, windowSeconds),
      countEvents("login_fail_ip", ipKey, windowSeconds),
    ]);
  } catch {
    return responses.serverError();
  }
  if (emailFailures >= max || ipFailures >= max) {
    return json({ ok: false, error: LOCKED, locked: true }, 429);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  let profile: { full_name: string; role: "owner" | "team_member"; is_active: boolean } | null = null;
  if (!error && data.user) {
    const result = await supabase.from("admin_profiles").select("full_name, role, is_active").eq("id", data.user.id).maybeSingle();
    profile = result.data;
  }

  if (error || !data.user || !profile || !profile.is_active) {
    // a valid password for a non-admin counts as a wrong one
    if (data?.user) await supabase.auth.signOut({ scope: "local" });
    try {
      await Promise.all([recordEvent("login_fail_email", emailKey), recordEvent("login_fail_ip", ipKey)]);
    } catch {
      return responses.serverError();
    }
    await audit({
      actorId: null,
      action: "login.failed",
      metadata: { email_hash: emailKey.slice(0, 16) },
      ipHash: ipKey,
    });

    const lockedNow = emailFailures + 1 === max || ipFailures + 1 === max;
    if (lockedNow) {
      const attempts = Math.max(emailFailures, ipFailures) + 1;
      await audit({ actorId: null, action: "login.lockout", metadata: { email_hash: emailKey.slice(0, 16), attempts }, ipHash: ipKey });
      after(() => sendSecurityAlert("lockout", lockoutAlertEmail({ targetEmail: email, attempts, when: new Date(), reason: "password" })));
      return json({ ok: false, error: LOCKED, locked: true }, 429);
    }
    return json({ ok: false, error: INVALID }, 401);
  }

  // the IP counter keeps its window
  try {
    await clearEvents("login_fail_email", emailKey);
  } catch {
    // not fatal
  }
  await audit({ actorId: data.user.id, action: "login.ok", entityType: "admin", entityId: data.user.id, ipHash: ipKey });

  const fullName = profile.full_name;
  const location = approximateLocation(request.headers);
  const device = describeDevice(request.headers.get("user-agent"));
  after(() => sendSecurityAlert("login", loginAlertEmail({ name: fullName, email, when: new Date(), location, device })));

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const next = needsTwoFactor(profile.role, aal?.currentLevel ?? null, aal?.nextLevel ?? null) ? "/admin/mfa" : "/admin";
  return json({ ok: true, next });
}
