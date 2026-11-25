import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { SeoPageForm } from "@/components/admin/seo-page-form";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { formatLongDate } from "@/lib/format";
import { PAGE_SEO, SEO_PATHS } from "@/lib/seo-pages";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdminPage({ ownerOnly: true });
  const supabase = await createClient();
  const [pages, team] = await Promise.all([
    supabase.from("seo_pages").select("path, title, description, og_image_path, updated_at, updated_by"),
    supabase.rpc("list_team"),
  ]);
  if (pages.error || team.error) throw new Error("Settings could not be loaded");

  const changedBy = (id: string | null) =>
    team.data.find((m) => m.id === id)?.full_name ?? "someone no longer on the team";

  return (
    <>
      <PageHeader
        title="Settings"
        description="How each page appears in search results and when it is shared. Leave a field empty to use the default."
      />
      <div className="flex flex-col gap-6">
        {SEO_PATHS.map((path) => {
          const row = pages.data.find((p) => p.path === path);
          return (
            <SeoPageForm
              key={path}
              page={path}
              label={PAGE_SEO[path].label}
              title={row?.title ?? ""}
              description={row?.description ?? ""}
              image={row?.og_image_path ?? null}
              changed={
                row?.updated_by
                  ? `Last changed on ${formatLongDate(row.updated_at)} by ${changedBy(row.updated_by)}.`
                  : "Not changed here yet."
              }
            />
          );
        })}
      </div>
    </>
  );
}
