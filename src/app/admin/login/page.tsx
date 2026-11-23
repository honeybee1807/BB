import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-card bg-white p-8 shadow-sm ring-1 ring-line">
        <Image
          src="/images/logo.webp"
          alt="Bargain Breaks"
          width={760}
          height={382}
          preload
          sizes="320px"
          className="mx-auto w-full max-w-xs"
        />
        <h1 className="mt-6 text-lg font-semibold text-ink">Admin sign in</h1>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
