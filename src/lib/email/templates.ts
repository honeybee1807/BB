import { formatRand, plural } from "@/lib/format";

// Security emails never carry passwords, tokens, codes, raw IPs or guest messages.
export type EmailContent = { subject: string; text: string; html: string };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// e.g. 23 Nov 2026, 21:05 SAST
export function formatSast(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} SAST`;
}

function render(subject: string, heading: string, rows: Array<[string, string]>, closing: string[]): EmailContent {
  const text = [heading, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...closing].join("\n");
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2730;max-width:560px">`,
    `<h1 style="font-size:18px;color:#0e2a3d">${escapeHtml(heading)}</h1>`,
    `<table style="border-collapse:collapse;font-size:14px">`,
    ...rows.map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#5b6770">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
    ),
    `</table>`,
    ...closing.map((line) => `<p style="font-size:14px">${escapeHtml(line)}</p>`),
    `</div>`,
  ].join("");
  return { subject, text, html };
}

export function loginAlertEmail(input: {
  name: string;
  email: string;
  when: Date;
  location: string;
  device: string;
}): EmailContent {
  return render(
    "Bargain Breaks admin sign-in",
    "A Bargain Breaks admin account just signed in",
    [
      ["Who", `${input.name} (${input.email})`],
      ["When", formatSast(input.when)],
      ["Approximate location", input.location],
      ["Device", input.device],
    ],
    [
      "If this was you, no action is needed.",
      "If this was NOT you, change the password for this account at once and contact Olideen Technologies.",
    ],
  );
}

export function lockoutAlertEmail(input: {
  targetEmail: string;
  attempts: number;
  when: Date;
  reason: "password" | "two-factor";
}): EmailContent {
  const what = input.reason === "password" ? "failed sign-in attempts" : "failed two-factor codes";
  return render(
    "Bargain Breaks admin sign-in locked",
    `Admin sign-in locked after repeated ${what}`,
    [
      ["Email address targeted", input.targetEmail],
      ["Attempts", String(input.attempts)],
      ["When", formatSast(input.when)],
      ["Lock period", "15 minutes"],
    ],
    [
      "Sign-in for this address is blocked for 15 minutes. Correct passwords are refused during the lock.",
      "If you did not cause this, someone may be guessing the password. Contact Olideen Technologies.",
    ],
  );
}

export function deleteAlertEmail(input: {
  actorName: string;
  action: "deleted" | "permanently purged";
  entityLabel: string;
  when: Date;
  restoreHint: string;
}): EmailContent {
  return render(
    `Bargain Breaks: ${input.entityLabel} ${input.action}`,
    `A record was ${input.action}`,
    [
      ["Who", input.actorName],
      ["What", input.entityLabel],
      ["When", formatSast(input.when)],
    ],
    [input.restoreHint, "If you did not expect this, contact Olideen Technologies."],
  );
}

const ACCOMMODATION_LABELS = {
  no_preference: "No preference",
  resort: "Resort",
  holiday_home: "Holiday home",
} as const;

export function inquiryEmail(input: {
  adminUrl: string;
  fullName: string;
  email: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  budgetMin: number | null;
  budgetMax: number | null;
  accommodationType: keyof typeof ACCOMMODATION_LABELS;
  propertyName: string | null;
  requirements: string;
}): EmailContent {
  const budget =
    input.budgetMin === null && input.budgetMax === null
      ? "Not given"
      : `${input.budgetMin === null ? "Any" : formatRand(input.budgetMin)} to ${input.budgetMax === null ? "any" : formatRand(input.budgetMax)}`;
  return render(
    `New inquiry from ${input.fullName}`,
    "A new inquiry has come in",
    [
      ["Guest", input.fullName],
      ["Email", input.email],
      ["Phone", input.phone],
      ["Property", input.propertyName ?? "Any"],
      ["Dates", `${input.checkIn} to ${input.checkOut} (${plural(input.nights, "night", "nights")})`],
      ["Guests", `${plural(input.adults, "adult", "adults")}, ${plural(input.children, "child", "children")}`],
      ["Budget", budget],
      ["Accommodation", ACCOMMODATION_LABELS[input.accommodationType]],
      ["Requirements", input.requirements || "None"],
    ],
    [`Open the inquiry: ${input.adminUrl}`, "Reply to this email to answer the guest directly."],
  );
}
