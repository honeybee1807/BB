"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

const REASONS: Record<string, string> = {
  idle: "You were signed out after 30 minutes without activity.",
  signed_out: "You have been signed out.",
};

export function LoginForm() {
  const reason = useSearchParams().get("reason");
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json()) as { ok: boolean; error?: string; next?: string };
      if (body.ok && body.next) {
        window.location.assign(body.next);
        return;
      }
      setServerError(body.error ?? "Sign in failed. Please try again.");
    } catch {
      setServerError("Sign in failed. Please check your connection and try again.");
    }
  }

  const notice = reason ? REASONS[reason] : undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
      {notice && (
        <p role="status" className="rounded-md bg-sand-light px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="rounded-md border border-line bg-white px-3 py-2 text-base"
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-danger">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="rounded-md border border-line bg-white px-3 py-2 text-base"
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-danger">
            {errors.password.message}
          </p>
        )}
      </div>
      {serverError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-navy px-4 py-2.5 font-medium text-white hover:bg-navy-deep disabled:opacity-60"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
