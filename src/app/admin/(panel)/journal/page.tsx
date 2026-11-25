import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, pill, primaryButton, tableHead } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { TestimonialsManager } from "@/components/admin/testimonials-manager";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { listPostsAdmin, listTestimonialsAdmin, type PostListRow } from "@/lib/data/admin";
import { formatLongDate, plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Journal" };

function Status({ post }: { post: PostListRow }) {
  return post.is_published ? (
    <span className={`${pill} bg-frost text-teal`}>Published</span>
  ) : (
    <span className={`${pill} bg-sand-light text-navy`}>Draft</span>
  );
}

const when = (p: PostListRow) =>
  p.is_published && p.published_at ? formatLongDate(p.published_at) : `Saved ${formatLongDate(p.updated_at)}`;

function EditLink({ post }: { post: PostListRow }) {
  return (
    <Link
      href={`/admin/journal/${post.id}`}
      className="inline-flex size-9 items-center justify-center rounded-full text-teal hover:bg-frost"
    >
      <Pencil aria-hidden strokeWidth={1.6} className="size-4" />
      <span className="sr-only">Edit {post.title}</span>
    </Link>
  );
}

export default async function JournalAdminPage() {
  const identity = await requireAdminPage();
  const supabase = await createClient();
  const [posts, testimonials] = await Promise.all([listPostsAdmin(supabase), listTestimonialsAdmin(supabase)]);
  const published = posts.filter((p) => p.is_published).length;

  return (
    <>
      <PageHeader title="Journal" />
      <div className="flex flex-col gap-6">
        <AdminCard
          title="Journal posts"
          description={`${published} published · ${plural(posts.length - published, "draft", "drafts")}`}
          action={
            <Link href="/admin/journal/new" className={primaryButton}>
              <Plus aria-hidden strokeWidth={2} className="size-4" />
              Add new post
            </Link>
          }
        >
          {posts.length === 0 ? (
            <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">
              No posts yet. Your first one will appear here as a draft.
            </p>
          ) : (
            <div className="@container">
              <table className="hidden w-full text-left @2xl:table">
                <thead>
                  <tr className={`border-b border-line ${tableHead}`}>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Post
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      Published
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold">
                      On the site
                    </th>
                    <th scope="col" className="w-12 py-3">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="py-5 pr-4">
                        <Link href={`/admin/journal/${p.id}`} className="font-semibold text-navy hover:underline">
                          {p.title}
                        </Link>
                        <span className="mt-1 block text-sm text-muted">/{p.slug}</span>
                      </td>
                      <td className="py-5 pr-4">
                        <Status post={p} />
                      </td>
                      <td className="py-5 pr-4 text-ink">{when(p)}</td>
                      <td className="py-5 pr-4">
                        <PublishToggle url={`/api/admin/posts/${p.id}`} published={p.is_published} name={p.title} />
                      </td>
                      <td className="py-5 text-right">
                        <EditLink post={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="flex flex-col gap-3 @2xl:hidden">
                {posts.map((p) => (
                  <li key={p.id} className="rounded-2xl p-4 ring-1 ring-line">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/journal/${p.id}`} className="font-semibold text-navy hover:underline">
                          {p.title}
                        </Link>
                        <p className="mt-1 truncate text-sm text-muted">/{p.slug}</p>
                      </div>
                      <EditLink post={p} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
                      <span className="flex items-center gap-3">
                        <Status post={p} />
                        {when(p)}
                      </span>
                      <PublishToggle url={`/api/admin/posts/${p.id}`} published={p.is_published} name={p.title} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AdminCard>

        <TestimonialsManager items={testimonials} canDelete={identity.role === "owner"} />
      </div>
    </>
  );
}
