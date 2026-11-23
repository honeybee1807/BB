import { Mail, MessageCircle, Phone } from "lucide-react";
import { contactLinks } from "@/lib/site";

const ICONS = { phone: Phone, whatsapp: MessageCircle, email: Mail };

export function ContactList({ className = "" }: { className?: string }) {
  const links = contactLinks();
  if (links.length === 0) return null;
  return (
    <ul className={`flex flex-col gap-2 text-sm text-muted ${className}`}>
      {links.map(({ kind, label, text, href }) => {
        const Icon = ICONS[kind];
        const external = kind === "whatsapp";
        return (
          <li key={kind}>
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex items-center gap-2 hover:text-navy hover:underline"
            >
              <Icon aria-hidden strokeWidth={1.5} className="size-4" />
              <span className="sr-only">{label}: </span>
              {text}
              {external && <span className="sr-only"> (opens in a new tab)</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
