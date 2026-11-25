// Contact details shown on the site. An empty value hides that link everywhere.
export const contact = {
  phone: "",
  // full international number, for example 27821234567
  whatsapp: "",
  email: "",
  supportEmail: "",
};

type Contact = typeof contact;

export type ContactLink = { kind: "phone" | "whatsapp" | "email"; label: string; text: string; href: string };

export function contactLinks(details: Contact = contact): ContactLink[] {
  const links: ContactLink[] = [];
  const phone = details.phone.trim();
  const whatsapp = details.whatsapp.replace(/\D/g, "");
  const dial = phone.replace(/[^\d+]/g, "");
  const email = details.email.trim();
  if (/\d/.test(dial)) links.push({ kind: "phone", label: "Phone", text: phone, href: `tel:${dial}` });
  if (whatsapp)
    links.push({ kind: "whatsapp", label: "WhatsApp", text: `+${whatsapp}`, href: `https://wa.me/${whatsapp}` });
  if (email) links.push({ kind: "email", label: "Email", text: email, href: `mailto:${email}` });
  return links;
}

export function supportHref(details: Contact = contact): string | null {
  const email = details.supportEmail.trim();
  return email ? `mailto:${email}` : null;
}

// Structured data only names details that are set, so search engines never see an empty phone.
export function organizationContact(details: Contact = contact): { telephone?: string; email?: string } {
  const links = contactLinks(details);
  const phone = links.find((l) => l.kind === "phone");
  const email = links.find((l) => l.kind === "email");
  return {
    ...(phone ? { telephone: phone.href.slice(4) } : {}),
    ...(email ? { email: email.text } : {}),
  };
}
