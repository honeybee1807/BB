"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dateRangeLabel } from "@/lib/admin-format";
import { datesBetween, monthGrid, monthKey, monthLabel, shiftMonth } from "@/lib/calendar";
import { addDays, dateParts } from "@/lib/format";
import { changeAvailability } from "./requests";

type Home = { id: string; name: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const small = "inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium";

export function AvailabilityCalendar({
  homes,
  homeId,
  month,
  blocked,
  today,
}: {
  homes: Home[];
  homeId: string | null;
  month: string;
  blocked: string[];
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const grid = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState(blocked);
  const [nights, setNights] = useState(() => new Set(blocked));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [focus, setFocus] = useState(() => (monthKey(today) === month ? today : `${month}-01`));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // a new month, home or save from the server replaces local state
  if (source !== blocked) {
    setSource(blocked);
    setNights(new Set(blocked));
  }
  const home = homes.find((h) => h.id === homeId) ?? null;
  // one day is always in the Tab order, even after the month changes by button
  const tabDate = monthKey(focus) === month ? focus : monthKey(today) === month ? today : `${month}-01`;
  const weeks = monthGrid(month);

  useEffect(() => {
    if (!grid.current?.contains(document.activeElement)) return;
    grid.current.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus, month]);

  function go(update: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(update)) next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function moveTo(date: string) {
    setFocus(date);
    if (monthKey(date) !== month) go({ month: monthKey(date) });
  }

  function choose(date: string) {
    if (date < today || monthKey(date) !== month) return;
    if (!start || end) {
      setStart(date);
      setEnd(null);
      setMessage(`${dateRangeLabel(date, date)} selected. Choose another day for a range, or confirm below.`);
    } else if (date === start) {
      setStart(null);
      setMessage("Selection cleared.");
    } else {
      setEnd(date);
      const [a, b] = start < date ? [start, date] : [date, start];
      setMessage(`${dateRangeLabel(a, b)} selected. Confirm below.`);
    }
  }

  async function apply(action: "block" | "open") {
    if (!home || !start) return;
    const [from, to] = !end || start < end ? [start, end ?? start] : [end, start];
    const dates = datesBetween(from, to);
    const before = nights;
    const next = new Set(nights);
    for (const d of dates) {
      if (action === "block") next.add(d);
      else next.delete(d);
    }
    setNights(next);
    setBusy(true);
    setMessage("Saving...");
    const result = await changeAvailability(home.id, from, to, action);
    setBusy(false);
    if (result.ok) {
      setMessage(`${dateRangeLabel(from, to)} ${action === "block" ? "blocked" : "opened"}.`);
      setStart(null);
      setEnd(null);
      router.refresh();
    } else {
      setNights(before);
      setMessage(result.error);
    }
  }

  function onKey(e: React.KeyboardEvent, date: string) {
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      Home: () => addDays(date, -weekday),
      End: () => addDays(date, 6 - weekday),
      PageUp: () => `${shiftMonth(month, -1)}-${String(Math.min(dateParts(date).day, 28)).padStart(2, "0")}`,
      PageDown: () => `${shiftMonth(month, 1)}-${String(Math.min(dateParts(date).day, 28)).padStart(2, "0")}`,
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveTo(moves[e.key]!());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(date);
    }
  }

  const range = start ? (end ? datesBetween(start, end) : [start]) : [];
  const rangeLabel = start
    ? dateRangeLabel(...((!end || start < end ? [start, end ?? start] : [end, start]) as [string, string]))
    : "";
  const allBlocked = range.length > 0 && range.every((d) => nights.has(d));
  const noneBlocked = range.length > 0 && range.every((d) => !nights.has(d));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="calendar-home">
          Home
        </label>
        <select
          id="calendar-home"
          value={homeId ?? ""}
          onChange={(e) => {
            setStart(null);
            setEnd(null);
            go({ home: e.target.value });
          }}
          className="h-12 min-w-0 flex-1 rounded-xl border border-field bg-white px-4 text-[15px] text-ink"
        >
          {homes.length === 0 && <option value="">No homes yet</option>}
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <div className="flex h-12 items-center rounded-xl border border-field bg-white">
          <button
            type="button"
            onClick={() => go({ month: shiftMonth(month, -1) })}
            className="flex size-12 items-center justify-center rounded-l-xl hover:bg-admin-bg"
          >
            <ChevronLeft aria-hidden strokeWidth={1.5} className="size-4" />
            <span className="sr-only">Previous month</span>
          </button>
          <span id="calendar-month" className="min-w-28 text-center text-[15px] font-semibold text-navy">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => go({ month: shiftMonth(month, 1) })}
            className="flex size-12 items-center justify-center rounded-r-xl hover:bg-admin-bg"
          >
            <ChevronRight aria-hidden strokeWidth={1.5} className="size-4" />
            <span className="sr-only">Next month</span>
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {message}
      </p>

      {home ? (
        <div
          ref={grid}
          role="grid"
          aria-label={`${home.name}, ${monthLabel(month, true)}`}
          className="mt-6 flex flex-col gap-1.5 sm:gap-2.5"
        >
          <div role="row" className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {WEEKDAYS.map((d, i) => (
              <span
                key={d}
                role="columnheader"
                aria-label={WEEKDAY_NAMES[i]}
                className="py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-muted uppercase"
              >
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]!.date} role="row" className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {week.map(({ date, inMonth }) => {
                const isBlocked = nights.has(date);
                const past = date < today;
                const selected = range.includes(date);
                const isToday = date === today;
                const status = isBlocked ? "Blocked" : "Open";
                if (!inMonth) {
                  return (
                    <span
                      key={date}
                      role="gridcell"
                      aria-disabled="true"
                      aria-label={`${dateRangeLabel(date, date)}, ${status.toLowerCase()}`}
                      className="aspect-square sm:aspect-auto sm:h-24"
                    />
                  );
                }
                return (
                  <span
                    key={date}
                    role="gridcell"
                    data-date={date}
                    tabIndex={date === tabDate ? 0 : -1}
                    aria-selected={selected}
                    aria-disabled={past || undefined}
                    onClick={() => choose(date)}
                    onKeyDown={(e) => onKey(e, date)}
                    onFocus={() => setFocus(date)}
                    className={[
                      "flex aspect-square flex-col items-center justify-center rounded-xl text-sm ring-1 transition-colors duration-150 sm:aspect-auto sm:h-24 sm:items-start sm:justify-between sm:p-3",
                      past ? "cursor-default opacity-50" : "cursor-pointer hover:ring-2 hover:ring-teal",
                      isBlocked ? "bg-navy text-white ring-navy" : "bg-white text-ink ring-line",
                      isToday ? "ring-2 ring-teal" : "",
                      selected ? "outline-2 outline-offset-2 outline-teal" : "",
                    ].join(" ")}
                  >
                    {/* the name is built from this text so it always contains what is on screen */}
                    <span className="font-semibold">{dateParts(date).day}</span>
                    <span className="sr-only"> {monthLabel(month, true)},</span>
                    <span className={`sr-only text-xs sm:not-sr-only ${isBlocked ? "text-white/80" : "text-muted"}`}>
                      {" "}
                      {status}
                    </span>
                    {isToday && <span className="sr-only">, today</span>}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">
          Add a home to manage its dates.
        </p>
      )}

      {start && home && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-admin-bg p-3 text-sm">
          <span className="mr-auto text-ink">
            {rangeLabel}
            {!end && <span className="text-muted"> (choose another day for a range)</span>}
          </span>
          {!allBlocked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply("block")}
              className={`${small} bg-navy text-white hover:bg-navy-hover disabled:opacity-60`}
            >
              {end ? "Block these dates" : "Block this day"}
            </button>
          )}
          {!noneBlocked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply("open")}
              className={`${small} bg-teal text-white hover:bg-teal-hover disabled:opacity-60`}
            >
              {end ? "Open these dates" : "Open this day"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setStart(null);
              setEnd(null);
              setMessage("Selection cleared.");
            }}
            className={`${small} border border-line bg-white text-navy hover:bg-white/70`}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
