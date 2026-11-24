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

// The local gateway on Docker for Windows sometimes drops a kept-alive connection.
// Status 0 means the request never got a reply; gateway errors (502 to 504) are not retried.
function isDroppedConnection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AuthRetryableFetchError" &&
    (error as { status?: unknown }).status === 0
  );
}

type UserCreator = Pick<Db["auth"]["admin"], "createUser">;

export async function createAuthUser(
  db: { auth: { admin: UserCreator } },
  email: string,
  password: string,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (data.user) return data.user.id;
    if (attempt === 1 && isDroppedConnection(error)) {
      console.warn("create user: connection dropped, retrying once");
      continue;
    }
    throw new Error(`create user: ${error?.message ?? "no user"}`, { cause: error });
  }
}
