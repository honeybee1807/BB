import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * SERVICE ROLE client. Bypasses Row Level Security.
 *
 * Allowed uses ONLY: public inquiry insert, rate limits, audit writes, storage
 * writes, user invitations and owner-only purges. Everything else uses the
 * signed-in user's client (src/lib/supabase/server.ts).
 *
 * This is the only module that may read SUPABASE_SERVICE_ROLE_KEY. Never log it.
 */
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
