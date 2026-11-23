import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Request-time only: reads the session; never prerendered.
export const instant = false;

/**
 * Shell for every signed-in admin page. Layouts do not re-run on client-side
 * navigation, so each page ALSO calls requireAdminPage(); this call only
 * provides the name and role for the menu.
 */
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const identity = await requireAdminPage();
  return <AdminShell user={{ fullName: identity.fullName, role: identity.role }}>{children}</AdminShell>;
}
