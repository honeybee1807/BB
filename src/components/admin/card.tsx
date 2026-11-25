import { useId } from "react";
import { STATUS_LABELS, initials, type InquiryStatus } from "@/lib/admin-format";

export function AdminCard({
  title,
  description,
  action,
  children,
  className = "",
  id,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`scroll-mt-6 rounded-card bg-white p-5 ring-1 ring-line sm:p-8 ${className}`}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="font-serif text-[26px] leading-tight text-navy sm:text-[30px]">
            {title}
          </h2>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const primaryButton =
  "inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white shadow-lg shadow-navy/20 hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-60";

export const outlineButton =
  "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy hover:bg-admin-bg";

export const tableHead = "text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap text-muted uppercase";

const PILL: Record<InquiryStatus, string> = {
  new: "bg-sand-light text-navy",
  claimed: "bg-frost text-teal ring-1 ring-sand",
  answered: "bg-teal text-white",
  closed: "bg-admin-bg text-muted ring-1 ring-line",
};

export const pill = "inline-flex rounded-pill px-3 py-1 text-xs font-semibold whitespace-nowrap";

export function StatusPill({ status }: { status: InquiryStatus }) {
  return <span className={`${pill} ${PILL[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-7 text-[11px]", md: "size-10 text-sm", lg: "size-16 text-2xl" };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-frost font-serif text-navy ${sizes[size]}`}
    >
      {initials(name)}
    </span>
  );
}
