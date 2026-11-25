"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES, STATUS_LABELS, firstName, nights, stayRange, type InquiryStatus } from "@/lib/admin-format";
import type { Admin, InquiryRow } from "@/lib/data/admin";
import { StatusPill, tableHead } from "./card";
import { updateInquiry } from "./requests";

const item = "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-highlighted:bg-admin-bg";
const menu = "admin-theme z-50 min-w-48 rounded-xl bg-white p-1 text-sm text-ink shadow-lg ring-1 ring-line";

// someone deactivated since keeps the id; removing them clears it instead
function claimLine(id: string | null, admins: Admin[]): string {
  if (!id) return "Waiting to be claimed";
  const person = admins.find((a) => a.id === id);
  return person ? `Claimed by ${firstName(person.full_name)}` : "Previously assigned";
}

function RowMenu({
  row,
  admins,
  onChange,
}: {
  row: InquiryRow;
  admins: Admin[];
  onChange: (change: { status?: InquiryStatus; assignedTo?: string | null }, done: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        onClick={(e) => e.stopPropagation()}
        className="rounded-full p-2 text-muted hover:bg-frost hover:text-navy"
      >
        <MoreVertical aria-hidden strokeWidth={1.5} className="size-4" />
        <span className="sr-only">Actions for {row.guest_name}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menu} onClick={(e) => e.stopPropagation()}>
          <DropdownMenu.Item asChild className={item}>
            <Link href={`/admin/inquiries/${row.id}`}>View details</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={`${item} justify-between`}>
              Assign to
              <ChevronRight aria-hidden strokeWidth={1.5} className="size-4" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className={menu} sideOffset={4}>
                <DropdownMenu.RadioGroup
                  value={row.assigned_to ?? "none"}
                  onValueChange={(v) => {
                    const id = v === "none" ? null : v;
                    const who = admins.find((a) => a.id === id)?.full_name;
                    onChange({ assignedTo: id }, who ? `Assigned to ${who}.` : "Marked as unassigned.");
                  }}
                >
                  {[{ id: "none", full_name: "Unassigned" }, ...admins].map((a) => (
                    <DropdownMenu.RadioItem key={a.id} value={a.id} className={item}>
                      <span className="w-4">
                        <DropdownMenu.ItemIndicator>
                          <Check aria-hidden strokeWidth={1.5} className="size-4" />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      {a.full_name}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={`${item} justify-between`}>
              Change status
              <ChevronRight aria-hidden strokeWidth={1.5} className="size-4" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className={menu} sideOffset={4}>
                <DropdownMenu.RadioGroup
                  value={row.status}
                  onValueChange={(v) =>
                    onChange({ status: v as InquiryStatus }, `Status changed to ${STATUS_LABELS[v as InquiryStatus]}.`)
                  }
                >
                  {STATUSES.map((s) => (
                    <DropdownMenu.RadioItem key={s} value={s} className={item}>
                      <span className="w-4">
                        <DropdownMenu.ItemIndicator>
                          <Check aria-hidden strokeWidth={1.5} className="size-4" />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      {STATUS_LABELS[s]}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function InquiryTable({
  rows,
  admins,
  query,
  selected,
}: {
  rows: InquiryRow[];
  admins: Admin[];
  query: string;
  selected: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function change(id: string, update: { status?: InquiryStatus; assignedTo?: string | null }, done: string) {
    setMessage("Saving...");
    const result = await updateInquiry(id, update);
    setMessage(result.ok ? done : result.error);
    if (result.ok) router.refresh();
  }

  // the panel opens beside the list and keeps the current filters
  const viewHref = (id: string) => `/admin/inquiries?${query ? `${query}&` : ""}view=${id}`;

  if (rows.length === 0) {
    return <p className="rounded-xl bg-admin-bg px-4 py-6 text-center text-sm text-muted">No inquiries to show.</p>;
  }

  return (
    <div className="@container">
      <p aria-live="polite" className="sr-only">
        {message}
      </p>

      <table className="hidden w-full text-left @2xl:table">
        <thead>
          <tr className={`border-b border-line ${tableHead}`}>
            <th scope="col" className="py-3 pr-4 pl-4 font-semibold">
              Guest
            </th>
            <th scope="col" className="py-3 pr-4 font-semibold">
              Property
            </th>
            <th scope="col" className="py-3 pr-4 font-semibold">
              Dates
            </th>
            <th scope="col" className="py-3 pr-4 font-semibold">
              Status
            </th>
            <th scope="col" className="w-12 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(viewHref(row.id), { scroll: false })}
              aria-current={row.id === selected ? "true" : undefined}
              className={`cursor-pointer border-b border-line last:border-0 ${row.id === selected ? "bg-frost" : "hover:bg-admin-bg/70"}`}
            >
              <td className="py-4 pr-4 pl-4">
                <Link
                  href={viewHref(row.id)}
                  scroll={false}
                  onClick={(e) => e.stopPropagation()}
                  className="block font-semibold whitespace-nowrap text-navy hover:underline"
                >
                  {row.guest_name}
                </Link>
                <span className="mt-0.5 block text-sm text-muted">{claimLine(row.assigned_to, admins)}</span>
              </td>
              <td className="py-4 pr-4 text-ink">
                <span className="block max-w-56 truncate">{row.property?.name ?? "No home chosen"}</span>
              </td>
              <td className="py-4 pr-4 text-ink">
                <span className="block whitespace-nowrap">{stayRange(row.check_in, row.check_out)}</span>
                <span className="block text-sm text-muted">{nights(row.check_in, row.check_out)}</span>
              </td>
              <td className="py-4 pr-4">
                <StatusPill status={row.status} />
              </td>
              <td className="py-4 text-right">
                <RowMenu row={row} admins={admins} onChange={(u, done) => void change(row.id, u, done)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-3 @2xl:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`rounded-2xl p-4 ring-1 ${row.id === selected ? "bg-frost ring-sand" : "ring-line"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <Link href={viewHref(row.id)} scroll={false} className="min-w-0">
                <span className="block truncate font-semibold text-navy">{row.guest_name}</span>
                <span className="block truncate text-sm text-muted">{claimLine(row.assigned_to, admins)}</span>
              </Link>
              <RowMenu row={row} admins={admins} onChange={(u, done) => void change(row.id, u, done)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-ink">
                {row.property?.name ?? "No home chosen"}
                <span className="text-muted"> · {stayRange(row.check_in, row.check_out)}</span>
              </span>
              <StatusPill status={row.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
