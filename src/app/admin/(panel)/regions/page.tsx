import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Regions and estates are managed at the bottom of the Properties page.
export default async function RegionsPage() {
  await requireAdminPage({ ownerOnly: true });
  redirect("/admin/properties#regions");
}
