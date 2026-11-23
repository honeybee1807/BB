import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { request, type APIRequestContext } from "@playwright/test";
import { hashIdentifier } from "../src/lib/security/hash";
import { client, readLocalStack } from "../tests/api/local-stack";

// The tests compute rate-limit and audit hashes for cleanup, so they need the same
// IP_HASH_SECRET as the dev server. Load only that one value from .env.local.
if (!process.env.IP_HASH_SECRET) {
  const secret = parseEnv(readFileSync(".env.local", "utf8")).IP_HASH_SECRET;
  if (secret) process.env.IP_HASH_SECRET = secret;
}

/** Test-only helpers. Service role is used for fixtures and cleanup, never by the app under test. */
export const stack = readLocalStack();
export const admin = client(stack.url, stack.serviceKey);
const BASE_URL = "http://localhost:3000";

export const run = randomBytes(4).toString("hex");
export const password = `${randomBytes(18).toString("base64url")}Aa1!`;

/** A unique fake client IP per test, so IP rate limits do not leak between tests. */
export function uniqueIp(): string {
  const b = randomBytes(3);
  return `10.${b[0]}.${b[1]}.${b[2]}`;
}

export type TestUser = { id: string; email: string };
const created: TestUser[] = [];
const usedEmails: string[] = [];
const usedIps: string[] = [];

export async function createUser(label: string, profile?: { role: "owner" | "team_member"; isActive?: boolean; fullName?: string }): Promise<TestUser> {
  const email = `e2e-${label}-${run}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`create user ${label}: ${error?.message ?? "no user"}`);
  const user = { id: data.user.id, email };
  created.push(user);
  usedEmails.push(email);
  if (profile) {
    const { error: pErr } = await admin.from("admin_profiles").insert({
      id: user.id,
      full_name: profile.fullName ?? `E2E ${label}`,
      role: profile.role,
      is_active: profile.isActive ?? true,
    });
    if (pErr) throw new Error(`profile ${label}: ${pErr.message}`);
  }
  return user;
}

export function trackEmail(email: string) {
  usedEmails.push(email);
}

/** An API client that behaves like a same-origin browser from a given IP. Cookies persist within it. */
export async function apiAs(ip = uniqueIp()): Promise<APIRequestContext> {
  usedIps.push(ip);
  return request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { origin: BASE_URL, "x-forwarded-for": ip } });
}

export function trackIp(ip: string) {
  usedIps.push(ip);
}

export async function auditRows(filter: { actorId?: string; action: string; emailHash?: string }): Promise<number> {
  let q = admin.from("audit_log").select("id", { count: "exact", head: true }).eq("action", filter.action);
  if (filter.actorId) q = q.eq("actor_id", filter.actorId);
  if (filter.emailHash) q = q.eq("metadata->>email_hash", filter.emailHash);
  const { count } = await q;
  return count ?? 0;
}

export function emailHashPrefix(email: string): string {
  return hashIdentifier("email", email).slice(0, 16);
}

/** Removes test users, their rate-limit rows and audit rows. */
export async function cleanup(): Promise<void> {
  const keys = [
    ...usedEmails.map((e) => hashIdentifier("email", e)),
    ...usedIps.map((ip) => hashIdentifier("ip", ip)),
    ...created.map((u) => hashIdentifier("user", u.id)),
  ];
  if (keys.length) await admin.from("rate_limits").delete().in("key_hash", keys);
  const ids = created.map((u) => u.id);
  if (ids.length) await admin.from("audit_log").delete().in("actor_id", ids);
  const prefixes = usedEmails.map(emailHashPrefix);
  if (prefixes.length) await admin.from("audit_log").delete().in("metadata->>email_hash", prefixes);
  for (const u of created.splice(0)) await admin.auth.admin.deleteUser(u.id);
}
