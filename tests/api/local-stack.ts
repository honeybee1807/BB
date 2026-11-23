import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

export type Db = SupabaseClient<Database>;

type LocalStack = { url: string; anonKey: string; serviceKey: string };

// Keys stay in memory and are never printed. Refuses anything but localhost.
export function readLocalStack(): LocalStack {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const vars = new Map<string, string>();
  for (const line of out.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) vars.set(match[1], match[2]);
  }
  const url = vars.get("API_URL");
  const anonKey = vars.get("ANON_KEY");
  const serviceKey = vars.get("SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) throw new Error("Local Supabase stack is not running (npm run db:start).");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("API tests only run against the local stack.");
  return { url, anonKey, serviceKey };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function client(url: string, key: string): Db {
  return createClient<Database>(url, key, noSession);
}

export async function signedInClient(stack: LocalStack, email: string, password: string): Promise<Db> {
  const c = client(stack.url, stack.anonKey);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for test user: ${error.message}`);
  return c;
}
