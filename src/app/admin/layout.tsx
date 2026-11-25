import type { Metadata } from "next";

// admin pages read the session on every request
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Bargain Breaks Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="admin-theme flex min-h-full flex-1 flex-col bg-admin-bg text-ink">{children}</div>;
}
