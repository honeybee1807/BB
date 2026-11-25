import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lookupFor, routeExists } from "@/lib/route-exists";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import type { Database } from "@/types/database";

const PUBLIC_ADMIN_PAGES = new Set(["/admin/login", "/admin/invite"]);

// Public detail pages: a real 404 for addresses that do not exist (see route-exists.ts).
async function publicDetail(request: NextRequest): Promise<NextResponse> {
  const lookup = lookupFor(request.nextUrl.pathname);
  const exists = lookup === "missing" ? false : lookup === null ? true : await routeExists(lookup);
  if (exists === false) return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
  return NextResponse.next();
}

// Admin paths refresh the session (the refresh token rotates) and return the 404 early
// for admin pages when there's no session.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/admin") && !path.startsWith("/api/admin")) return publicDetail(request);
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

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  if (isAdminPage && !user && !PUBLIC_ADMIN_PAGES.has(path)) {
    return NextResponse.rewrite(new URL("/admin/not-a-page", request.url), { status: 404 });
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*", "/properties/:path+", "/journal/:path+", "/regions/:path+"],
};
