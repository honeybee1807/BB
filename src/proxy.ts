import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import type { Database } from "@/types/database";

/**
 * Runs only on /admin and /api/admin (see matcher), never on public pages, so
 * those stay pre-rendered.
 *
 * 1. Refreshes the Supabase session. Refresh tokens rotate on every refresh,
 *    and the new httpOnly cookies are written to both request and response.
 * 2. Optimistic gate: admin pages other than the login page return the same
 *    blank 404 to anyone without a session. Pages and routes still do the full
 *    check (active admin profile, two-factor level) themselves.
 */
const PUBLIC_ADMIN_PAGES = new Set(["/admin/login"]);

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, {
              ...options,
              ...authCookieOptions,
              maxAge: options.maxAge === 0 ? 0 : authCookieOptions.maxAge,
            });
          }
        },
      },
    },
  );

  // getUser() validates the token with the Auth server and refreshes it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  if (isAdminPage && !user && !PUBLIC_ADMIN_PAGES.has(path)) {
    // Render the standard 404 (correct status, no hint that the page exists).
    return NextResponse.rewrite(new URL("/admin/not-a-page", request.url), { status: 404 });
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
