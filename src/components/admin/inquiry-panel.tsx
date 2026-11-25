import { ArrowUpRight, Mail, Phone, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { budget, nights, stayRange } from "@/lib/admin-format";
import type { Admin, getInquiry } from "@/lib/data/admin";
import { plural } from "@/lib/format";
import { StatusPill } from "./card";
import { InquiryEditor } from "./inquiry-editor";

type Inquiry = NonNullable<Awaited<ReturnType<typeof getInquiry>>>;

const term = "text-sm font-semibold text-navy";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-4 first:pt-0">
      <dt className={term}>{label}</dt>
      <dd className="mt-1 text-[15px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

// The selected inquiry beside the list. The full record stays on its own page.
export function InquiryPanel({
  inquiry,
  admins,
  me,
  closeHref,
}: {
  inquiry: Inquiry;
  admins: Admin[];
  me: string;
  closeHref: string;
}) {
  return (
    <section
      aria-label={`Inquiry from ${inquiry.guest_name}`}
      className="rounded-card bg-white p-6 ring-1 ring-line sm:p-8 xl:sticky xl:top-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[28px] leading-tight text-navy">{inquiry.guest_name}</h2>
          <p className="mt-1 text-sm text-muted">{inquiry.property?.name ?? "No home chosen"}</p>
        </div>
        <div className="flex items-center gap-1">
          <StatusPill status={inquiry.status} />
          <Link href={closeHref} scroll={false} className="rounded-full p-2 text-muted hover:bg-admin-bg">
            <X aria-hidden strokeWidth={1.6} className="size-4" />
            <span className="sr-only">Close this inquiry</span>
          </Link>
        </div>
      </div>

      {!inquiry.email_sent_at && (
        <p
          role="note"
          className="mt-5 flex items-start gap-2 rounded-xl bg-sand-light px-4 py-3 text-sm text-ink ring-1 ring-sand"
        >
          <TriangleAlert aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
          The notification email for this inquiry was not sent, so check whether anyone has replied.
        </p>
      )}

      <dl className="mt-6">
        <Item label="Requested dates">
          {stayRange(inquiry.check_in, inquiry.check_out)}{" "}
          <span className="text-muted">({nights(inquiry.check_in, inquiry.check_out)})</span>
        </Item>
        <Item label="Party">
          {plural(inquiry.adults, "adult", "adults")} · {plural(inquiry.children, "child", "children")} · budget{" "}
          {budget(inquiry.budget_min_zar, inquiry.budget_max_zar).toLowerCase()}
        </Item>
        <Item label="Contact">
          <a
            href={`mailto:${inquiry.guest_email}`}
            className="flex items-center gap-2 break-all text-teal underline underline-offset-2"
          >
            <Mail aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
            {inquiry.guest_email}
          </a>
          <a
            href={`tel:${inquiry.guest_phone.replace(/[^\d+]/g, "")}`}
            className="mt-1 flex items-center gap-2 text-teal underline underline-offset-2"
          >
            <Phone aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
            {inquiry.guest_phone}
          </a>
        </Item>
        <Item label="Guest note">
          {inquiry.additional_requirements ? (
            <span className="whitespace-pre-line">{inquiry.additional_requirements}</span>
          ) : (
            <span className="text-muted">None</span>
          )}
        </Item>
      </dl>

      <div className="mt-6">
        <InquiryEditor
          key={inquiry.id}
          id={inquiry.id}
          status={inquiry.status}
          assignedTo={inquiry.assigned_to}
          notes={inquiry.internal_notes ?? ""}
          admins={admins}
          me={me}
        />
      </div>

      <Link
        href={`/admin/inquiries/${inquiry.id}`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
      >
        Open the full record
        <ArrowUpRight aria-hidden strokeWidth={1.75} className="size-4" />
      </Link>
    </section>
  );
}
