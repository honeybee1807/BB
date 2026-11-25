import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import type { Database } from "@/types/database";

const PUBLIC_ADMIN_PAGES = new Set(["/admin/login", "/admin/invite"]);

// Admin paths only, so public pages stay static. Refreshes the session (the refresh
// token rotates) and returns the 404 early for admin pages when there's no session.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  if (isAdminPage && !user && !PUBLIC_ADMIN_PAGES.has(path)) {
    return NextResponse.rewrite(new URL("/admin/not-a-page", request.url), { status: 404 });
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
