import { ArrowDownRight, ArrowUpRight, CalendarDays, CheckCheck, Inbox, MessageSquare, Minus } from "lucide-react";
import { countChange, pointsChange, type Change } from "@/lib/admin-format";
import type { DashboardCounts } from "@/lib/data/admin";

function ChangeLine({ change }: { change: Change }) {
  const Icon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : Minus;
  const colour = change.direction === "up" ? "text-up" : change.direction === "down" ? "text-down" : "text-muted";
  return (
    <p className={`mt-2 flex items-start gap-1 text-xs ${colour}`}>
      <Icon aria-hidden strokeWidth={1.5} className="mt-px size-3.5 shrink-0" />
      {change.text}
    </p>
  );
}

function Tile({
  icon: Icon,
  value,
  label,
  change,
}: {
  icon: typeof Inbox;
  value: string;
  label: string;
  change: Change;
}) {
  return (
    <li className="rounded-lg p-4 ring-1 ring-line">
      <span className="flex size-8 items-center justify-center rounded-lg bg-frost text-navy">
        <Icon aria-hidden strokeWidth={1.5} className="size-4" />
      </span>
      <p className="mt-3 font-serif text-[28px] leading-none text-navy">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
      <ChangeLine change={change} />
    </li>
  );
}

export function StatTiles({ counts }: { counts: DashboardCounts }) {
  const month = "vs last month";
  const days = "vs previous 30 days";
  const [rate, previousRate] = counts.rate;
  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      <Tile
        icon={MessageSquare}
        value={String(counts.total[0])}
        label="Total inquiries this month"
        change={countChange(counts.total[0], counts.total[1], month)}
      />
      <Tile
        icon={CheckCheck}
        value={String(counts.answered[0])}
        label="Answered inquiries this month"
        change={countChange(counts.answered[0], counts.answered[1], month)}
      />
      <Tile
        icon={Inbox}
        value={String(counts.fresh[0])}
        label="New inquiries this month"
        change={countChange(counts.fresh[0], counts.fresh[1], month)}
      />
      <Tile
        icon={CalendarDays}
        value={rate === null ? "-" : `${rate}%`}
        label="Open nights, next 30 days"
        change={pointsChange(rate, previousRate, days)}
      />
    </ul>
  );
}
