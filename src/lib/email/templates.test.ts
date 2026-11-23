import { describe, expect, it } from "vitest";
import {
  deleteAlertEmail,
  escapeHtml,
  formatSast,
  inquiryEmail,
  lockoutAlertEmail,
  loginAlertEmail,
} from "./templates";

const when = new Date("2026-11-23T19:05:00Z");

describe("security email templates", () => {
  it("login alert has who, when (SAST), location, device and the act-now line", () => {
    const email = loginAlertEmail({
      name: "Test Owner",
      email: "owner@example.com",
      when,
      location: "Durban, ZA",
      device: "Chrome on Windows",
    });
    expect(email.subject).toBe("Bargain Breaks admin sign-in");
    for (const part of [
      "Test Owner",
      "owner@example.com",
      "23 Nov 2026",
      "21:05 SAST",
      "Durban, ZA",
      "Chrome on Windows",
      "NOT you",
    ]) {
      expect(email.text).toContain(part);
    }
  });

  it("lockout alert has the targeted address and attempt count", () => {
    const email = lockoutAlertEmail({ targetEmail: "owner@example.com", attempts: 5, when, reason: "password" });
    expect(email.text).toContain("Email address targeted: owner@example.com");
    expect(email.text).toContain("Attempts: 5");
    expect(email.text).toContain("15 minutes");
  });

  it("delete alert names who, what and how to restore", () => {
    const email = deleteAlertEmail({
      actorName: "Test Owner",
      action: "deleted",
      entityLabel: "Property: Sea View",
      when,
      restoreHint: "Restore it from the bin.",
    });
    expect(email.subject).toContain("Property: Sea View deleted");
    expect(email.text).toContain("Restore it from the bin.");
  });

  it("templates take no password, token or code input, so none can leak", () => {
    const secret = "Sup3r-Secret-Passw0rd!";
    const emails = [
      loginAlertEmail({ name: "A", email: "a@example.com", when, location: "x", device: "y" }),
      lockoutAlertEmail({ targetEmail: "a@example.com", attempts: 5, when, reason: "two-factor" }),
    ];
    for (const e of emails) {
      const all = `${e.subject}${e.text}${e.html}`;
      expect(all).not.toContain(secret);
      expect(all).not.toMatch(/\b\d{6}\b/); // no TOTP-style codes
      expect(all).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // no raw IPv4 addresses
    }
  });

  it("escapes HTML in user-controlled values", () => {
    const email = loginAlertEmail({
      name: "<script>alert(1)</script>",
      email: "a@example.com",
      when,
      location: "x",
      device: "y",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("formats times in South African time", () => {
    expect(formatSast(when)).toMatch(/21:05 SAST$/);
  });
});

describe("inquiry email", () => {
  const base = {
    adminUrl: "https://example.co.za/admin/inquiries/abc",
    fullName: "Fatima Khan",
    email: "fatima@example.com",
    phone: "082 123 4567",
    checkIn: "2026-12-12",
    checkOut: "2026-12-15",
    nights: 3,
    adults: 2,
    children: 1,
    budgetMin: 1500,
    budgetMax: null,
    accommodationType: "holiday_home" as const,
    propertyName: "Mountain View Villa",
    requirements: "Ground floor <please>",
  };

  it("has the guest details, stay, budget and admin link", () => {
    const email = inquiryEmail(base);
    expect(email.subject).toBe("New inquiry from Fatima Khan");
    for (const part of [
      "fatima@example.com",
      "2026-12-12 to 2026-12-15 (3 nights)",
      "2 adults, 1 child",
      "R1,500 to any",
      "Holiday home",
      "Mountain View Villa",
      "https://example.co.za/admin/inquiries/abc",
    ]) {
      expect(email.text).toContain(part);
    }
  });

  it("escapes guest text in the HTML version", () => {
    const email = inquiryEmail(base);
    expect(email.html).toContain("Ground floor &lt;please&gt;");
    expect(email.html).not.toContain("<please>");
  });
});
