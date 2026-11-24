import { describe, expect, it } from "vitest";
import { datesBetween, isMonthKey, monthGrid, monthLabel, shiftMonth, weekdayInitial } from "./calendar";

describe("month grid", () => {
  it("starts on Monday and pads with the neighbouring months", () => {
    // 1 September 2026 is a Tuesday
    const weeks = monthGrid("2026-09");
    expect(weeks[0]?.[0]).toEqual({ date: "2026-08-31", inMonth: false });
    expect(weeks[0]?.[1]).toEqual({ date: "2026-09-01", inMonth: true });
    expect(weeks.at(-1)?.at(-1)).toEqual({ date: "2026-10-04", inMonth: false });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("has no extra week when a month ends on Sunday", () => {
    // May 2026 ends on Sunday the 31st
    expect(monthGrid("2026-05").at(-1)?.at(-1)?.date).toBe("2026-05-31");
  });

  it("moves between months and years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("checks month keys", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
  });

  it("labels months", () => {
    expect(monthLabel("2026-09")).toBe("Sep 2026");
    expect(monthLabel("2026-09", true)).toBe("September 2026");
  });
});

describe("date helpers", () => {
  it("lists every day in a range, in either order", () => {
    expect(datesBetween("2026-09-14", "2026-09-16")).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
    expect(datesBetween("2026-09-16", "2026-09-14")).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
  });

  it("gives the weekday initial", () => {
    expect(weekdayInitial("2026-09-14")).toBe("M");
  });
});
