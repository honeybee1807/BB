import type { Metadata } from "next";
import Image from "next/image";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Join the team", robots: { index: false, follow: false } };

export default function InvitePage() {
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
        <h1 className="mt-6 text-lg font-semibold text-ink">Set up your account</h1>
        <AcceptForm />
      </div>
    </main>
  );
}
