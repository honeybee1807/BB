import { ArrowRight } from "lucide-react";
import { formatLongDate, todayInSast } from "@/lib/format";
import { outlineButton } from "./card";

const WEEKDAY = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long" });

// A white band across the top of the page, as wide as the content area.
export function PageHeader({ title, description }: { title: string; description?: string }) {
  const today = todayInSast();
  return (
    <header className="-mx-4 mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 lg:py-8">
      <div className="min-w-0">
        <h1 className="font-serif text-[32px] leading-tight text-navy sm:text-[40px]">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {description ?? `${WEEKDAY.format(new Date(`${today}T12:00:00+02:00`))}, ${formatLongDate(today)}`}
        </p>
      </div>
      <a href="/" target="_blank" rel="noopener" className={`${outlineButton} h-12 px-5`}>
        View public site
        <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </header>
  );
}
