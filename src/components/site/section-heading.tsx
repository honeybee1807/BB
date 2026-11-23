import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function SectionHeading({
  id,
  title,
  link,
  level = 2,
}: {
  id?: string;
  title: string;
  link?: { href: string; label: string };
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-navy pb-4">
      <Heading id={id} className="font-serif text-[26px] leading-tight text-navy uppercase sm:text-[30px]">
        {title}
      </Heading>
      {link && (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-2 pb-1 text-xs font-bold tracking-[0.14em] text-navy uppercase hover:underline hover:underline-offset-4"
        >
          {link.label}
          <ArrowRight
            aria-hidden
            strokeWidth={1.5}
            className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
}
