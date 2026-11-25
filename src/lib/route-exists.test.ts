import { describe, expect, it } from "vitest";
import { lookupFor } from "./route-exists";

describe("lookupFor", () => {
  it("looks up a property or post by slug", () => {
    expect(lookupFor("/properties/cathkin-view-villa")).toEqual({
      table: "properties",
      query: "slug=eq.cathkin-view-villa",
    });
    expect(lookupFor("/journal/a-weekend-away")).toEqual({ table: "blog_posts", query: "slug=eq.a-weekend-away" });
  });

  it("checks an estate inside its region", () => {
    expect(lookupFor("/regions/drakensberg/champagne-valley")).toEqual({
      table: "estates",
      query: "slug=eq.champagne-valley&regions.slug=eq.drakensberg",
    });
    expect(lookupFor("/regions/drakensberg")).toEqual({ table: "regions", query: "slug=eq.drakensberg" });
  });

  it("refuses slugs that could never exist without asking the database", () => {
    expect(lookupFor("/properties/Not_A_Slug")).toBe("missing");
    expect(lookupFor("/properties/a/b")).toBe("missing");
    expect(lookupFor("/regions/drakensberg/champagne-valley/extra")).toBe("missing");
    expect(lookupFor("/journal/%27or%271%27")).toBe("missing");
  });

  it("leaves list pages and everything else alone", () => {
    expect(lookupFor("/properties")).toBeNull();
    expect(lookupFor("/journal")).toBeNull();
    expect(lookupFor("/about")).toBeNull();
  });
});
