import { describe, expect, it } from "vitest";
import { dateRangeLabel, firstName, greeting, initials, nights, stayRange, timeAgo } from "./admin-format";

describe("names", () => {
  it("takes up to two initials", () => {
    expect(initials("Naseema Asmal")).toBe("NA");
    expect(initials("  amina  ")).toBe("A");
    expect(initials("Mary Jane Smith")).toBe("MJ");
  });

  it("takes the first name", () => {
    expect(firstName("Naseema Asmal")).toBe("Naseema");
  });
});

describe("stay dates", () => {
  it("shortens a stay inside one month", () => {
    expect(stayRange("2026-09-12", "2026-09-15")).toBe("12 - 15 Sep 2026");
  });

  it("names both months when the stay crosses a month", () => {
    expect(stayRange("2026-09-28", "2026-10-02")).toBe("28 Sep - 2 Oct 2026");
  });

  it("names both years when the stay crosses a year", () => {
    expect(stayRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 - 2 Jan 2027");
  });

  it("counts nights", () => {
    expect(nights("2026-09-12", "2026-09-15")).toBe("3 Nights");
    expect(nights("2026-09-12", "2026-09-13")).toBe("1 Night");
  });

  it("labels a blocked range", () => {
    expect(dateRangeLabel("2026-09-14", "2026-09-16")).toBe("14 to 16 September 2026");
    expect(dateRangeLabel("2026-09-14", "2026-09-14")).toBe("14 September 2026");
    expect(dateRangeLabel("2026-09-29", "2026-10-02")).toBe("29 September 2026 to 2 October 2026");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-25T12:00:00Z");

  it("counts minutes, then hours", () => {
    expect(timeAgo("2026-11-25T11:59:40Z", now)).toBe("Just now");
    expect(timeAgo("2026-11-25T11:46:00Z", now)).toBe("14 min ago");
    expect(timeAgo("2026-11-25T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("2026-11-25T09:00:00Z", now)).toBe("3 hours ago");
  });

  it("says yesterday, then gives the date", () => {
    expect(timeAgo("2026-11-24T10:00:00Z", now)).toBe("Yesterday");
    expect(timeAgo("2026-11-20T10:00:00Z", now)).toBe("20 November 2026");
  });
});

describe("greeting", () => {
  it("follows the time in South Africa", () => {
    expect(greeting(new Date("2026-11-25T05:00:00Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-11-25T10:30:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-25T16:00:00Z"))).toBe("Good evening");
  });
});
