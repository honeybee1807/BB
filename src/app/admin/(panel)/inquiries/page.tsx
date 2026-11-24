import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AdminCard, outlineButton } from "@/components/admin/card";
import { InquiryTable } from "@/components/admin/inquiry-table";
import { PageHeader } from "@/components/admin/page-header";
import { STATUSES, STATUS_LABELS, type InquiryStatus } from "@/lib/admin-format";
import { requireAdminPage } from "@/lib/auth/admin-session";
import { PAGE_SIZE, activeAdmins, adminProperties, listInquiries, type InquiryFilters } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";
import { searchInquiries } from "./actions";
import { SEARCH_COOKIE } from "./search";

export const instant = false;

export const metadata: Metadata = { title: "Inquiries" };

const field = "h-9 w-full rounded-lg border border-field bg-white px-3 text-sm text-ink";
const label = "mb-1 block text-xs font-medium text-muted";

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function InquiriesPage({ searchParams }: PageProps<"/admin/inquiries">) {
  await requireAdminPage();
  const params = await searchParams;
  const supabase = await createClient();

  // unknown values are ignored rather than passed to the database
  const status = one(params.status);
  const property = one(params.property);
  const assignee = one(params.assignee);
  const from = one(params.from);
  const to = one(params.to);
  const q = (await cookies()).get(SEARCH_COOKIE)?.value.slice(0, 100) ?? "";
  const filters: InquiryFilters = {
    status: STATUSES.includes(status as InquiryStatus) ? (status as InquiryStatus) : undefined,
    property: isUuid(property) ? property : undefined,
    assignee: assignee === "unassigned" || isUuid(assignee) ? assignee : undefined,
    from: isDate(from) ? from : undefined,
    to: isDate(to) ? to : undefined,
    q: q || undefined,
  };
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);

  const [{ rows, total }, admins, homes] = await Promise.all([
    listInquiries(supabase, filters, page),
    activeAdmins(supabase),
    adminProperties(supabase),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(filters).some(Boolean);

  const kept = new URLSearchParams();
  for (const [k, v] of Object.entries({ status, property, assignee, from, to })) if (v) kept.set(k, v);
  const back = kept.size ? `?${kept.toString()}` : "";

  const pageLink = (n: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, property, assignee, from, to })) if (v) next.set(k, v);
    next.set("page", String(n));
    return `/admin/inquiries?${next.toString()}`;
  };

  return (
    <>
      <PageHeader title="Inquiries" description="Every guest inquiry, its status and who is handling it." />

      <div className="mb-6 rounded-card bg-white p-5 shadow-sm ring-1 ring-line">
        <form action={searchInquiries} className="flex flex-wrap items-end gap-3 border-b border-line pb-4">
          <input type="hidden" name="back" value={back} />
          <div className="min-w-56 flex-1">
            <label htmlFor="q" className={label}>
              Search name or email
            </label>
            <input id="q" name="q" type="search" defaultValue={q} maxLength={100} className={field} />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-hover"
          >
            Search
          </button>
          {q && (
            <button type="submit" name="q" value="" className="h-9 text-sm text-navy underline underline-offset-4">
              Clear search
            </button>
          )}
        </form>
        <form method="get" className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="status" className={label}>
                Status
              </label>
              <select id="status" name="status" defaultValue={filters.status ?? ""} className={field}>
                <option value="">Any status</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="property" className={label}>
                Home
              </label>
              <select id="property" name="property" defaultValue={filters.property ?? ""} className={field}>
                <option value="">Any home</option>
                {homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="assignee" className={label}>
                Assigned to
              </label>
              <select id="assignee" name="assignee" defaultValue={filters.assignee ?? ""} className={field}>
                <option value="">Anyone</option>
                <option value="unassigned">Unassigned</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className={label}>Received</legend>
              <label className="sr-only" htmlFor="from">
                Received from
              </label>
              <input id="from" name="from" type="date" defaultValue={filters.from} className={field} />
              <label className="sr-only" htmlFor="to">
                Received up to
              </label>
              <input id="to" name="to" type="date" defaultValue={filters.to} className={field} />
            </fieldset>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              className="h-9 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-hover"
            >
              Show inquiries
            </button>
            {back && (
              <Link href="/admin/inquiries" className="text-sm text-navy underline underline-offset-4">
                Clear filters
              </Link>
            )}
          </div>
        </form>
      </div>

      <AdminCard title={`${total} ${total === 1 ? "inquiry" : "inquiries"}${filtered ? " match" : ""}`} icon={Inbox}>
        <InquiryTable rows={rows} admins={admins} />
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? (
              <Link href={pageLink(page - 1)} className={outlineButton}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={pageLink(page + 1)} className={outlineButton}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </AdminCard>
    </>
  );
}
