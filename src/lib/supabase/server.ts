import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import { authCookieOptions } from "./cookie-options";

/**
 * Supabase client acting as the signed-in user (anon key + session cookie),
 * so Row Level Security applies to every query. Use this for all admin reads
 * and writes.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, { ...options, ...authCookieOptions, maxAge: options.maxAge === 0 ? 0 : authCookieOptions.maxAge });
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // src/proxy.ts refreshes the session on every admin request instead.
        }
      },
    },
  });
}
