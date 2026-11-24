import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { availabilitySchema, inquiryUpdateSchema } from "./admin";

const id = "3f0f7c3e-2c2b-4f7e-9a51-6d1c1a0b2c3d";

describe("inquiryUpdateSchema", () => {
  it("accepts one change at a time", () => {
    expect(inquiryUpdateSchema.safeParse({ status: "claimed" }).success).toBe(true);
    expect(inquiryUpdateSchema.safeParse({ assignedTo: id }).success).toBe(true);
    expect(inquiryUpdateSchema.safeParse({ assignedTo: null }).success).toBe(true);
    expect(inquiryUpdateSchema.safeParse({ notes: "Called the guest" }).success).toBe(true);
  });

  it("rejects an empty change", () => {
    expect(inquiryUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown statuses and fields", () => {
    expect(inquiryUpdateSchema.safeParse({ status: "pending" }).success).toBe(false);
    expect(inquiryUpdateSchema.safeParse({ status: "new", guestName: "x" }).success).toBe(false);
  });

  it("rejects a malformed assignee", () => {
    expect(inquiryUpdateSchema.safeParse({ assignedTo: "naseema" }).success).toBe(false);
  });

  it("limits notes to 5,000 characters", () => {
    expect(inquiryUpdateSchema.safeParse({ notes: "a".repeat(5001) }).success).toBe(false);
  });
});

describe("availabilitySchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const base = { propertyId: id, from: "2026-09-14", to: "2026-09-16", action: "block" };

  it("accepts a range from today on", () => {
    expect(availabilitySchema.safeParse(base).success).toBe(true);
    expect(availabilitySchema.safeParse({ ...base, from: "2026-09-10", to: "2026-09-10" }).success).toBe(true);
  });

  it("rejects an inverted range", () => {
    expect(availabilitySchema.safeParse({ ...base, from: "2026-09-16", to: "2026-09-14" }).success).toBe(false);
  });

  it("rejects past dates", () => {
    expect(availabilitySchema.safeParse({ ...base, from: "2026-09-09" }).success).toBe(false);
  });

  it("allows up to 365 days between the dates", () => {
    expect(availabilitySchema.safeParse({ ...base, to: "2027-09-13" }).success).toBe(true);
    expect(availabilitySchema.safeParse({ ...base, to: "2027-09-14" }).success).toBe(true);
    expect(availabilitySchema.safeParse({ ...base, to: "2027-09-15" }).success).toBe(false);
  });

  it("only blocks or opens", () => {
    expect(availabilitySchema.safeParse({ ...base, action: "book" }).success).toBe(false);
  });
});
