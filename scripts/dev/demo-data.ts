// Fictional demo homes for the local stack only. Usage: npm run seed:demo | npm run seed:demo:remove
import sharp from "sharp";
import { client, readLocalStack } from "../../tests/api/local-stack.ts";

const PREFIX = "demo-";
const FOLDER = "demo";
const GUEST_EMAIL = (n: number) => `${PREFIX}guest-${n}@example.com`;

// readLocalStack refuses anything but localhost or 127.0.0.1
const stack = readLocalStack();
const db = client(stack.url, stack.serviceKey);

function say(line: string) {
  process.stdout.write(`${line}\n`);
}

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function remove() {
  const { error: iErr } = await db.from("inquiries").delete().like("guest_email", `${PREFIX}guest-%@example.com`);
  check(iErr, "remove inquiries");
  const { data: regions } = await db.from("regions").select("id").like("slug", `${PREFIX}%`);
  const regionIds = (regions ?? []).map((r) => r.id);
  if (regionIds.length) {
    const { data: estates } = await db.from("estates").select("id").in("region_id", regionIds);
    const estateIds = (estates ?? []).map((e) => e.id);
    if (estateIds.length)
      check((await db.from("properties").delete().in("estate_id", estateIds)).error, "remove homes");
    check((await db.from("estates").delete().in("region_id", regionIds)).error, "remove estates");
    check((await db.from("regions").delete().in("id", regionIds)).error, "remove regions");
  }
  const { data: files } = await db.storage.from("property-photos").list(FOLDER, { limit: 1000 });
  if (files?.length) await db.storage.from("property-photos").remove(files.map((f) => `${FOLDER}/${f.name}`));
  say("Demo data removed.");
}

