import type { Database } from "@/types/database";
import { dateParts, daysBetween, formatRand, monthName } from "@/lib/format";

export type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  claimed: "Claimed",
  answered: "Answered",
  closed: "Closed",
};

export const STATUSES = Object.keys(STATUS_LABELS) as InquiryStatus[];

export type AdminRole = Database["public"]["Enums"]["admin_role"];

export const ROLE_LABELS: Record<AdminRole, string> = { owner: "Owner", team_member: "Team member" };

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

// e.g. "Just now", "14 min ago", "3 hours ago", "Yesterday", then the date
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  if (hours < 48) return "Yesterday";
  return dateRangeLabel(iso.slice(0, 10), iso.slice(0, 10));
}

const SAST_HOUR = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "numeric", hour12: false });

export function greeting(now: Date = new Date()): string {
  const hour = Number(SAST_HOUR.format(now)) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function budget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Not given";
  if (min !== null && max !== null) return `${formatRand(min)} to ${formatRand(max)}`;
  return min !== null ? `From ${formatRand(min)}` : `Up to ${formatRand(max!)}`;
}
