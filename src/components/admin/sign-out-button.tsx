"use client";

import { useState } from "react";

/** Signs out through the server route (which audits it), then goes to the login page. */
export async function signOut(reason: "user" | "idle" = "user"): Promise<void> {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  } finally {
    window.location.assign(reason === "idle" ? "/admin/login?reason=idle" : "/admin/login?reason=signed_out");
  }
}

export function SignOutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut("user");
      }}
    >
      {children ?? "Sign out"}
    </button>
  );
}
