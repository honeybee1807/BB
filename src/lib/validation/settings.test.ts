import { describe, expect, it, vi } from "vitest";
import { PAGE_SEO, resolvePageSeo } from "@/lib/seo-pages";
import { seoImageSchema, seoPageSchema } from "./settings";

describe("seoPageSchema", () => {
  it("stores blank fields as null so the defaults are used", () => {
    expect(seoPageSchema.parse({ page: "/about", title: "   ", description: "" })).toEqual({
      page: "/about",
      title: null,
      description: null,
    });
  });

  it("collapses whitespace and strips control characters", () => {
    const parsed = seoPageSchema.parse({ page: "/", title: "  Halal\tstays\u0000  in\n KZN ", description: "x" });
    expect(parsed.title).toBe("Halal stays in KZN");
  });

  it("allows past the soft limit but not past the hard one", () => {
    expect(seoPageSchema.safeParse({ page: "/", title: "a".repeat(90), description: "" }).success).toBe(true);
    expect(seoPageSchema.safeParse({ page: "/", title: "a".repeat(121), description: "" }).success).toBe(false);
    expect(seoPageSchema.safeParse({ page: "/", title: "", description: "a".repeat(321) }).success).toBe(false);
  });

  it("only accepts the pages edited in Settings", () => {
    expect(seoPageSchema.safeParse({ page: "/admin", title: "x", description: "x" }).success).toBe(false);
    expect(seoPageSchema.safeParse({ page: "/properties/some-home", title: "x", description: "x" }).success).toBe(
      false,
    );
  });

  it("rejects unknown keys", () => {
    expect(seoPageSchema.safeParse({ page: "/", title: "x", description: "x", updated_by: "x" }).success).toBe(false);
  });
});

describe("seoImageSchema", () => {
  it("accepts an upload path or null", () => {
    const upload = "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222";
    expect(seoImageSchema.safeParse({ page: "/", path: upload }).success).toBe(true);
    expect(seoImageSchema.safeParse({ page: "/", path: null }).success).toBe(true);
  });

  it("rejects a path that could leave the upload folder", () => {
    expect(seoImageSchema.safeParse({ page: "/", path: "../seo/other.webp" }).success).toBe(false);
  });
});

describe("resolvePageSeo", () => {
  it("uses the defaults when nothing is saved", () => {
    expect(resolvePageSeo("/journal", null)).toEqual({
      title: PAGE_SEO["/journal"].title,
      description: PAGE_SEO["/journal"].description,
      image: null,
    });
  });

  it("falls back field by field", () => {
    const seo = resolvePageSeo("/about", { title: "Our story", description: null, og_image_path: null });
    expect(seo.title).toBe("Our story");
    expect(seo.description).toBe(PAGE_SEO["/about"].description);
  });

  it("treats a blank saved value as empty", () => {
    expect(resolvePageSeo("/", { title: "  ", description: "", og_image_path: null }).title).toBe(PAGE_SEO["/"].title);
  });

  it("turns a saved image into a public URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.com");
    expect(resolvePageSeo("/", { title: null, description: null, og_image_path: "seo/a.webp" }).image).toBe(
      "https://db.example.com/storage/v1/object/public/property-photos/seo/a.webp",
    );
  });
});
