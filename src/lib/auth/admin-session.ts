import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { needsTwoFactor } from "./two-factor-rule";

type AdminRole = Database["public"]["Enums"]["admin_role"];
type UserClient = Awaited<ReturnType<typeof createClient>>;

type AdminIdentity = {
  userId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  hasVerifiedFactor: boolean;
};

type SessionState =
  | { status: "signed_out" }
  | { status: "not_admin" }
  | { status: "mfa_required"; identity: AdminIdentity }
  | { status: "ok"; identity: AdminIdentity };

// connection() keeps this request-time. Supabase reads the clock to check token expiry.
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
  };
  if (needsTwoFactor(profile.role, currentLevel, nextLevel)) return { status: "mfa_required", identity };
  return { status: "ok", identity };
});

// Non-admins get the same 404 as a missing page.
export async function requireAdminPage(options: { ownerOnly?: boolean } = {}): Promise<AdminIdentity> {
  const state = await getSessionState();
  if (state.status === "signed_out" || state.status === "not_admin") notFound();
  if (state.status === "mfa_required") redirect("/admin/mfa");
  if (options.ownerOnly && state.identity.role !== "owner") notFound();
  return state.identity;
}

type ApiAuth = { identity: AdminIdentity; supabase: UserClient };

// The two-factor routes run before aal2, so any level is allowed here.
export async function requireSignedInAdmin(): Promise<ApiAuth | Response> {
  const state = await getSessionState();
  if (state.status === "signed_out") return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  if (state.status === "not_admin") return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  return { identity: state.identity, supabase: await createClient() };
}
