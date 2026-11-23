import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { needsTwoFactor } from "./two-factor-rule";

export type AdminRole = Database["public"]["Enums"]["admin_role"];
type UserClient = Awaited<ReturnType<typeof createClient>>;

export type AdminIdentity = {
  userId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  /** The user has a verified TOTP factor. */
  hasVerifiedFactor: boolean;
  aal: "aal1" | "aal2";
};

export type SessionState =
  | { status: "signed_out" }
  | { status: "not_admin" }
  | { status: "mfa_required"; identity: AdminIdentity }
  | { status: "ok"; identity: AdminIdentity };

/**
 * Reads the session, the caller's own admin profile and the assurance level.
 * Request-scoped only (React cache): nothing is cached across requests.
 * connection() marks this as request-time work, so Next never tries to
 * prerender it (Supabase reads the current time to check token expiry).
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed_out" };

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return { status: "not_admin" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aal?.currentLevel ?? null;
  const nextLevel = aal?.nextLevel ?? null;

  const identity: AdminIdentity = {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    hasVerifiedFactor: nextLevel === "aal2",
    aal: currentLevel === "aal2" ? "aal2" : "aal1",
  };
  if (needsTwoFactor(profile.role, currentLevel, nextLevel)) return { status: "mfa_required", identity };
  return { status: "ok", identity };
});

/**
 * For admin pages. Non-admins get the same blank 404 as a missing page;
 * an admin who still owes two-factor is sent to /admin/mfa.
 */
export async function requireAdminPage(options: { ownerOnly?: boolean } = {}): Promise<AdminIdentity> {
  const state = await getSessionState();
  if (state.status === "signed_out" || state.status === "not_admin") notFound();
  if (state.status === "mfa_required") redirect("/admin/mfa");
  if (options.ownerOnly && state.identity.role !== "owner") notFound();
  return state.identity;
}

export type ApiAuth = { identity: AdminIdentity; supabase: UserClient };

/**
 * For admin route handlers and server actions: returns the identity and the
 * user-session client, or an error Response. Never trusts ids or roles sent by the browser.
 */
export async function requireAdminApi(options: { ownerOnly?: boolean } = {}): Promise<ApiAuth | Response> {
  const state = await getSessionState();
  if (state.status === "signed_out") return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  if (state.status === "not_admin") return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  if (state.status === "mfa_required") {
    return Response.json({ ok: false, error: "Two-factor verification required.", next: "/admin/mfa" }, { status: 403 });
  }
  if (options.ownerOnly && state.identity.role !== "owner") return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  return { identity: state.identity, supabase: await createClient() };
}

/**
 * For the two-factor routes only: an active admin with any assurance level
 * (enrolment and verification happen at aal1 by definition).
 */
export async function requireActiveAdminAnyLevel(): Promise<ApiAuth | Response> {
  const state = await getSessionState();
  if (state.status === "signed_out") return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  if (state.status === "not_admin") return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  return { identity: state.identity, supabase: await createClient() };
}
