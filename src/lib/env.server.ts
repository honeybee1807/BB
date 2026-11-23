import "server-only";

function optional(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// The service role key is only read in src/lib/supabase/admin.ts.
export const serverEnv = {
  get resendApiKey(): string | undefined {
    return optional(process.env.RESEND_API_KEY);
  },
  get emailFrom(): string | undefined {
    return optional(process.env.EMAIL_FROM);
  },
  get inquiryNotifyTo(): string[] {
    return list(process.env.INQUIRY_NOTIFY_TO);
  },
  get securityAlertTo(): string[] {
    return list(process.env.SECURITY_ALERT_TO);
  },
  get turnstileSecretKey(): string | undefined {
    return optional(process.env.TURNSTILE_SECRET_KEY);
  },
  get healthToken(): string | undefined {
    return optional(process.env.HEALTH_TOKEN);
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
