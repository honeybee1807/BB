"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { send } from "./requests";

export function PublishToggle({
  url,
  published,
  name,
  field = "is_published",
}: {
  url: string;
  published: boolean;
  name: string;
  field?: "is_published" | "is_visible";
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    const result = await send(url, "PATCH", { [field]: !published });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={`${field === "is_visible" ? "Shown" : "Published"}: ${name}`}
        disabled={!hydrated || busy}
        onClick={() => void toggle()}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-60 ${published ? "bg-teal" : "bg-field"}`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${published ? "translate-x-5" : ""}`}
        />
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
