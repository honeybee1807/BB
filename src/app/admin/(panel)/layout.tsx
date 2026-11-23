import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/admin-session";

// reads the session on every request
export const instant = false;

// Layouts don't re-run on client navigation, so every page checks access as well.
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const identity = await requireAdminPage();
  return <AdminShell user={{ fullName: identity.fullName, role: identity.role }}>{children}</AdminShell>;
}
