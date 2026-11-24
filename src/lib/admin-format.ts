import type { Database } from "@/types/database";
import { dateParts, daysBetween, monthName } from "@/lib/format";

export type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  in_progress: "In progress",
  actioned: "Actioned",
};

export const STATUSES = Object.keys(STATUS_LABELS) as InquiryStatus[];

export const ACCOMMODATION_LABELS = {
  no_preference: "No preference",
  resort: "Resort",
  holiday_home: "Holiday home",
} as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// 12 - 15 Sep 2026, 28 Sep - 2 Oct 2026, 30 Dec 2026 - 2 Jan 2027
export function stayRange(checkIn: string, checkOut: string): string {
  const a = dateParts(checkIn);
  const b = dateParts(checkOut);
  const end = `${b.day} ${monthName(b.month, true)} ${b.year}`;
  if (a.year !== b.year) return `${a.day} ${monthName(a.month, true)} ${a.year} - ${end}`;
  if (a.month !== b.month) return `${a.day} ${monthName(a.month, true)} - ${end}`;
  return `${a.day} - ${end}`;
}

export function nights(checkIn: string, checkOut: string): string {
  const n = daysBetween(checkIn, checkOut);
  return `${n} ${n === 1 ? "Night" : "Nights"}`;
}

// e.g. 14 to 16 September 2026, or 14 September 2026 for a single day
export function dateRangeLabel(from: string, to: string): string {
  const full = (iso: string) => {
    const d = dateParts(iso);
    return `${d.day} ${monthName(d.month)} ${d.year}`;
  };
  if (from === to) return full(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dateParts(from).day} to ${full(to)}`;
  return `${full(from)} to ${full(to)}`;
}

export type Change = { direction: "up" | "down" | "none"; text: string };

// Inquiry counts compare as a percentage; a rate compares in percentage points.
export function countChange(current: number, previous: number, period: string): Change {
  if (previous === 0) {
    return current === 0
      ? { direction: "none", text: `No change ${period}` }
      : { direction: "none", text: `No earlier data ${period}` };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { direction: "none", text: `No change ${period}` };
  return { direction: pct > 0 ? "up" : "down", text: `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% ${period}` };
}

export function pointsChange(current: number | null, previous: number | null, period: string): Change {
  if (current === null || previous === null) return { direction: "none", text: `No earlier data ${period}` };
  const diff = current - previous;
  if (diff === 0) return { direction: "none", text: `No change ${period}` };
  return {
    direction: diff > 0 ? "up" : "down",
    text: `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "point" : "points"} ${period}`,
  };
}

// Whole percentage of open nights, or null when there is nothing to measure.
export function openRate(totalNights: number, blockedNights: number): number | null {
  if (totalNights <= 0) return null;
  return Math.round(((totalNights - blockedNights) / totalNights) * 100);
}
