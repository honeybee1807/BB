"use client";

import { useId, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import type { Result } from "./requests";

export const inputClass =
  "w-full rounded-lg border border-field bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-teal aria-invalid:border-danger";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => React.ReactNode;
}) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-4 accent-teal"
      />
      <div>
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

type Status = { kind: "idle" | "saving" | "saved" | "error"; text: string };

// One save at a time, with the outcome read out to screen readers.
export function useSave() {
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  async function run(action: () => Promise<Result>, saved = "Saved."): Promise<Result> {
    setStatus({ kind: "saving", text: "" });
    const result = await action();
    setStatus(result.ok ? { kind: "saved", text: saved } : { kind: "error", text: result.error });
    return result;
  }
  return { status, run, busy: status.kind === "saving" };
}

export function SaveBar({ status, label = "Save changes" }: { status: Status; label?: string }) {
  const hydrated = useHydrated();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={!hydrated || status.kind === "saving"}
        className="h-10 rounded-lg bg-teal px-5 text-sm font-medium text-white hover:bg-teal-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status.kind === "saving" ? "Saving..." : label}
      </button>
      <StatusText status={status} />
    </div>
  );
}

export function StatusText({ status }: { status: Status }) {
  return (
    <p
      role={status.kind === "error" ? "alert" : "status"}
      className={`text-sm ${status.kind === "error" ? "text-danger" : "text-muted"}`}
    >
      {status.text}
    </p>
  );
}

export const numberOrNull = (value: string): number | null => (value.trim() === "" ? null : Number(value));
