import { BookOpen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { listPostsAdmin } from "@/lib/data/admin";
import { formatLongDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Journal" };

export default async function JournalAdminPage() {
  await requireAdminPage();
  const posts = await listPostsAdmin(await createClient());

  return (
    <>
      <PageHeader title="Journal" description="Write, publish and update posts for the Journal." />
      <AdminCard
        title={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
        icon={BookOpen}
        action={
          <Link
            href="/admin/journal/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal px-3 text-sm font-medium text-white hover:bg-teal-hover"
          >
            <Plus aria-hidden strokeWidth={1.5} className="size-4" />
            Write a post
          </Link>
        }
      >
        {posts.length === 0 ? (
          <p className="rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">
            No posts yet. Your first one will appear here as a draft.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/journal/${p.id}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {p.is_published && p.published_at
                      ? `Published ${formatLongDate(p.published_at)}`
                      : `Draft, last saved ${formatLongDate(p.updated_at)}`}
                  </p>
                </div>
                <PublishToggle url={`/api/admin/posts/${p.id}`} published={p.is_published} name={p.title} />
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </>
  );
}