async function photo(name: string, from: string, to: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/></svg>`;
  const upload = async (path: string, body: Buffer) => {
    const { error } = await db.storage
      .from("property-photos")
      .upload(path, body, { contentType: "image/webp", upsert: true });
    check(error, `upload ${path}`);
  };
  const full = `${FOLDER}/${name}.webp`;
  const thumb = `${FOLDER}/${name}-640.webp`;
  await upload(full, await sharp(Buffer.from(svg)).webp().toBuffer());
  await upload(thumb, await sharp(Buffer.from(svg)).resize(640).webp().toBuffer());
  return { storage_path: full, thumb_path: thumb, width: 1600, height: 1000 };
}

type Home = {
  name: string;
  estate: string;
  town: string;
  type: "holiday_home" | "resort";
  guests: number;
  beds: number;
  baths: number;
  price: number | null;
  halal: boolean;
  featured: boolean;
  colours: [string, string];
};

const PLACES = [
  {
    region: { slug: "drakensberg", name: "Drakensberg", text: "Mountain air, clear rivers and big skies." },
    estates: [
      { slug: "cathkin-estate", name: "Cathkin Estate", town: "Champagne Valley" },
      { slug: "champagne-sports", name: "Champagne Sports Estate", town: "Champagne Valley" },
    ],
  },
  {
    region: { slug: "north-coast", name: "KwaZulu-Natal North Coast", text: "Warm sea and long beaches." },
    estates: [
      { slug: "ballito-bay", name: "Ballito Bay", town: "Ballito" },
      { slug: "zimbali-coastal", name: "Zimbali Coastal Estate", town: "Ballito" },
    ],
  },
];

const HOMES: Home[] = [
  ["Mountain View Villa", "cathkin-estate", "holiday_home", 8, 4, 3, 1800, true, true, ["#3b4a55", "#d8c7a8"]],
  ["City Loft Apartment", "ballito-bay", "holiday_home", 4, 2, 2, 950, true, true, ["#9aa3a8", "#f1efea"]],
  ["Ocean Breeze House", "zimbali-coastal", "holiday_home", 10, 5, 4, 2200, true, true, ["#2a2622", "#c9a15a"]],
  ["Berg Retreat Cottage", "cathkin-estate", "holiday_home", 4, 2, 1, 850, true, false, ["#4d5b4a", "#e8cb9c"]],
  ["Highland Family House", "champagne-sports", "holiday_home", 12, 6, 4, 2600, true, false, ["#1d3a4a", "#b9c4c9"]],
  ["Champagne Valley Suite", "champagne-sports", "resort", 2, 1, 1, 1200, false, false, ["#5a4636", "#f4ecdc"]],
  ["Riverside Chalet", "cathkin-estate", "holiday_home", 6, 3, 2, 1450, true, false, ["#2f4f4f", "#d8f2f0"]],
  ["Salt Rock Beach Flat", "ballito-bay", "holiday_home", 5, 2, 2, 1100, true, false, ["#0f5a57", "#f1efea"]],
  ["Zimbali Forest Lodge", "zimbali-coastal", "resort", 6, 3, 3, null, false, false, ["#24382b", "#c9a15a"]],
  ["Lighthouse Penthouse", "ballito-bay", "holiday_home", 8, 4, 4, 3400, true, false, ["#0b2a3d", "#9aa3a8"]],
].map(([name, estate, type, guests, beds, baths, price, halal, featured, colours]) => ({
  name,
  estate,
  type,
  guests,
  beds,
  baths,
  price,
  halal,
  featured,
  colours,
  town: String(estate).includes("ballito") || String(estate).includes("zimbali") ? "Ballito" : "Champagne Valley",
})) as Home[];

// [home index, first day from today, nights]
const BLOCKS: [number, number, number][] = [
  [0, 3, 4],
  [0, 18, 3],
  [1, 0, 2],
  [1, 9, 5],
  [2, 5, 7],
  [3, 1, 1],
  [3, 12, 4],
  [4, 7, 3],
  [6, 2, 6],
  [7, 14, 2],
  [9, 4, 3],
];

async function add() {
  await remove();
  const estateIds = new Map<string, string>();
  for (const [i, place] of PLACES.entries()) {
    const { data: region, error } = await db
      .from("regions")
      .insert({
        slug: PREFIX + place.region.slug,
        name: place.region.name,
        description: place.region.text,
        sort_order: i,
      })
      .select("id")
      .single();
    check(error, "region");
    for (const [j, estate] of place.estates.entries()) {
      const { data, error: eErr } = await db
        .from("estates")
        .insert({
          region_id: region!.id,
          slug: PREFIX + estate.slug,
          name: estate.name,
          description: `Homes at ${estate.name}, near ${estate.town}.`,
          sort_order: j,
        })
        .select("id")
        .single();
      check(eErr, "estate");
      estateIds.set(estate.slug, data!.id);
    }
  }

  const homeIds: string[] = [];
  for (const [i, home] of HOMES.entries()) {
    const slug = PREFIX + home.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data: row, error } = await db
      .from("properties")
      .insert({
        estate_id: estateIds.get(home.estate)!,
        slug,
        name: home.name,
        town: home.town,
        property_type: home.type,
        summary:
          home.type === "resort"
            ? "A comfortable resort stay with everything taken care of."
            : "A calm, family-friendly home with space to spread out.",
        description: "Open-plan living, a full kitchen and a covered patio.\n\nDemo listing for local testing only.",
        max_guests: home.guests,
        bedrooms: home.beds,
        bathrooms: home.baths,
        price_from_zar: home.price,
        is_halal: home.halal,
        halal_details: home.halal ? "Alcohol-free premises and separate kitchen utensils. Demo text." : null,
        custom_fields: [
          { label: "Check-in", value: "From 14:00" },
          { label: "Check-out", value: "By 10:00" },
        ],
        is_featured: home.featured,
        featured_sort_order: i,
        is_published: true,
      })
      .select("id")
      .single();
    check(error, home.name);
    homeIds.push(row!.id);
    for (const n of [0, 1, 2]) {
      const [a, b] = home.colours;
      const image = await photo(`${slug}-${n}`, n % 2 ? b : a, n % 2 ? a : b);
      const { error: pErr } = await db
        .from("property_photos")
        .insert({ property_id: row!.id, ...image, alt_text: "", is_cover: n === 0, sort_order: n });
      check(pErr, `${home.name} photo`);
    }
  }

  const blocks = BLOCKS.flatMap(([home, start, nights]) =>
    Array.from({ length: nights }, (_, k) => ({ property_id: homeIds[home]!, date: isoDate(start + k) })),
  );
  check((await db.from("availability_blocks").insert(blocks)).error, "blocked dates");

  // [guest, home index or null, check-in from today, nights, adults, children, status, received days ago]
  const guests: [string, number | null, number, number, number, number, "new" | "in_progress" | "actioned", number][] =
    [
      ["Demo Guest One", 0, 40, 3, 2, 2, "new", 1],
      ["Demo Guest Two", 2, 55, 4, 4, 0, "new", 3],
      ["Demo Guest Three", null, 70, 2, 2, 0, "in_progress", 6],
      ["Demo Guest Four", 1, 30, 5, 2, 1, "in_progress", 12],
      ["Demo Guest Five", 4, 90, 7, 6, 3, "actioned", 20],
      ["Demo Guest Six", 7, 25, 2, 2, 0, "actioned", 35],
    ];
  const inquiries = guests.map(([name, home, start, nightCount, adults, children, status, ago], n) => {
    const received = new Date(Date.now() - ago * 86_400_000).toISOString();
    return {
      guest_name: name,
      guest_email: GUEST_EMAIL(n + 1),
      guest_phone: "082 000 0000",
      check_in: isoDate(start),
      check_out: isoDate(start + nightCount),
      adults,
      children,
      property_id: home === null ? null : homeIds[home]!,
      status,
      additional_requirements: "Demo inquiry for local testing only.",
      consent_given_at: received,
      created_at: received,
    };
  });
  check((await db.from("inquiries").insert(inquiries)).error, "demo inquiries");

  say(
    `Added ${HOMES.length} demo homes in ${estateIds.size} estates, with ${blocks.length} blocked nights and ${inquiries.length} demo inquiries.`,
  );
  say("Remove them with: npm run seed:demo:remove");
}

const mode = process.argv[2];
if (mode === "add") await add();
else if (mode === "remove") await remove();
else throw new Error('Use "add" or "remove".');
