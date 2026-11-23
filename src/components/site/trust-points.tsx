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

export function TrustPoints({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-col gap-8 ${className}`}>
      {POINTS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-5">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-mist text-navy">
            <Icon aria-hidden strokeWidth={1.5} className="size-5" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold tracking-[0.1em] text-navy uppercase">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
