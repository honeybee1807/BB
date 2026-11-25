import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { SeoPageForm } from "@/components/admin/seo-page-form";
import { TeamSection } from "@/components/admin/team-manager";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { formatLongDate, hasPassed } from "@/lib/format";
import { PAGE_SEO, SEO_PATHS } from "@/lib/seo-pages";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Team & settings" };

export default async function TeamPage() {
  const identity = await requireAdminPage({ ownerOnly: true });
  const supabase = await createClient();
  const [members, invites, pages] = await Promise.all([
    supabase.rpc("list_team"),
    supabase
      .from("team_invites")
      .select("id, email, role, sent_at, expires_at")
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .order("sent_at", { ascending: false }),
    supabase.from("seo_pages").select("path, title, description, og_image_path, updated_at, updated_by"),
  ]);
  if (members.error || invites.error || pages.error) throw new Error("Team and settings could not be loaded");
  const pending = invites.data.map(({ expires_at, ...i }) => ({ ...i, expired: hasPassed(expires_at) }));
  const changedBy = (id: string | null) =>
    members.data.find((m) => m.id === id)?.full_name ?? "someone no longer on the team";

  return (
    <>
      <PageHeader title="Team & settings" />
      <div className="flex flex-col gap-6">
        <TeamSection members={members.data} invites={pending} currentUserId={identity.userId} />

        <div id="seo" className="scroll-mt-6 pt-4">
          <h2 className="font-serif text-[26px] text-navy sm:text-[30px]">Page settings</h2>
          <p className="mt-1.5 text-sm text-muted">
            How each page appears in search results and when it is shared. Leave a field empty to use the default.
          </p>
        </div>
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
