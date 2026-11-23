import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-card bg-white p-8 shadow-sm ring-1 ring-line">
        <p className="font-serif text-2xl uppercase tracking-display text-navy">Bargain Breaks</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">Admin sign in</h1>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
