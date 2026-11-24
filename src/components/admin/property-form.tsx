"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RegionWithEstates } from "@/lib/data/admin";
import { slugify } from "@/lib/slug";
import type { Database } from "@/types/database";
import { Checkbox, Field, inputClass, numberOrNull, SaveBar, useSave } from "./form";
import { send } from "./requests";

type Property = Database["public"]["Tables"]["properties"]["Row"];
const BLANK = {
  estate_id: "",
  name: "",
  slug: "",
  summary: "",
  description: "",
  property_type: "holiday_home",
  town: "",
  max_guests: "",
  bedrooms: "",
  bathrooms: "",
  is_halal: true,
  halal_details: "",
  price_from_zar: "",
  is_featured: false,
  featured_sort_order: "0",
  is_published: false,
  instagram_video_url: "",
  custom_fields: [] as { label: string; value: string }[],
  seo_title: "",
  seo_description: "",
};

type Form = typeof BLANK;

function fromProperty(p: Property): Form {
  const text = (v: string | null) => v ?? "";
  const num = (v: number | null) => (v === null ? "" : String(v));
  return {
    estate_id: p.estate_id,
    name: p.name,
    slug: p.slug,
    summary: text(p.summary),
    description: text(p.description),
    property_type: p.property_type,
    town: text(p.town),
    max_guests: num(p.max_guests),
    bedrooms: num(p.bedrooms),
    bathrooms: num(p.bathrooms),
    is_halal: p.is_halal,
    halal_details: text(p.halal_details),
    price_from_zar: num(p.price_from_zar),
    is_featured: p.is_featured,
    featured_sort_order: String(p.featured_sort_order),
    is_published: p.is_published,
    instagram_video_url: text(p.instagram_video_url),
    custom_fields: Array.isArray(p.custom_fields) ? (p.custom_fields as Form["custom_fields"]) : [],
    seo_title: text(p.seo_title),
    seo_description: text(p.seo_description),
  };
}

