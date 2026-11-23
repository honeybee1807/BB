import type { Metadata } from "next";
import { NotBuiltYet, PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin-session";

export const instant = false;

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requireAdminPage({ ownerOnly: true });
  return (
    <>
      <PageHeader title="Team" description="Invite team members and manage access." />
      <NotBuiltYet />
    </>
  );
}
