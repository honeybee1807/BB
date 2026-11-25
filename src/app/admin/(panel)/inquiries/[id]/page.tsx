import { ArrowLeft, Mail, Phone, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, StatusPill } from "@/components/admin/card";
import { InquiryEditor } from "@/components/admin/inquiry-editor";
import { PageHeader } from "@/components/admin/page-header";
import { ACCOMMODATION_LABELS, budget, nights, stayRange } from "@/lib/admin-format";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { activeAdmins, getInquiry } from "@/lib/data/admin";
import { plural } from "@/lib/format";
import { formatSast } from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Inquiry" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function InquiryPage({ params }: PageProps<"/admin/inquiries/[id]">) {
  const identity = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [inquiry, admins] = await Promise.all([getInquiry(supabase, id), activeAdmins(supabase)]);
  if (!inquiry) notFound();

  return (
    <>
      <Link href="/admin/inquiries" className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy hover:underline">
        <ArrowLeft aria-hidden strokeWidth={1.5} className="size-4" />
        All inquiries
      </Link>
      <PageHeader title={inquiry.guest_name} description={`Received ${formatSast(new Date(inquiry.created_at))}`} />
      <p className="-mt-4 mb-6 flex items-center gap-2 text-sm text-muted">
        Status <StatusPill status={inquiry.status} />
      </p>

      {!inquiry.email_sent_at && (
        <p
          role="note"
          className="mb-6 flex items-start gap-2 rounded-lg bg-sand-light px-4 py-3 text-sm text-ink ring-1 ring-sand"
        >
          <TriangleAlert aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
          The notification email for this inquiry was not sent, so check whether anyone has replied.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <AdminCard title="Guest">
            <dl>
              <Row label="Name">{inquiry.guest_name}</Row>
              <Row label="Email">
                <a
                  href={`mailto:${inquiry.guest_email}`}
                  className="inline-flex items-center gap-1.5 text-navy underline underline-offset-2"
                >
                  <Mail aria-hidden strokeWidth={1.5} className="size-4" />
                  {inquiry.guest_email}
                </a>
              </Row>
              <Row label="Phone">
                <a
                  href={`tel:${inquiry.guest_phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-1.5 text-navy underline underline-offset-2"
                >
                  <Phone aria-hidden strokeWidth={1.5} className="size-4" />
                  {inquiry.guest_phone}
                </a>
              </Row>
            </dl>
          </AdminCard>

          <AdminCard title="Stay">
            <dl>
              <Row label="Home">
                {inquiry.property ? (
                  `${inquiry.property.name}, ${inquiry.property.estate.name}`
                ) : (
                  <span className="text-muted">No home chosen</span>
                )}
              </Row>
              <Row label="Dates">
                {stayRange(inquiry.check_in, inquiry.check_out)}{" "}
                <span className="text-muted">({nights(inquiry.check_in, inquiry.check_out)})</span>
              </Row>
              <Row label="Guests">
                {plural(inquiry.adults, "adult", "adults")}, {plural(inquiry.children, "child", "children")}
              </Row>
              <Row label="Budget">{budget(inquiry.budget_min_zar, inquiry.budget_max_zar)}</Row>
              <Row label="Accommodation">{ACCOMMODATION_LABELS[inquiry.accommodation_type]}</Row>
              <Row label="Requirements">
                {inquiry.additional_requirements ? (
                  <span className="whitespace-pre-line">{inquiry.additional_requirements}</span>
                ) : (
                  <span className="text-muted">None</span>
                )}
              </Row>
            </dl>
          </AdminCard>

          <AdminCard title="Record">
            <dl>
              <Row label="Received">{formatSast(new Date(inquiry.created_at))}</Row>
              <Row label="Consent given">{formatSast(new Date(inquiry.consent_given_at))}</Row>
              <Row label="Email to team">
                {inquiry.email_sent_at ? formatSast(new Date(inquiry.email_sent_at)) : "Not sent"}
              </Row>
            </dl>
          </AdminCard>
        </div>

        <AdminCard title="Manage" className="self-start">
          <InquiryEditor
            id={inquiry.id}
            status={inquiry.status}
            assignedTo={inquiry.assigned_to}
            notes={inquiry.internal_notes ?? ""}
            admins={admins}
            me={identity.userId}
          />
        </AdminCard>
      </div>
    </>
  );
}
