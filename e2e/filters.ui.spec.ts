import { expect, test, type Page } from "@playwright/test";
import { matchesFilters, parseFilters } from "../src/lib/listing-filters";
import { admin } from "./support";

type Home = { is_halal: boolean; max_guests: number | null; estate: { slug: string; region: { slug: string } } };
let homes: Home[] = [];

// Expected counts come from the same published homes the page lists, so the test fits any local data.
test.beforeAll(async () => {
  const { data, error } = await admin
    .from("properties")
    .select("is_halal, max_guests, estate:estates!inner(slug, region:regions!inner(slug))")
    .eq("is_published", true)
    .is("deleted_at", null);
  if (error) throw error;
  homes = data as unknown as Home[];
  expect(homes.length).toBeGreaterThan(0);
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "cache-control": "no-cache" });
});

function expected(query: string): number {
  const f = parseFilters(Object.fromEntries(new URLSearchParams(query)));
  return homes.filter((h) => matchesFilters(h, f)).length;
}

async function shownCount(page: Page): Promise<number> {
  const text =
    (await page
      .getByRole("status")
      .filter({ hasText: /\d+ homes?/ })
      .textContent()) ?? "";
  return Number(text.match(/(\d+) home/)?.[1] ?? -1);
}

const region = () => homes[0]!.estate.region.slug;
const estate = () => homes[0]!.estate.slug;

for (const [name, query] of [
  ["halal", () => "halal=1"],
  ["region", () => `region=${region()}`],
  ["estate", () => `estate=${estate()}`],
  ["guests", () => "guests=6"],
  ["all four together", () => `halal=1&region=${region()}&estate=${estate()}&guests=4`],
  ["halal and guests", () => "halal=1&guests=8"],
] as const) {
  test(`filters by ${name}`, async ({ page }) => {
    const q = query();
    await page.goto(`/properties?${q}`);
    const count = expected(q);
    if (count === 0) {
      await expect(page.getByText("No properties match those choices.")).toBeVisible();
    } else {
      expect(await shownCount(page)).toBe(count);
    }
    // filtered views point search engines at the full list
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/properties$/);
  });
}

test("guest choices keep their value in the form", async ({ page }) => {
  await page.goto("/properties?guests=8");
  await expect(page.getByLabel("Sleeps at least")).toHaveValue("8");
});

test("an unknown guest number is ignored", async ({ page }) => {
  await page.goto("/properties?guests=7");
  expect(await shownCount(page)).toBe(homes.length);
});

test("no match shows an empty state with a way back", async ({ page }) => {
  const other = homes.find((h) => h.estate.region.slug !== region());
  const query = other ? `region=${region()}&estate=${other.estate.slug}` : "guests=12&estate=no-such-estate";
  await page.goto(`/properties?${query}`);
  await expect(page.getByText("No properties match those choices.")).toBeVisible();
  await page.getByRole("link", { name: "Show all homes" }).click();
  await expect(page).toHaveURL(/\/properties$/);
  expect(await shownCount(page)).toBe(homes.length);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the filter form still works", async ({ page }) => {
    await page.goto("/properties");
    await page.getByLabel("Sleeps at least").selectOption("6");
    await page.getByLabel("Halal accommodation only").check();
    await page.getByRole("button", { name: "Show homes" }).click();
    await expect(page).toHaveURL(/guests=6/);
    await expect(page).toHaveURL(/halal=1/);
    expect(await shownCount(page)).toBe(expected("guests=6&halal=1"));
  });
});
