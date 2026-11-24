"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Database } from "@/types/database";
import { Checkbox, Field, inputClass, SaveBar, StatusText, useSave } from "./form";
import { send } from "./requests";

type Testimonial = Database["public"]["Tables"]["testimonials"]["Row"];

export function TestimonialForm({ item, canDelete }: { item?: Testimonial; canDelete?: boolean }) {
  const router = useRouter();
  const blank = { guest_name: "", place: "", quote: "", is_visible: false, sort_order: "0" };
  const [form, setForm] = useState(
    item
      ? {
          guest_name: item.guest_name,
          place: item.place ?? "",
          quote: item.quote,
          is_visible: item.is_visible,
          sort_order: String(item.sort_order),
        }
      : blank,
  );
  const { status, run } = useSave();
  const remover = useSave();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, sort_order: Number(form.sort_order) || 0 };
    const result = await run(
      () =>
        item
          ? send(`/api/admin/testimonials/${item.id}`, "PATCH", body)
          : send("/api/admin/testimonials", "POST", body),
      item ? "Saved." : "Testimonial added.",
    );
    if (!result.ok) return;
    if (!item) setForm(blank);
    router.refresh();
  }

  async function remove() {
    if (!item || !window.confirm(`Delete the testimonial from ${item.guest_name}?`)) return;
    const result = await remover.run(() => send(`/api/admin/testimonials/${item.id}`, "DELETE"), "Deleted.");
    if (result.ok) router.refresh();
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
        <Field label="Guest name">
          {(a) => (
            <input
              {...a}
              maxLength={80}
              value={form.guest_name}
              onChange={(e) => set("guest_name", e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        <Field label="Where they're from" hint="Optional, for example Johannesburg.">
          {(a) => (
            <input
              {...a}
              maxLength={80}
              value={form.place}
              onChange={(e) => set("place", e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        <Field label="Order">
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
      <Field label="What they said" hint="Only add words the guest has agreed to share.">
        {(a) => (
          <textarea
            {...a}
            rows={3}
            maxLength={600}
            value={form.quote}
            onChange={(e) => set("quote", e.target.value)}
            className={`${inputClass} py-2 leading-relaxed`}
          />
        )}
      </Field>
      <Checkbox
        label="Show on the website"
        checked={form.is_visible}
        onChange={(v) => set("is_visible", v)}
        hint="The homepage shows up to three visible testimonials."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveBar status={status} label={item ? "Save changes" : "Add testimonial"} />
        {item && canDelete && (
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
