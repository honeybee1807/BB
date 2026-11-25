"use client";

import { FileSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { publicEnv } from "@/lib/env";
import { PAGE_SEO, SEO_SOFT_LIMITS, type SeoPath } from "@/lib/seo-pages";
import { AdminCard } from "./card";
import { CoverPicker } from "./cover-picker";
import { Field, SaveBar, inputClass, useSave } from "./form";
import { send } from "./requests";

function countHint(value: string, limit: number, fallback: string): string {
  const n = value.trim().length;
  if (n === 0) return `Empty, so the default is used: "${fallback}"`;
  return n > limit
    ? `${n} characters. Over about ${limit}, search results may cut this off.`
    : `${n} of about ${limit} characters.`;
}

// Roughly how a search result lays out, cut where search engines tend to cut.
function cut(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}...` : text;
}

export function SeoPageForm({
  page,
  label,
  title: savedTitle,
  description: savedDescription,
  image,
  changed,
}: {
  page: SeoPath;
  label: string;
  title: string;
  description: string;
  image: string | null;
  changed: string;
}) {
  const router = useRouter();
  const defaults = PAGE_SEO[page];
  const [title, setTitle] = useState(savedTitle);
  const [description, setDescription] = useState(savedDescription);
  const { status, run } = useSave();

  const shownTitle = title.trim() || defaults.title;
  const shownDescription = description.trim() || defaults.description;
  const site = publicEnv.siteUrl.replace(/^https?:\/\//, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => send("/api/admin/settings/seo", "PUT", { page, title, description }));
    if (result.ok) router.refresh();
  }

  return (
    <AdminCard title={label} icon={FileSearch}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label="Search title" hint={countHint(title, SEO_SOFT_LIMITS.title, defaults.title)}>
            {(a) => (
              <input
                {...a}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaults.title}
                className={`${inputClass} h-10`}
              />
            )}
          </Field>
          <Field
            label="Search description"
            hint={countHint(description, SEO_SOFT_LIMITS.description, defaults.description)}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={320}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={defaults.description}
                className={`${inputClass} py-2 leading-relaxed`}
              />
            )}
          </Field>
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Search result preview</p>
            <div aria-hidden className="rounded-lg bg-admin-bg p-4">
              <p className="truncate text-xs text-muted">
                {site}
                {page === "/" ? "" : ` › ${page.slice(1)}`}
              </p>
              <p className="mt-1 text-[17px] leading-snug text-navy">{cut(shownTitle, SEO_SOFT_LIMITS.title)}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink">
                {cut(shownDescription, SEO_SOFT_LIMITS.description)}
              </p>
            </div>
          </div>
          <SaveBar status={status} />
          <p className="text-xs text-muted">{changed}</p>
        </form>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Share image</p>
          <CoverPicker
            url="/api/admin/settings/seo/image"
            bucket="property-photos"
            path={image}
            noun="share image"
            empty="No share image. The Bargain Breaks logo is used."
            hint="Shown when this page is shared on WhatsApp or social media. JPEG, PNG or WebP, up to 15 MB. About 1200 by 630 pixels works best."
            body={(upload) => ({ page, path: upload })}
          />
        </div>
      </div>
    </AdminCard>
  );
}
