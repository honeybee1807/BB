"use client";

import { ArrowDown, ArrowUp, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { PropertyPhoto } from "@/lib/data/admin";
import { publicImageUrl } from "@/lib/storage";
import { useHydrated } from "@/lib/use-hydrated";
import { inputClass, StatusText, useSave } from "./form";
import { send, uploadImage } from "./requests";

const MAX = 20;
const iconButton =
  "flex size-9 items-center justify-center rounded-lg text-navy ring-1 ring-line hover:bg-admin-bg disabled:opacity-40";

export function PhotoManager({ propertyId, photos }: { propertyId: string; photos: PropertyPhoto[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const inputId = useId();
  const { status, run, busy } = useSave();
  const [alts, setAlts] = useState<Record<string, string>>({});

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX - photos.length;
    const chosen = Array.from(files).slice(0, room);
    await run(
      async () => {
        for (const file of chosen) {
          const result = await uploadImage(file, (path) =>
            send(`/api/admin/properties/${propertyId}/photos`, "POST", { path, alt_text: "" }),
          );
          if (!result.ok) return result;
        }
        return { ok: true };
      },
      `${chosen.length} ${chosen.length === 1 ? "photo" : "photos"} added.${files.length > chosen.length ? ` ${files.length - chosen.length} skipped: the limit is ${MAX}.` : ""} Add a description to each one.`,
    );
    router.refresh();
  }

  async function act(action: () => Promise<{ ok: true } | { ok: false; error: string }>, saved: string) {
    const result = await run(action, saved);
    if (result.ok) router.refresh();
  }

  const move = (index: number, by: number) => {
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    return act(() => send(`/api/admin/properties/${propertyId}/photos`, "PUT", { ids }), "Order saved.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal ${
            !hydrated || busy || photos.length >= MAX ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Upload aria-hidden strokeWidth={1.5} className="size-4" />
          {busy ? "Working..." : "Add photos"}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={!hydrated || busy || photos.length >= MAX}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
          />
        </label>
        <p className="text-xs text-muted">
          JPEG, PNG or WebP, up to 15 MB each. {photos.length} of {MAX} used.
        </p>
      </div>
      <StatusText status={status} />

      {photos.length === 0 ? (
        <p className="rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">
          No photos yet. The first one you add becomes the cover.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-lg p-3 ring-1 ring-line sm:flex-row sm:items-center">
              <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-md bg-admin-bg sm:w-36">
                <Image
                  src={publicImageUrl("property-photos", p.thumb_path)}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
                {p.is_cover && (
                  <span className="absolute top-1.5 left-1.5 rounded-pill bg-navy px-2 py-0.5 text-[11px] font-medium text-white">
                    Cover
                  </span>
                )}
              </div>
              <form
                method="post"
                className="flex flex-1 items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    () => send(`/api/admin/photos/${p.id}`, "PATCH", { alt_text: alts[p.id] ?? p.alt_text }),
                    "Description saved.",
                  );
                }}
              >
                <div className="flex-1">
                  <label htmlFor={`alt-${p.id}`} className="mb-1 block text-xs font-medium text-muted">
                    Description for screen readers (photo {i + 1})
                  </label>
                  <input
                    id={`alt-${p.id}`}
                    maxLength={250}
                    value={alts[p.id] ?? p.alt_text}
                    placeholder="For example: Lounge with sea views"
                    onChange={(e) => setAlts((a) => ({ ...a, [p.id]: e.target.value }))}
                    className={`${inputClass} h-9`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || (alts[p.id] ?? p.alt_text) === p.alt_text}
                  className="h-9 rounded-lg px-3 text-sm text-navy ring-1 ring-line hover:bg-admin-bg disabled:opacity-40"
                >
                  Save
                </button>
              </form>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || i === 0}
                  onClick={() => void move(i, -1)}
                  className={iconButton}
                >
                  <ArrowUp aria-hidden strokeWidth={1.5} className="size-4" />
                  <span className="sr-only">Move photo {i + 1} up</span>
                </button>
                <button
                  type="button"
                  disabled={busy || i === photos.length - 1}
                  onClick={() => void move(i, 1)}
                  className={iconButton}
                >
                  <ArrowDown aria-hidden strokeWidth={1.5} className="size-4" />
                  <span className="sr-only">Move photo {i + 1} down</span>
                </button>
                <button
                  type="button"
                  disabled={busy || p.is_cover}
                  onClick={() =>
                    void act(() => send(`/api/admin/photos/${p.id}`, "PATCH", { is_cover: true }), "Cover changed.")
                  }
                  className={iconButton}
                >
                  <Star aria-hidden strokeWidth={1.5} className="size-4" />
                  <span className="sr-only">Make photo {i + 1} the cover</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete photo ${i + 1}? This can't be undone.`)) {
                      void act(() => send(`/api/admin/photos/${p.id}`, "DELETE"), "Photo deleted.");
                    }
                  }}
                  className={`${iconButton} hover:text-danger`}
                >
                  <Trash2 aria-hidden strokeWidth={1.5} className="size-4" />
                  <span className="sr-only">Delete photo {i + 1}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
