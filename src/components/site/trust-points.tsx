import { Gem, ShieldCheck, Star } from "lucide-react";

const POINTS = [
  {
    icon: Gem,
    title: "Curated collection",
    text: "Handpicked properties, personally vetted by Naseema for comfort and quality.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & transparency",
    text: "Every inquiry is reviewed and confirmed personally, never an automated double-booking.",
  },
  {
    icon: Star,
    title: "Memorable stays",
    text: "Halal-conscious hospitality with a personal touch, from your first inquiry to check-out.",
  },
];

// Pages without a section heading above these use h2, so the outline never skips a level.
export function TrustPoints({ className = "", headingLevel = 3 }: { className?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className={`flex flex-col gap-8 ${className}`}>
      {POINTS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-5">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-mist text-navy">
            <Icon aria-hidden strokeWidth={1.5} className="size-5" />
          </span>
          <div>
            <Heading className="text-[13px] font-bold tracking-[0.1em] text-navy uppercase">{title}</Heading>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
