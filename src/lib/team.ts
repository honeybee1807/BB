import "server-only";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin-format";
import { sendTeamInvite } from "@/lib/email/send";
import { teamInviteEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { json } from "@/lib/http";
import { hashIdentifier } from "@/lib/security/hash";
import { INVITE_LIMITS, hit } from "@/lib/security/rate-limit";

export const TOO_MANY_INVITES = () =>
  json({ ok: false, error: "That's a lot of invites in a short time. Please wait a while and try again." }, 429);

export const EMAIL_FAILED = () =>
  json({ ok: false, error: "The invite is saved but the email didn't go out. Please use Resend to try again." }, 502);

// Both limits count every attempt, so neither can be worked around by switching address or owner.
export async function inviteAllowed(ownerId: string, email: string): Promise<boolean> {
  const { owner, email: perEmail } = INVITE_LIMITS;
  const byOwner = await hit(owner.bucket, hashIdentifier("user", ownerId), owner.windowSeconds, owner.max);
  const byEmail = await hit(perEmail.bucket, hashIdentifier("email", email), perEmail.windowSeconds, perEmail.max);
  return byOwner && byEmail;
}

// The token sits after the # so it never reaches server or proxy logs.
export async function deliverInvite(input: {
  email: string;
  role: AdminRole;
  token: string;
  expiresAt: string;
  inviterName: string;
}): Promise<boolean> {
  const content = teamInviteEmail({
    inviterName: input.inviterName,
    roleLabel: ROLE_LABELS[input.role],
    link: `${publicEnv.siteUrl}/admin/invite#${input.token}`,
    expires: new Date(input.expiresAt),
  });
  const result = await sendTeamInvite(input.email, content);
  return result.sent || (result.skipped === true && !serverEnv.isProduction);
}
