import { describe, expect, it } from "vitest";
import {
  countChange,
  dateRangeLabel,
  firstName,
  initials,
  nights,
  openRate,
  pointsChange,
  stayRange,
} from "./admin-format";

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

describe("change lines", () => {
  const period = "vs last month";

  it("shows a rise and a fall as whole percentages", () => {
    expect(countChange(12, 10, period)).toEqual({ direction: "up", text: "Up 20% vs last month" });
    expect(countChange(8, 10, period)).toEqual({ direction: "down", text: "Down 20% vs last month" });
  });

  it("never divides by zero", () => {
    expect(countChange(5, 0, period)).toEqual({ direction: "none", text: "No earlier data vs last month" });
    expect(countChange(0, 0, period)).toEqual({ direction: "none", text: "No change vs last month" });
  });

  it("says no change when the counts match", () => {
    expect(countChange(7, 7, period).text).toBe("No change vs last month");
  });

  it("compares rates in points", () => {
    const p = "vs previous 30 days";
    expect(pointsChange(84, 80, p)).toEqual({ direction: "up", text: "Up 4 points vs previous 30 days" });
    expect(pointsChange(79, 80, p)).toEqual({ direction: "down", text: "Down 1 point vs previous 30 days" });
    expect(pointsChange(84, null, p).text).toBe("No earlier data vs previous 30 days");
  });
});

describe("open rate", () => {
  it("is the share of nights that are not blocked", () => {
    expect(openRate(300, 48)).toBe(84);
    expect(openRate(30, 0)).toBe(100);
  });

  it("is null when there are no nights to measure", () => {
    expect(openRate(0, 0)).toBeNull();
  });
});
