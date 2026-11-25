import { publicImageUrl } from "@/lib/storage";

// The public pages whose search details are edited in Settings. These defaults are used
// for any field left blank, so a page always has a title and description.
export const PAGE_SEO = {
  "/": {
    label: "Homepage",
    title: "Halal Accommodation South Africa | Bargain Breaks",
    description: "Halal-conscious holiday homes from the coast to the mountains, personally reviewed by Naseema.",
  },
  "/properties": {
    label: "Properties",
    title: "Holiday Homes and Resorts | Bargain Breaks",
    description: "Browse halal accommodation across the Drakensberg and beyond, with details of every home.",
  },
  "/about": {
    label: "About",
    title: "About Us | Bargain Breaks",
    description: "Who we are and how we choose halal-conscious holiday accommodation for families.",
  },
  "/contact": {
    label: "Contact",
    title: "Contact Us | Bargain Breaks",
    description: "Send us an inquiry about halal accommodation and we will confirm the details personally.",
  },
  "/journal": {
    label: "Journal",
    title: "Journal | Bargain Breaks",
    description: "Travel ideas and guides for halal-friendly holidays in South Africa.",
  },
  "/privacy": {
    label: "Privacy policy",
    title: "Privacy Policy | Bargain Breaks",
    description: "How Bargain Breaks collects, uses and protects your personal information under POPIA.",
  },
} as const;

export type SeoPath = keyof typeof PAGE_SEO;

export const SEO_PATHS = Object.keys(PAGE_SEO) as SeoPath[];

// Search engines cut off at about these lengths; longer text is allowed but warned about.
export const SEO_SOFT_LIMITS = { title: 60, description: 155 } as const;

type SavedSeo = { title: string | null; description: string | null; og_image_path: string | null } | null;

// Each blank field falls back on its own, so a page never goes out without a title or description.
export function resolvePageSeo(path: SeoPath, row: SavedSeo) {
  const defaults = PAGE_SEO[path];
  return {
    title: row?.title?.trim() || defaults.title,
    description: row?.description?.trim() || defaults.description,
    image: row?.og_image_path ? publicImageUrl("property-photos", row.og_image_path) : null,
  };
}
