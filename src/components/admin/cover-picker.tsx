"use client";

import { Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { publicImageUrl } from "@/lib/storage";
import { useHydrated } from "@/lib/use-hydrated";
import { StatusText, useSave } from "./form";
import { send, uploadImage } from "./requests";

// One image for a post cover or a page's share image. The route processes the upload.
export function CoverPicker({
  url,
  bucket,
  path,
  noun,
  empty,
  hint = "JPEG, PNG or WebP, up to 15 MB. Wide photos work best.",
  body = (upload) => ({ path: upload }),
}: {
  url: string;
  bucket: "blog-images" | "property-photos";
  path: string | null;
  noun: string;
  empty: string;
  hint?: string;
  body?: (upload: string | null) => unknown;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const inputId = useId();
  const hintId = useId();
  const { status, run, busy } = useSave();
  const Noun = noun[0]!.toUpperCase() + noun.slice(1);

  async function choose(file: File | undefined) {
    if (!file) return;
    const result = await run(() => uploadImage(file, (tmp) => send(url, "PUT", body(tmp))), `${Noun} saved.`);
    if (result.ok) router.refresh();
  }

  async function clear() {
    const result = await run(() => send(url, "PUT", body(null)), `${Noun} removed.`);
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-admin-bg">
        {path ? (
          <Image src={publicImageUrl(bucket, path)} alt="" fill unoptimized className="object-cover" />
        ) : (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">{empty}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal ${
            !hydrated || busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Upload aria-hidden strokeWidth={1.5} className="size-4" />
          {busy ? "Working..." : path ? `Replace ${noun}` : `Add ${noun}`}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={hintId}
            disabled={!hydrated || busy}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="sr-only"
          />
        </label>
        {path && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clear()}
            className="h-10 rounded-lg px-4 text-sm text-navy ring-1 ring-line hover:bg-admin-bg"
          >
            Remove<span className="sr-only"> {noun}</span>
          </button>
        )}
      </div>
      <p id={hintId} className="text-xs text-muted">
        {hint}
      </p>
      <StatusText status={status} />
    </div>
  );
}
