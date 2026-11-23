import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { TwoFactor } from "@/components/admin/two-factor";
import { requireAdminPage } from "@/lib/auth/admin-session";

// Request-time only: reads the session; never prerendered.
export const instant = false;

export const metadata: Metadata = { title: "Account security" };

export default async function AccountPage() {
  const identity = await requireAdminPage();
  return (
    <>
      <PageHeader title="Account security" description={`Signed in as ${identity.email}`} />
      <section aria-labelledby="two-factor-heading" className="max-w-xl rounded-card bg-white p-6 shadow-sm ring-1 ring-line">
        <h2 id="two-factor-heading" className="text-lg font-semibold">
          Two-factor sign-in
        </h2>
        {identity.hasVerifiedFactor ? (
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-teal">On.</span> Each sign-in asks for a code from your authenticator app.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-4">
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">Off.</span> Recommended: once it is on, every sign-in also needs a code from your phone.
            </p>
            <TwoFactor mode="enrol" />
          </div>
        )}
      </section>
    </>
  );
}
