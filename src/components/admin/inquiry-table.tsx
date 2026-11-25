"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, House, MoreVertical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES, STATUS_LABELS, firstName, nights, stayRange, type InquiryStatus } from "@/lib/admin-format";
import type { Admin, InquiryRow } from "@/lib/data/admin";
import { publicImageUrl } from "@/lib/storage";
import { Avatar, StatusPill } from "./card";
import { updateInquiry } from "./requests";

const item = "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-admin-bg";
const menu = "z-50 min-w-48 rounded-lg bg-white p-1 text-sm text-ink shadow-lg ring-1 ring-line";

function Assignee({ id, admins }: { id: string | null; admins: Admin[] }) {
  const person = admins.find((a) => a.id === id);
  if (!person) return <span className="text-sm text-muted">Unassigned</span>;
  return (
    <span className="flex items-center gap-2 text-sm text-ink">
      <Avatar name={person.full_name} />
      {firstName(person.full_name)}
    </span>
  );
}

// photos are already 640px WebP thumbnails, so the optimiser is skipped
function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mist">
      {src ? (
        <Image src={publicImageUrl("property-photos", src)} alt="" fill unoptimized className="object-cover" />
      ) : (
        <House aria-hidden strokeWidth={1.5} className="size-4 text-muted" />
      )}
    </span>
  );
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
        className="rounded-md p-1.5 text-muted hover:bg-admin-bg hover:text-navy"
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

export function InquiryTable({ rows, admins }: { rows: InquiryRow[]; admins: Admin[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function change(id: string, update: { status?: InquiryStatus; assignedTo?: string | null }, done: string) {
    setMessage("Saving...");
    const result = await updateInquiry(id, update);
    setMessage(result.ok ? done : result.error);
    if (result.ok) router.refresh();
  }

  const open = (id: string) => router.push(`/admin/inquiries/${id}`);

  if (rows.length === 0) {
    return <p className="rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">No inquiries to show.</p>;
  }

  // sized by the card, not the screen, because the dashboard card is much narrower than the inquiries page
  return (
    <div className="@container">
      <p aria-live="polite" className="sr-only">
        {message}
      </p>

      <table className="hidden w-full text-left @3xl:table">
        <thead>
          <tr className="border-b border-line text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted uppercase">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Property
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Guest
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Dates
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Status
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Assigned to
            </th>
            <th scope="col" className="w-10 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => open(row.id)}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-admin-bg/60"
            >
              <td className="py-3 pr-3">
                <span className="flex items-center gap-3">
                  <Thumb src={row.property?.thumb ?? null} />
                  <span className="min-w-0">
                    <span className="block max-w-52 truncate text-sm font-semibold text-navy">
                      {row.property?.name ?? "No home chosen"}
                    </span>
                    {row.property && (
                      <span className="block truncate text-xs text-muted">{row.property.estate.name}</span>
                    )}
                  </span>
                </span>
              </td>
              <td className="py-3 pr-3">
                <Link
                  href={`/admin/inquiries/${row.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block text-sm font-semibold whitespace-nowrap text-navy hover:underline"
                >
                  {row.guest_name}
                </Link>
                <span className="block max-w-48 truncate text-xs text-muted" title={row.guest_email}>
                  {row.guest_email}
                </span>
              </td>
              <td className="py-3 pr-3 text-sm text-ink">
                <span className="block whitespace-nowrap">{stayRange(row.check_in, row.check_out)}</span>
                <span className="block text-xs text-muted">{nights(row.check_in, row.check_out)}</span>
              </td>
              <td className="py-3 pr-3">
                <StatusPill status={row.status} />
              </td>
              <td className="py-3 pr-3">
                <Assignee id={row.assigned_to} admins={admins} />
              </td>
              <td className="py-3 text-right">
                <RowMenu row={row} admins={admins} onChange={(u, done) => void change(row.id, u, done)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-3 @3xl:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg p-3 ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/admin/inquiries/${row.id}`} className="flex min-w-0 items-center gap-3">
                <Thumb src={row.property?.thumb ?? null} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-navy">{row.guest_name}</span>
                  <span className="block truncate text-xs text-muted">
                    {row.property ? `${row.property.name}, ${row.property.estate.name}` : "No home chosen"}
                  </span>
                </span>
              </Link>
              <RowMenu row={row} admins={admins} onChange={(u, done) => void change(row.id, u, done)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-ink">
                {stayRange(row.check_in, row.check_out)}
                <span className="text-muted"> &middot; {nights(row.check_in, row.check_out)}</span>
              </span>
              <StatusPill status={row.status} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted">{row.guest_email}</span>
              <Assignee id={row.assigned_to} admins={admins} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
