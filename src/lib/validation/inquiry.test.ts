import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inquirySchema, type InquiryForm } from "./inquiry";

const valid: InquiryForm = {
  fullName: "Fatima Khan",
  email: "fatima@example.com",
  phone: "+27 82 123 4567",
  checkIn: "2026-12-12",
  checkOut: "2026-12-15",
  adults: "2",
  children: "1",
  budgetMin: "",
  budgetMax: "",
  accommodationType: "no_preference",
  requirements: "",
  consent: true,
  turnstileToken: "token",
  website: "",
};

function issues(input: Record<string, unknown>) {
  const result = inquirySchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("inquirySchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 10:00 in Johannesburg on 1 December 2026
    vi.setSystemTime(new Date("2026-12-01T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a valid inquiry and converts numbers", () => {
    const result = inquirySchema.parse({ ...valid, budgetMin: "1500", budgetMax: "3000" });
    expect(result.adults).toBe(2);
    expect(result.children).toBe(1);
    expect(result.budgetMin).toBe(1500);
    expect(result.budgetMax).toBe(3000);
  });

  it("treats empty budgets as not given", () => {
    const result = inquirySchema.parse(valid);
    expect(result.budgetMin).toBeNull();
    expect(result.budgetMax).toBeNull();
  });

  it("rejects unknown keys", () => {
    expect(issues({ ...valid, status: "answered" })).toContain("");
  });

  it("rejects a check-in in the past", () => {
    expect(issues({ ...valid, checkIn: "2026-11-30" })).toContain("checkIn");
  });

  it("uses South African time for today", () => {
    // 23:30 UTC on 30 November is already 1 December in Johannesburg
    vi.setSystemTime(new Date("2026-11-30T23:30:00Z"));
    expect(issues({ ...valid, checkIn: "2026-12-01", checkOut: "2026-12-02" })).toEqual([]);
  });

  it("rejects an inverted date range", () => {
    expect(issues({ ...valid, checkOut: "2026-12-12" })).toContain("checkOut");
  });

  it("rejects stays over 60 nights", () => {
    expect(issues({ ...valid, checkIn: "2026-12-02", checkOut: "2027-01-31" })).toEqual([]);
    expect(issues({ ...valid, checkIn: "2026-12-02", checkOut: "2027-02-01" })).toContain("checkOut");
  });

  it("needs at least one adult and at most 30", () => {
    expect(issues({ ...valid, adults: "0" })).toContain("adults");
    expect(issues({ ...valid, adults: "31" })).toContain("adults");
    expect(issues({ ...valid, children: "-1" })).toContain("children");
  });

  it("rejects a budget maximum below the minimum", () => {
    expect(issues({ ...valid, budgetMin: "5000", budgetMax: "4000" })).toContain("budgetMax");
  });

  it("rejects rand amounts with decimals or symbols", () => {
    expect(issues({ ...valid, budgetMin: "1500.50" })).toContain("budgetMin");
    expect(issues({ ...valid, budgetMin: "R1500" })).toContain("budgetMin");
  });

  it("rejects a phone number without enough digits", () => {
    expect(issues({ ...valid, phone: "+++ ( ) +++" })).toContain("phone");
    expect(issues({ ...valid, phone: "(012) +3" })).toContain("phone");
  });

  it("rejects phone numbers with letters", () => {
    expect(issues({ ...valid, phone: "call me maybe" })).toContain("phone");
  });

  it("needs consent", () => {
    expect(issues({ ...valid, consent: false })).toContain("consent");
  });

  it("rejects an unknown accommodation type", () => {
    expect(issues({ ...valid, accommodationType: "castle" })).toContain("accommodationType");
  });

  it("needs a security check token", () => {
    expect(issues({ ...valid, turnstileToken: "" })).toContain("turnstileToken");
  });

  it("limits additional requirements to 2,000 characters", () => {
    expect(issues({ ...valid, requirements: "a".repeat(2001) })).toContain("requirements");
  });
});
