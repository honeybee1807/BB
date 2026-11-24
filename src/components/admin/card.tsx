import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { STATUS_LABELS, initials, type InquiryStatus } from "@/lib/admin-format";

export function AdminCard({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`rounded-card bg-white p-5 shadow-sm ring-1 ring-line ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2.5 text-[15px] font-semibold text-navy">
          {Icon && <Icon aria-hidden strokeWidth={1.5} className="size-[18px] text-navy" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const outlineButton =
  "inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-medium text-navy hover:bg-admin-bg";

const PILL: Record<InquiryStatus, string> = {
  new: "bg-sand-light text-navy ring-1 ring-sand",
  claimed: "bg-teal-light text-teal",
  answered: "bg-teal text-white",
  closed: "bg-admin-bg text-muted ring-1 ring-line",
};

export function StatusPill({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inline-flex rounded-pill px-2.5 py-1 text-xs font-medium whitespace-nowrap ${PILL[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-frost font-semibold text-navy ring-1 ring-line ${
        size === "sm" ? "size-7 text-[11px]" : "size-9 text-sm"
      }`}
    >
      {initials(name)}
    </span>
  );
}
