import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env.server";
import type { EmailContent } from "./templates";

type SendResult = { sent: boolean };

let resend: Resend | undefined;

/**
 * Sends one email through Resend. Never throws, and never logs recipients or content.
 * Without RESEND_API_KEY / EMAIL_FROM (local development) the email is skipped.
 */
async function sendEmail(kind: string, to: string[], content: EmailContent, replyTo?: string): Promise<SendResult> {
  const apiKey = serverEnv.resendApiKey;
  const from = serverEnv.emailFrom;
  if (!apiKey || !from || to.length === 0) {
    console.warn(`[email] ${kind}: not configured, skipped`);
    return { sent: false };
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

/** Security alerts go to SECURITY_ALERT_TO. */
export function sendSecurityAlert(kind: string, content: EmailContent): Promise<SendResult> {
  return sendEmail(kind, serverEnv.securityAlertTo, content);
}
