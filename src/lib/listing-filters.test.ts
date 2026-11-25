import { describe, expect, it } from "vitest";
import { isFiltered, matchesFilters, parseFilters } from "./listing-filters";

const home = (over: { is_halal?: boolean; max_guests?: number | null; estate?: string; region?: string } = {}) => ({
  is_halal: over.is_halal ?? true,
  max_guests: over.max_guests === undefined ? 6 : over.max_guests,
  estate: { slug: over.estate ?? "cathkin-estate", region: { slug: over.region ?? "drakensberg" } },
});

const none = parseFilters({});

describe("parseFilters", () => {
  it("reads every filter from the URL", () => {
    expect(parseFilters({ halal: "1", region: "drakensberg", estate: "cathkin-estate", guests: "8" })).toEqual({
      halal: true,
      region: "drakensberg",
      estate: "cathkin-estate",
      guests: 8,
    });
  });

  it("ignores a guest number that isn't one of the choices", () => {
    expect(parseFilters({ guests: "7" }).guests).toBe(0);
    expect(parseFilters({ guests: "-4" }).guests).toBe(0);
    expect(parseFilters({ guests: "lots" }).guests).toBe(0);
  });

  it("uses the first value when a filter is repeated", () => {
    expect(parseFilters({ region: ["drakensberg", "umhlanga"] }).region).toBe("drakensberg");
  });

  it("treats anything other than 1 as halal off", () => {
    expect(parseFilters({ halal: "yes" }).halal).toBe(false);
  });

  it("knows when nothing is filtered", () => {
    expect(isFiltered(none)).toBe(false);
    expect(isFiltered(parseFilters({ guests: "4" }))).toBe(true);
  });
});

describe("matchesFilters", () => {
  it("shows everything with no filters", () => {
    expect(matchesFilters(home({ is_halal: false, max_guests: null }), none)).toBe(true);
  });

  it("filters by halal alone", () => {
    const f = parseFilters({ halal: "1" });
    expect(matchesFilters(home(), f)).toBe(true);
    expect(matchesFilters(home({ is_halal: false }), f)).toBe(false);
  });

  it("filters by region alone", () => {
    const f = parseFilters({ region: "umhlanga" });
    expect(matchesFilters(home({ region: "umhlanga" }), f)).toBe(true);
    expect(matchesFilters(home(), f)).toBe(false);
  });

  it("filters by estate alone", () => {
    const f = parseFilters({ estate: "breakers" });
    expect(matchesFilters(home({ estate: "breakers" }), f)).toBe(true);
    expect(matchesFilters(home(), f)).toBe(false);
  });

  it("filters by guests alone, counting a home that sleeps exactly that many", () => {
    const f = parseFilters({ guests: "6" });
    expect(matchesFilters(home({ max_guests: 6 }), f)).toBe(true);
    expect(matchesFilters(home({ max_guests: 8 }), f)).toBe(true);
    expect(matchesFilters(home({ max_guests: 4 }), f)).toBe(false);
  });

  it("leaves out a home with no guest number when guests are chosen", () => {
    expect(matchesFilters(home({ max_guests: null }), parseFilters({ guests: "2" }))).toBe(false);
  });

  it("needs every chosen filter to match when they are combined", () => {
    const f = parseFilters({ halal: "1", region: "umhlanga", guests: "8" });
    expect(matchesFilters(home({ region: "umhlanga", max_guests: 10 }), f)).toBe(true);
    expect(matchesFilters(home({ region: "umhlanga", max_guests: 4 }), f)).toBe(false);
    expect(matchesFilters(home({ region: "umhlanga", max_guests: 10, is_halal: false }), f)).toBe(false);
    expect(matchesFilters(home({ max_guests: 10 }), f)).toBe(false);
  });
});
