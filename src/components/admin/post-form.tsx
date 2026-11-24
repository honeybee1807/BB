"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify } from "@/lib/slug";
import type { Database } from "@/types/database";
import { Checkbox, Field, inputClass, SaveBar, StatusText, useSave } from "./form";
import { send } from "./requests";

type Post = Database["public"]["Tables"]["blog_posts"]["Row"];

export function PostForm({ post, canDelete }: { post?: Post; canDelete?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    body_md: post?.body_md ?? "",
    is_published: post?.is_published ?? false,
    seo_title: post?.seo_title ?? "",
    seo_description: post?.seo_description ?? "",
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const { status, run } = useSave();
  const remover = useSave();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() =>
      post ? send(`/api/admin/posts/${post.id}`, "PATCH", form) : send("/api/admin/posts", "POST", form),
    );
    if (!result.ok) return;
    if (post) router.refresh();
    else router.push(`/admin/journal/${result.id}`);
  }

  async function remove() {
    if (!post || !window.confirm(`Delete "${post.title}"? It will be taken off the website.`)) return;
    const result = await remover.run(() => send(`/api/admin/posts/${post.id}`, "DELETE"), "Deleted.");
    if (result.ok) router.push("/admin/journal");
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          {(a) => (
            <input
              {...a}
              maxLength={160}
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        <Field label="Web address" hint={`/journal/${form.slug || "..."}`}>
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
      </div>
      <Field label="Short introduction" hint="Shown on the Journal page and in search results.">
        {(a) => (
          <textarea
            {...a}
            rows={2}
            maxLength={300}
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            className={`${inputClass} py-2 leading-relaxed`}
          />
        )}
      </Field>
      <Field
        label="Post"
        hint="Leave a blank line between paragraphs. Start a line with ## for a heading or - for a list. Write **bold** for bold and [link text](https://example.com) for a link."
      >
        {(a) => (
          <textarea
            {...a}
            rows={18}
            maxLength={50000}
            value={form.body_md}
            onChange={(e) => set("body_md", e.target.value)}
            className={`${inputClass} py-2 font-mono text-[13px] leading-relaxed`}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Page title for search engines" hint="Leave empty to use the title.">
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
        <Field label="Page description for search engines" hint="Leave empty to use the introduction.">
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
      <Checkbox
        label="Published"
        checked={form.is_published}
        onChange={(v) => set("is_published", v)}
        hint="Drafts are only visible here."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveBar status={status} label={post ? "Save changes" : "Create post"} />
        {post && canDelete && (
          <div className="flex items-center gap-3">
            <StatusText status={remover.status} />
            <button
              type="button"
              onClick={() => void remove()}
              disabled={remover.busy}
              className="h-10 rounded-lg px-4 text-sm text-danger ring-1 ring-line hover:bg-admin-bg"
            >
              Delete post
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
