import { ArrowLeft, ExternalLink, ImageIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard } from "@/components/admin/card";
import { CoverPicker } from "@/components/admin/cover-picker";
import { PageHeader } from "@/components/admin/page-header";
import { PostForm } from "@/components/admin/post-form";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { getPostAdmin } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: PageProps<"/admin/journal/[id]">) {
  const identity = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const post = await getPostAdmin(await createClient(), id);
  if (!post) notFound();

  return (
    <>
      <Link href="/admin/journal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy hover:underline">
        <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" />
        All posts
      </Link>
      <PageHeader title={post.title} description={post.is_published ? "Published" : "Draft"} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AdminCard
          title="Post"
          action={
            post.is_published && (
              <a
                href={`/journal/${post.slug}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-sm text-navy hover:underline"
              >
                View on the website
                <ExternalLink aria-hidden strokeWidth={1.5} className="size-4" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )
          }
        >
          <PostForm post={post} canDelete={identity.role === "owner"} />
        </AdminCard>
        <AdminCard title="Cover photo" icon={ImageIcon} className="self-start">
          <CoverPicker postId={post.id} path={post.featured_image_path} />
        </AdminCard>
      </div>
    </>
  );
}
