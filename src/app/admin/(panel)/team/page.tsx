import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import { AdminCard } from "@/components/admin/card";
import { PageHeader } from "@/components/admin/page-header";
import { InviteForm, TeamList } from "@/components/admin/team-manager";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { hasPassed } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const identity = await requireAdminPage({ ownerOnly: true });
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase.rpc("list_team"),
    supabase
      .from("team_invites")
      .select("id, email, role, sent_at, expires_at")
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .order("sent_at", { ascending: false }),
  ]);
  if (members.error || invites.error) throw new Error("Team could not be loaded");
  const pending = invites.data.map(({ expires_at, ...i }) => ({ ...i, expired: hasPassed(expires_at) }));

  return (
    <>
      <PageHeader title="Team" description="Invite team members and manage who can sign in." />
      <div className="flex flex-col gap-6">
        <AdminCard title="Team" icon={Users}>
          <TeamList members={members.data} invites={pending} currentUserId={identity.userId} />
        </AdminCard>
        <AdminCard title="Invite someone" icon={UserPlus}>
          <InviteForm />
        </AdminCard>
      </div>
    </>
  );
}
