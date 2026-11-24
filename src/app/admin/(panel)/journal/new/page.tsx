import type { Metadata } from "next";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { PostForm } from "@/components/admin/post-form";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Write a post" };

export default async function NewPostPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="Write a post"
        description="Posts start as drafts. You can add a cover photo once it is saved."
      />
      <AdminCard title="Post">
        <PostForm />
      </AdminCard>
    </>
  );
}
