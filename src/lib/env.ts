/**
 * Public (browser-safe) configuration. NEXT_PUBLIC_ values are inlined at build time,
 * so each one is read with a literal `process.env.NAME` expression.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const publicEnv = {
  get supabaseUrl(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl(): string {
    return required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "");
  },
  get showPublicAvailability(): boolean {
    return process.env.NEXT_PUBLIC_SHOW_PUBLIC_AVAILABILITY === "true";
  },
};
