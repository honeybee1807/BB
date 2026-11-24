"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify } from "@/lib/slug";
import { Field, inputClass, SaveBar, StatusText, useSave } from "./form";
import { send } from "./requests";

type Place = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  region_id?: string;
};

const EMPTY: Place = { name: "", slug: "", description: null, sort_order: 0, seo_title: null, seo_description: null };

// Regions and estates share their fields; an estate also picks its region.
export function PlaceForm({
  kind,
  place,
  regions,
  regionId,
  canDelete,
}: {
  kind: "region" | "estate";
  place?: Place;
  regions?: { id: string; name: string }[];
  regionId?: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const start = place ?? { ...EMPTY, region_id: regionId };
  const [form, setForm] = useState({
    name: start.name,
    slug: start.slug,
    description: start.description ?? "",
    sort_order: String(start.sort_order),
    seo_title: start.seo_title ?? "",
    seo_description: start.seo_description ?? "",
    region_id: start.region_id ?? "",
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(place));
  const { status, run } = useSave();
  const remover = useSave();
  const base = kind === "region" ? "/api/admin/regions" : "/api/admin/estates";
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { region_id, ...rest } = form;
    const body = { ...rest, sort_order: Number(form.sort_order) || 0, ...(kind === "estate" ? { region_id } : {}) };
    const result = await run(
      () => (place?.id ? send(`${base}/${place.id}`, "PATCH", body) : send(base, "POST", body)),
      place ? "Saved." : `${kind === "region" ? "Region" : "Estate"} added.`,
    );
    if (!result.ok) return;
    if (!place) setForm({ ...form, name: "", slug: "", description: "", seo_title: "", seo_description: "" });
    if (!place) setSlugTouched(false);
    router.refresh();
  }

  async function remove() {
    if (!place?.id || !window.confirm(`Delete ${place.name}? This can't be undone.`)) return;
    const result = await remover.run(() => send(`${base}/${place.id}`, "DELETE"), "Deleted.");
    if (result.ok) router.refresh();
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label={place?.name}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          {(a) => (
            <input
              {...a}
              maxLength={120}
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        <Field label="Web address" hint="Lowercase letters, numbers and hyphens.">
          {(a) => (
            <input
              {...a}
              maxLength={120}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        {kind === "estate" && regions && (
          <Field label="Region">
            {(a) => (
              <select
                {...a}
                value={form.region_id}
                onChange={(e) => set("region_id", e.target.value)}
                className={`${inputClass} h-10`}
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Order" hint="Lower numbers are listed first.">
          {(a) => (
            <input
              {...a}
              type="number"
              inputMode="numeric"
              value={form.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
      </div>
      <Field label="Description">
        {(a) => (
          <textarea
            {...a}
            rows={3}
            maxLength={10000}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${inputClass} py-2 leading-relaxed`}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Page title for search engines" hint="Leave empty to use the name.">
          {(a) => (
            <input
              {...a}
              maxLength={120}
              value={form.seo_title}
              onChange={(e) => set("seo_title", e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        <Field label="Page description for search engines">
          {(a) => (
            <input
              {...a}
              maxLength={320}
              value={form.seo_description}
              onChange={(e) => set("seo_description", e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveBar status={status} label={place ? "Save changes" : `Add ${kind}`} />
        {canDelete && (
          <div className="flex items-center gap-3">
            <StatusText status={remover.status} />
            <button
              type="button"
              onClick={() => void remove()}
              disabled={remover.busy}
              className="h-10 rounded-lg px-4 text-sm text-danger ring-1 ring-line hover:bg-admin-bg"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
