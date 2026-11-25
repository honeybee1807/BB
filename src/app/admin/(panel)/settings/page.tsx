import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Page settings live on the Team & settings page.
export default async function SettingsPage() {
  await requireAdminPage({ ownerOnly: true });
  redirect("/admin/team#seo");
}
