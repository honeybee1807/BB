import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";
import { JsonLd } from "./json-ld";

export type Crumb = { href: string; label: string };

// The last crumb is the current page.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail = [{ href: "/", label: "Home" }, ...items];
  return (
    <>
      <JsonLd
        data={{
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: absoluteUrl(c.href),
          })),
        }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-2">
                {last ? (
                  <span aria-current="page" className="text-navy">
                    {c.label}
                  </span>
                ) : (
                  <>
                    <Link href={c.href} className="hover:text-navy hover:underline">
                      {c.label}
                    </Link>
                    <ChevronRight aria-hidden strokeWidth={1.5} className="size-3.5" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
