import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Auth cookies are httpOnly: the browser never reads them, because sign-in,
 * sign-out and two-factor all go through our own server routes.
 * Secure in production; Lax blocks cross-site POSTs carrying the session.
 * The cookie lives at most 12 hours; the admin layout also signs out after
 * 30 minutes without activity, and refresh tokens rotate on every refresh.
 */
export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 12,
};
