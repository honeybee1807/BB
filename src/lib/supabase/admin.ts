import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Bypasses RLS. Only for the inquiry insert, rate limits, audit writes, storage writes,
// invitations and owner purges. Never log the key.
let adminClient: SupabaseClient<Database> | undefined;

export function getAdminClient(): SupabaseClient<Database> {
  if (!adminClient) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Server is missing its database service configuration.");
    adminClient = createClient<Database>(publicEnv.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