export function PropertyForm({ property, regions }: { property?: Property; regions: RegionWithEstates[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(property ? fromProperty(property) : BLANK);
  const [slugTouched, setSlugTouched] = useState(Boolean(property));
  const { status, run } = useSave();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      max_guests: numberOrNull(form.max_guests),
      bedrooms: numberOrNull(form.bedrooms),
      bathrooms: numberOrNull(form.bathrooms),
      price_from_zar: numberOrNull(form.price_from_zar),
      featured_sort_order: Number(form.featured_sort_order) || 0,
      custom_fields: form.custom_fields.filter((f) => f.label.trim()),
    };
    const result = await run(() =>
      property
        ? send(`/api/admin/properties/${property.id}`, "PATCH", body)
        : send("/api/admin/properties", "POST", body),
    );
    if (!result.ok) return;
    if (property) router.refresh();
    else router.push(`/admin/properties/${result.id}`);
  }

  const text = (key: keyof Form, label: string, props: { hint?: string; max?: number; rows?: number } = {}) => (
    <Field label={label} hint={props.hint}>
      {(a) =>
        props.rows ? (
          <textarea
            {...a}
            rows={props.rows}
            maxLength={props.max}
            value={form[key] as string}
            onChange={(e) => set(key, e.target.value as never)}
            className={`${inputClass} py-2 leading-relaxed`}
          />
        ) : (
          <input
            {...a}
            maxLength={props.max}
            value={form[key] as string}
            onChange={(e) => set(key, e.target.value as never)}
            className={`${inputClass} h-10`}
          />
        )
      }
    </Field>
  );

  const number = (key: keyof Form, label: string, min: number, max: number) => (
    <Field label={label}>
      {(a) => (
        <input
          {...a}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={form[key] as string}
          onChange={(e) => set(key, e.target.value as never)}
          className={`${inputClass} h-10`}
        />
      )}
    </Field>
  );

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-8">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-navy">The basics</legend>
        <Field label="Name">
          {(a) => (
            <input
              {...a}
              required
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
        <Field label="Web address" hint={`/properties/${form.slug || "..."}`}>
          {(a) => (
            <input
              {...a}
              required
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
        <Field label="Estate">
          {(a) => (
            <select
              {...a}
              required
              value={form.estate_id}
              onChange={(e) => set("estate_id", e.target.value)}
              className={`${inputClass} h-10`}
            >
              <option value="">Choose an estate</option>
              {regions.map((r) => (
                <optgroup key={r.id} label={r.name}>
                  {r.estates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </Field>
        <Field label="Type">
          {(a) => (
            <select
              {...a}
              value={form.property_type}
              onChange={(e) => set("property_type", e.target.value)}
              className={`${inputClass} h-10`}
            >
              <option value="holiday_home">Holiday home</option>
              <option value="resort">Resort</option>
            </select>
          )}
        </Field>
        {text("town", "Town", { max: 120 })}
        <Field label="Price from (rand a night)" hint="Leave empty to hide the price.">
          {(a) => (
            <input
              {...a}
              type="number"
              inputMode="numeric"
              min={0}
              value={form.price_from_zar}
              onChange={(e) => set("price_from_zar", e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-navy">Size</legend>
        {number("max_guests", "Guests", 1, 100)}
        {number("bedrooms", "Bedrooms", 0, 50)}
        {number("bathrooms", "Bathrooms", 0, 50)}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-sm font-semibold text-navy">Description</legend>
        {text("summary", "Short summary", { max: 300, rows: 2, hint: "Shown on listing cards." })}
        {text("description", "Full description", { max: 10000, rows: 8 })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-sm font-semibold text-navy">Halal</legend>
        <Checkbox
          label="Halal-friendly"
          checked={form.is_halal}
          onChange={(v) => set("is_halal", v)}
          hint="Shows the halal tag and includes the home in the halal filter."
        />
        {text("halal_details", "Halal details", { max: 3000, rows: 3 })}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold text-navy">Extra details</legend>
        <p className="text-xs text-muted">
          Short facts such as check-in time or parking. Shown on the home&apos;s page.
        </p>
        {form.custom_fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
            <Field label={`Label ${i + 1}`}>
              {(a) => (
                <input
                  {...a}
                  maxLength={60}
                  value={f.label}
                  onChange={(e) =>
                    set(
                      "custom_fields",
                      form.custom_fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  className={`${inputClass} h-10`}
                />
              )}
            </Field>
            <Field label={`Detail ${i + 1}`}>
              {(a) => (
                <input
                  {...a}
                  maxLength={500}
                  value={f.value}
                  onChange={(e) =>
                    set(
                      "custom_fields",
                      form.custom_fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                    )
                  }
                  className={`${inputClass} h-10`}
                />
              )}
            </Field>
            <button
              type="button"
              onClick={() =>
                set(
                  "custom_fields",
                  form.custom_fields.filter((_, j) => j !== i),
                )
              }
              className="flex size-10 items-center justify-center rounded-lg text-muted ring-1 ring-line hover:text-danger"
            >
              <Trash2 aria-hidden strokeWidth={1.5} className="size-4" />
              <span className="sr-only">Remove detail {i + 1}</span>
            </button>
          </div>
        ))}
        {form.custom_fields.length < 30 && (
          <button
            type="button"
            onClick={() => set("custom_fields", [...form.custom_fields, { label: "", value: "" }])}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg px-3 text-sm text-navy ring-1 ring-line hover:bg-admin-bg"
          >
            <Plus aria-hidden strokeWidth={1.5} className="size-4" />
            Add a detail
          </button>
        )}
        {text("instagram_video_url", "Instagram video link", { max: 300, hint: "Optional. A post or reel link." })}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-navy">Search engines</legend>
        {text("seo_title", "Page title", { max: 120, hint: "Leave empty to use the name." })}
        {text("seo_description", "Page description", { max: 320, hint: "Leave empty to use the summary." })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-sm font-semibold text-navy">On the website</legend>
        <Checkbox
          label="Published"
          checked={form.is_published}
          onChange={(v) => set("is_published", v)}
          hint="Unpublished homes are hidden from guests."
        />
        <Checkbox
          label="Featured on the homepage"
          checked={form.is_featured}
          onChange={(v) => set("is_featured", v)}
          hint="Featured homes need a cover photo to show."
        />
        {form.is_featured && (
          <div className="max-w-40">{number("featured_sort_order", "Featured order", -1000, 1000)}</div>
        )}
      </fieldset>

      <SaveBar status={status} label={property ? "Save changes" : "Create home"} />
    </form>
  );
}
