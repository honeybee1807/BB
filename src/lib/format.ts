const rand = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// e.g. R1,800, matching the approved design
export function formatRand(amount: number): string {
  return `R${rand.format(amount)}`;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// e.g. 3 March 2026
export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

// YYYY-MM-DD in South African time, so "today" doesn't flip at midnight UTC
export function todayInSast(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Fixed names, because locale data differs between machines (en-ZA gives "Sept" and "02").
export function monthName(month: number, short = false): string {
  const name = MONTHS[month - 1] ?? "";
  return short ? name.slice(0, 3) : name;
}

// Splits YYYY-MM-DD into numbers.
export function dateParts(isoDate: string): { year: number; month: number; day: number } {
  const [year = 0, month = 0, day = 0] = isoDate.split("-").map(Number);
  return { year, month, day };
}
