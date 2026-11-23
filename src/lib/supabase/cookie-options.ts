import type { CookieOptionsWithName } from "@supabase/ssr";

// httpOnly because every auth call goes through our own server routes.
export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 12,
};
