"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { acceptFormSchema, type AcceptFormInput } from "@/lib/validation/team";

const subscribe = (change: () => void) => {
  window.addEventListener("hashchange", change);
  return () => window.removeEventListener("hashchange", change);
};

// The token arrives after the # in the email link, so only the browser ever sees it.
function useInviteToken(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => null,
  );
}

const field = "rounded-md border border-line bg-white px-3 py-2 text-base";

export function AcceptForm() {
  const token = useInviteToken();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptFormInput>({
    resolver: zodResolver(acceptFormSchema),
    defaultValues: { fullName: "", password: "", confirm: "" },
  });

  if (token === "") {
    return (
      <p role="alert" className="mt-6 text-sm text-ink">
        This link is incomplete. Open it straight from your invite email, or ask for a new invite.
      </p>
    );
  }

  async function onSubmit({ fullName, password }: AcceptFormInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/admin/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, password }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (body.ok) {
        router.push("/admin/login?reason=joined");
        return;
      }
      setServerError(body.error ?? "Your account wasn't set up. Please try again.");
    } catch {
      setServerError("Your account wasn't set up. Please check your connection and try again.");
    }
  }

  const fields = [
    { name: "fullName", label: "Your name", type: "text", autoComplete: "name" },
    { name: "password", label: "Choose a password", type: "password", autoComplete: "new-password" },
    { name: "confirm", label: "Type the password again", type: "password", autoComplete: "new-password" },
  ] as const;

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
      {fields.map((f) => {
        const error = errors[f.name]?.message;
        return (
          <div key={f.name} className="flex flex-col gap-1">
            <label htmlFor={f.name} className="text-sm font-medium">
              {f.label}
            </label>
            <input
              id={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={
                [f.name === "password" && "password-hint", error && `${f.name}-error`].filter(Boolean).join(" ") ||
                undefined
              }
              className={field}
              {...register(f.name)}
            />
            {f.name === "password" && (
              <p id="password-hint" className="text-xs text-muted">
                At least 12 characters. A short sentence is easy to remember.
              </p>
            )}
            {error && (
              <p id={`${f.name}-error`} className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        );
      })}
      {serverError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={token === null || isSubmitting}
        className="rounded-md bg-navy px-4 py-2.5 font-medium text-white hover:bg-navy-deep disabled:opacity-60"
      >
        {isSubmitting ? "Setting up..." : "Set up account"}
      </button>
    </form>
  );
}
