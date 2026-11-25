"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateRangeLabel } from "@/lib/admin-format";
import { weekdayInitial } from "@/lib/calendar";
import { dateParts } from "@/lib/format";
import { changeAvailability } from "./requests";

type Home = { id: string; name: string };

function Mark({ blocked }: { blocked: boolean }) {
  return blocked ? (
    <span className="flex size-7 items-center justify-center rounded-lg bg-navy text-white">
      <X aria-hidden strokeWidth={2} className="size-3.5" />
    </span>
  ) : (
    <span className="flex size-7 items-center justify-center rounded-lg bg-white ring-1 ring-line">
      <span aria-hidden className="size-1.5 rounded-full bg-teal" />
    </span>
  );
}

// Properties as rows, days as columns. Interactive cells block or open one night.
export function AvailabilityGrid({
  homes,
  days,
  blocked,
  today,
  interactive = false,
  caption,
}: {
  homes: Home[];
  days: string[];
  blocked: string[];
  today: string;
  interactive?: boolean;
  caption: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState(blocked);
  const [nights, setNights] = useState(() => new Set(blocked));
  const [message, setMessage] = useState("");

  // fresh data from the server replaces local changes
  if (source !== blocked) {
    setSource(blocked);
    setNights(new Set(blocked));
  }

  async function toggle(home: Home, date: string) {
    const key = `${home.id}|${date}`;
    const wasBlocked = nights.has(key);
    const next = new Set(nights);
    if (wasBlocked) next.delete(key);
    else next.add(key);
    setNights(next);
    const label = `${dateRangeLabel(date, date)} ${wasBlocked ? "opened" : "blocked"} for ${home.name}.`;
    setMessage(`Saving...`);
    const result = await changeAvailability(home.id, date, date, wasBlocked ? "open" : "block");
    if (result.ok) {
      setMessage(label);
      router.refresh();
    } else {
      setNights((current) => {
        const undo = new Set(current);
        if (wasBlocked) undo.add(key);
        else undo.delete(key);
        return undo;
      });
      setMessage(result.error);
    }
  }

  if (homes.length === 0) {
    return <p className="rounded-lg bg-admin-bg px-4 py-6 text-center text-sm text-muted">No homes yet.</p>;
  }

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
      {/* focusable for keyboard scrolling; relative keeps the sr-only cell labels from widening the page */}
      <div
        role="region"
        aria-label={caption}
        tabIndex={0}
        className="relative overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-teal"
      >
        <table className="border-separate border-spacing-1 text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-white pr-3 text-left font-semibold text-muted">
                Home
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={`w-7 text-center font-medium ${d === today ? "text-teal" : "text-muted"}`}
                >
                  <span className="block text-[10px]">{weekdayInitial(d)}</span>
                  <span className={`block ${d === today ? "font-bold" : ""}`}>{dateParts(d).day}</span>
                  {d === today && <span className="sr-only">(today)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {homes.map((home) => (
              <tr key={home.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-40 truncate bg-white pr-3 text-left text-[13px] font-medium text-navy"
                >
                  {home.name}
                </th>
                {days.map((d) => {
                  const isBlocked = nights.has(`${home.id}|${d}`);
                  const state = isBlocked ? "blocked" : "open";
                  if (!interactive || d < today) {
                    return (
                      <td key={d} className={d < today ? "opacity-50" : ""}>
                        <Mark blocked={isBlocked} />
                        <span className="sr-only">{state}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={d}>
                      <button
                        type="button"
                        aria-pressed={isBlocked}
                        aria-label={`${home.name}, ${dateRangeLabel(d, d)}, ${state}`}
                        onClick={() => void toggle(home, d)}
                        className="block rounded-md hover:ring-2 hover:ring-navy/30"
                      >
                        <Mark blocked={isBlocked} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AvailabilityLegend() {
  return (
    <ul className="mt-4 flex flex-wrap gap-5 text-xs text-muted">
      <li className="flex items-center gap-2">
        <span className="flex size-4 items-center justify-center rounded bg-white ring-1 ring-line">
          <span aria-hidden className="size-1 rounded-full bg-teal" />
        </span>
        Available
      </li>
      <li className="flex items-center gap-2">
        <span className="flex size-4 items-center justify-center rounded bg-navy text-white">
          <X aria-hidden strokeWidth={2} className="size-2.5" />
        </span>
        Blocked
      </li>
    </ul>
  );
}
