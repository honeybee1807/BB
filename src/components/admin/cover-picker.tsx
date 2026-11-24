"use client";

import { Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { publicImageUrl } from "@/lib/storage";
import { useHydrated } from "@/lib/use-hydrated";
import { StatusText, useSave } from "./form";
import { send, uploadImage } from "./requests";

export function CoverPicker({ postId, path }: { postId: string; path: string | null }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const inputId = useId();
  const { status, run, busy } = useSave();
  const url = `/api/admin/posts/${postId}/cover`;

  async function choose(file: File | undefined) {
    if (!file) return;
    const result = await run(() => uploadImage(file, (tmp) => send(url, "PUT", { path: tmp })), "Cover photo saved.");
    if (result.ok) router.refresh();
  }

  async function clear() {
    const result = await run(() => send(url, "PUT", { path: null }), "Cover photo removed.");
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-admin-bg">
        {path ? (
          <Image src={publicImageUrl("blog-images", path)} alt="" fill unoptimized className="object-cover" />
        ) : (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            No cover photo. Posts look best with one.
          </p>
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
          {busy ? "Working..." : path ? "Replace cover" : "Add a cover"}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-muted">JPEG, PNG or WebP, up to 15 MB. Wide photos work best.</p>
      <StatusText status={status} />
    </div>
  );
}
