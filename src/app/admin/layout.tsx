import type { Metadata } from "next";

// Admin pages read the session on every request and are never prerendered or cached.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Bargain Breaks Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col bg-admin-bg text-ink">{children}</div>;
}
