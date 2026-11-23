import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// No cookies, so public pages can be prerendered and cached. RLS limits it to published rows.
let publicClient: SupabaseClient<Database> | undefined;

export function getPublicClient(): SupabaseClient<Database> {
  publicClient ??= createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return publicClient;
}
