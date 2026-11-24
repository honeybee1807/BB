import { addDays, dateParts, monthName } from "@/lib/format";

export type CalendarDay = { date: string; inMonth: boolean };

// "2026-09" for September 2026
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function isMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(key: string, long = false): string {
  const { year, month } = dateParts(`${key}-01`);
  return `${monthName(month, !long)} ${year}`;
}

// Full weeks, Monday first, covering the month. Days outside the month are flagged.
export function monthGrid(key: string): CalendarDay[][] {
  const first = `${key}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  let date = addDays(first, -weekday);
  const weeks: CalendarDay[][] = [];
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date, inMonth: monthKey(date) === key });
      date = addDays(date, 1);
    }
    weeks.push(week);
  } while (monthKey(date) === key);
  return weeks;
}

export function datesBetween(from: string, to: string): string[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const dates: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export function weekdayInitial(isoDate: string): string {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "narrow", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
