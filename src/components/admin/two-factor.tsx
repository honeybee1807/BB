"use client";

import { useId, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";

type Props = { mode: "verify"; factorId: string } | { mode: "enrol" };

type EnrolData = { factorId: string; qrCode: string; secret: string };

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string; next?: string } & Partial<EnrolData>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; error?: string; next?: string } & Partial<EnrolData>;
}

export function TwoFactor(props: Props) {
  const codeId = useId();
  const errorId = useId();
  const [enrol, setEnrol] = useState<EnrolData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  const factorId = props.mode === "verify" ? props.factorId : enrol?.factorId;

  async function startEnrolment() {
    setBusy(true);
    setError(null);
    try {
      const body = await postJson("/api/admin/mfa/enroll", {});
      if (body.ok && body.factorId && body.qrCode && body.secret) {
        setEnrol({ factorId: body.factorId, qrCode: body.qrCode, secret: body.secret });
      } else {
        setError(body.error ?? "We couldn't start two-factor set-up. Please try again.");
      }
    } catch {
      setError("We couldn't start two-factor set-up. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await postJson("/api/admin/mfa/verify", { factorId, code });
      if (body.ok) {
        window.location.assign(body.next ?? "/admin");
        return;
      }
      setError(body.error ?? "That code is not correct.");
      setCode("");
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (props.mode === "enrol" && !enrol) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password. You will scan a
          QR code, then enter the 6-digit code it shows.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={startEnrolment}
          disabled={!hydrated || busy}
          className="self-start rounded-md bg-navy px-4 py-2.5 font-medium text-white hover:bg-navy-deep disabled:opacity-60"
        >
          {busy ? "Preparing..." : "Set up two-factor sign-in"}
        </button>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={verify} noValidate className="flex flex-col gap-4">
      {enrol && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">1. Scan this QR code with your authenticator app.</p>
          {/* data URI from Supabase Auth, so next/image doesn't apply */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrol.qrCode}
            alt="QR code for setting up two-factor sign-in"
            width={180}
            height={180}
            className="rounded-md bg-white p-2 ring-1 ring-line"
          />
          <p className="text-sm text-muted">
            Can&apos;t scan it? Enter this setup key instead:{" "}
            <code className="break-all rounded bg-admin-bg px-1.5 py-0.5 font-mono text-ink">{enrol.secret}</code>
          </p>
          <p className="text-sm text-muted">2. Enter the 6-digit code from the app.</p>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={codeId} className="text-sm font-medium">
          Authentication code
        </label>
        <input
          id={codeId}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
          className="w-40 rounded-md border border-line bg-white px-3 py-2 font-mono text-lg tracking-[0.3em]"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!hydrated || busy}
        className="self-start rounded-md bg-navy px-4 py-2.5 font-medium text-white hover:bg-navy-deep disabled:opacity-60"
      >
        {busy ? "Checking..." : "Verify"}
      </button>
    </form>
  );
}
