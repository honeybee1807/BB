import { describe, expect, it } from "vitest";
import { describeActivity } from "./activity";

const names = {
  homes: new Map([["h1", "Cathkin View Villa"]]),
  posts: new Map([["p1", "A weekend in the Berg"]]),
};

const line = (action: string, entity_id: string | null = null, metadata: Record<string, unknown> = {}) =>
  describeActivity({ action, entity_id, metadata: metadata as never }, names).title;

describe("describeActivity", () => {
  it("names the home or post it was about", () => {
    expect(line("property.update", "h1")).toBe("Cathkin View Villa updated");
    expect(line("post.publish", "p1", { published: true })).toBe("Journal post published: A weekend in the Berg");
    expect(line("property.publish", "h1", { published: false })).toBe("Cathkin View Villa hidden from the site");
  });

  it("describes blocked dates with the range", () => {
    expect(line("availability.block", "h1", { from: "2026-12-04", to: "2026-12-06" })).toBe(
      "4 to 6 December 2026 blocked at Cathkin View Villa",
    );
  });

  it("never shows guest details for inquiries", () => {
    expect(line("inquiry.assign", "i1", { from: null, to: "u1" })).toBe("Inquiry claimed");
    expect(line("inquiry.status", "i1", { to: "answered" })).toBe("Inquiry marked answered");
  });

  it("falls back when a name is no longer known", () => {
    expect(line("property.update", "gone")).toBe("A home updated");
    expect(line("something.new")).toBe("Admin change");
  });

  it("calls the homepage by name", () => {
    expect(line("seo.update", "/")).toBe("Search details updated for the homepage");
  });
});
