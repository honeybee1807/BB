// Filters for the properties page. They come from the URL, so filtered views can be shared
// and the form works without JavaScript.
export const GUEST_OPTIONS = [2, 4, 6, 8, 10, 12] as const;

type ListingFilters = { halal: boolean; region: string; estate: string; guests: number };

type Param = string | string[] | undefined;

function first(value: Param): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

// Anything unexpected is ignored rather than shown as an error.
export function parseFilters(params: Record<string, Param>): ListingFilters {
  const guests = Number(first(params.guests));
  return {
    halal: first(params.halal) === "1",
    region: first(params.region),
    estate: first(params.estate),
    guests: (GUEST_OPTIONS as readonly number[]).includes(guests) ? guests : 0,
  };
}

export function isFiltered(f: ListingFilters): boolean {
  return f.halal || f.region !== "" || f.estate !== "" || f.guests > 0;
}

type Listable = { is_halal: boolean; max_guests: number | null; estate: { slug: string; region: { slug: string } } };

// A home with no guest number set is left out of a guest filter rather than guessed at.
export function matchesFilters(p: Listable, f: ListingFilters): boolean {
  return (
    (!f.halal || p.is_halal) &&
    (!f.region || p.estate.region.slug === f.region) &&
    (!f.estate || p.estate.slug === f.estate) &&
    (!f.guests || (p.max_guests !== null && p.max_guests >= f.guests))
  );
}
