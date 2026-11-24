import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("makes a lowercase hyphenated address", () => {
    expect(slugify("Breakers Sea View Apartment")).toBe("breakers-sea-view-apartment");
  });

  it("drops accents, symbols and edge hyphens", () => {
    expect(slugify("  Café & Pool!! ")).toBe("cafe-and-pool");
  });

  it("matches the database slug rule", () => {
    for (const text of ["A--B", "Umhlanga Rocks, KZN", "123 Main"]) {
      expect(slugify(text)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("keeps addresses within 120 characters", () => {
    expect(slugify("word ".repeat(60)).length).toBeLessThanOrEqual(120);
  });
});
