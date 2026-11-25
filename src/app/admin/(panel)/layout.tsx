import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

// reads the session on every request
export const instant = false;

// Layouts don't re-run on client navigation, so every page checks access as well.
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const identity = await requireAdminPage();
  const supabase = await createClient();
  const { count } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .is("deleted_at", null);
  return (
    <AdminShell user={{ fullName: identity.fullName, role: identity.role }} newCount={count ?? 0}>
      {children}
    </AdminShell>
  );
}
