import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { TwoFactor } from "@/components/admin/two-factor";
import { getSessionState } from "@/lib/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default async function MfaPage() {
  const state = await getSessionState();
  if (state.status === "signed_out" || state.status === "not_admin") notFound();
  if (state.status === "ok") redirect("/admin");

  const { identity } = state;
  let verifiedFactorId: string | undefined;
  if (identity.hasVerifiedFactor) {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    verifiedFactorId = data?.totp.find((f) => f.status === "verified")?.id;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow-sm ring-1 ring-line">
        <p className="font-serif text-2xl uppercase tracking-display text-navy">Bargain Breaks</p>
        <h1 className="mt-2 text-lg font-semibold">{verifiedFactorId ? "Enter your authentication code" : "Set up two-factor sign-in"}</h1>
        {!verifiedFactorId && identity.role === "owner" && (
          <p className="mt-2 text-sm text-muted">The owner account must use two-factor sign-in before opening the dashboard.</p>
        )}
        <div className="mt-6">{verifiedFactorId ? <TwoFactor mode="verify" factorId={verifiedFactorId} /> : <TwoFactor mode="enrol" />}</div>
        <div className="mt-6 border-t border-line pt-4">
          <SignOutButton className="text-sm text-muted underline underline-offset-2 hover:text-ink" />
        </div>
      </div>
    </main>
  );
}
