import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env.server";
import type { EmailContent } from "./templates";

// "skipped" means Resend is not set up, as in local development.
type SendResult = { sent: boolean; skipped?: true };

let resend: Resend | undefined;

// Never throws or logs recipients. Skips sending when Resend isn't configured.
async function sendEmail(kind: string, to: string[], content: EmailContent, replyTo?: string): Promise<SendResult> {
  const apiKey = serverEnv.resendApiKey;
  const from = serverEnv.emailFrom;
  if (!apiKey || !from || to.length === 0) {
    console.warn(`[email] ${kind}: not configured, skipped`);
    return { sent: false, skipped: true };
  }
  try {
    resend ??= new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error(`[email] ${kind}: send failed (${error.name})`);
      return { sent: false };
    }
    return { sent: true };
  } catch {
    console.error(`[email] ${kind}: send failed`);
    return { sent: false };
  }
}

export function sendSecurityAlert(kind: string, content: EmailContent): Promise<SendResult> {
  return sendEmail(kind, serverEnv.securityAlertTo, content);
}

export function sendTeamInvite(to: string, content: EmailContent): Promise<SendResult> {
  return sendEmail("team invite", [to], content);
}

export function sendInquiryAlert(content: EmailContent, guestEmail: string): Promise<SendResult> {
  return sendEmail("inquiry", serverEnv.inquiryNotifyTo, content, guestEmail);
}
