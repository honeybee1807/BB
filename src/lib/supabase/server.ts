import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import { authCookieOptions } from "./cookie-options";

// Acts as the signed-in user, so RLS applies.
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
            cookieStore.set(name, value, {
              ...options,
              ...authCookieOptions,
              maxAge: options.maxAge === 0 ? 0 : authCookieOptions.maxAge,
            });
          }
        } catch {
          // read-only in Server Components, src/proxy.ts refreshes the session instead
        }
      },
    },
  });
}
