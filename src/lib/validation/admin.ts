import { z } from "zod";
import { daysBetween, todayInSast } from "@/lib/format";
import { STATUSES } from "@/lib/admin-format";

export const inquiryUpdateSchema = z
  .strictObject({
    status: z.enum(STATUSES).optional(),
    assignedTo: z.uuid().nullable().optional(),
    notes: z.string().max(5000, { error: "Please keep notes under 5,000 characters." }).optional(),
  })
  .refine((v) => v.status !== undefined || v.assignedTo !== undefined || v.notes !== undefined, {
    error: "Nothing to change.",
  });

export type InquiryUpdate = z.infer<typeof inquiryUpdateSchema>;

export const availabilitySchema = z
  .strictObject({
    propertyId: z.uuid(),
    from: z.iso.date(),
    to: z.iso.date(),
    action: z.enum(["block", "open"]),
  })
  .superRefine((v, ctx) => {
    if (v.to < v.from) ctx.addIssue({ code: "custom", path: ["to"], message: "The end date is before the start." });
    else if (daysBetween(v.from, v.to) >= 366)
      ctx.addIssue({ code: "custom", path: ["to"], message: "Choose a range of up to a year." });
    if (v.from < todayInSast()) ctx.addIssue({ code: "custom", path: ["from"], message: "Past dates can't change." });
  });

export type AvailabilityChange = z.infer<typeof availabilitySchema>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `Please add ${label}.` })
    .max(max, { error: `Please keep ${label} under ${max} characters.` });
// Blank optional text is stored as null so the public site can hide it.
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Please keep this under ${max} characters.` })
    .transform((v) => v || null);
const count = (min: number, max: number) => z.int().min(min).max(max).nullable();
const slug = z
  .string()
  .trim()
  .max(120)
  .regex(SLUG, { error: "Use lowercase letters, numbers and single hyphens for the web address." });
const seo = { seo_title: optional(120), seo_description: optional(320) };

export const regionSchema = z.strictObject({
  name: required("a name", 120),
  slug,
  description: optional(10000),
  sort_order: z.int().min(-1000).max(1000),
  ...seo,
});

export const estateSchema = regionSchema.extend({ region_id: z.uuid() });

const customField = z.strictObject({ label: required("a label", 60), value: z.string().trim().max(500) });

export const propertySchema = z.strictObject({
  estate_id: z.uuid({ error: "Choose an estate." }),
  name: required("a name", 120),
  slug,
  summary: optional(300),
  description: optional(10000),
  property_type: z.enum(["holiday_home", "resort"]),
  town: optional(120),
  max_guests: count(1, 100),
  bedrooms: count(0, 50),
  bathrooms: count(0, 50),
  is_halal: z.boolean(),
  halal_details: optional(3000),
  price_from_zar: count(0, 10_000_000),
  is_featured: z.boolean(),
  featured_sort_order: z.int().min(-1000).max(1000),
  is_published: z.boolean(),
  instagram_video_url: optional(300).refine(
    (v) =>
      v === null ||
      /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?(\?[A-Za-z0-9_=&%.-]*)?$/.test(v),
    { error: "Paste a link to an Instagram post or reel." },
  ),
  custom_fields: z.array(customField).max(30),
  ...seo,
});

export const publishSchema = z.strictObject({ is_published: z.boolean() });

export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export const uploadSchema = z.strictObject({
  contentType: z.enum(UPLOAD_TYPES, { error: "Please choose a JPEG, PNG or WebP image." }),
  size: z.int().min(1).max(UPLOAD_MAX_BYTES, { error: "Please choose an image under 15 MB." }),
});

export const photoAddSchema = z.strictObject({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/),
  alt_text: z.string().trim().max(250),
});

export const photoUpdateSchema = z
  .strictObject({ alt_text: z.string().trim().max(250).optional(), is_cover: z.literal(true).optional() })
  .refine((v) => v.alt_text !== undefined || v.is_cover !== undefined, { error: "Nothing to change." });

export const photoOrderSchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(20) });

export const postSchema = z.strictObject({
  title: required("a title", 160),
  slug,
  excerpt: optional(300),
  body_md: z.string().max(50000, { error: "Please keep the post under 50,000 characters." }),
  is_published: z.boolean(),
  ...seo,
});

export const coverSchema = z.strictObject({ path: photoAddSchema.shape.path.nullable() });

export const testimonialSchema = z.strictObject({
  guest_name: required("the guest's name", 80),
  place: optional(80),
  quote: required("the quote", 600),
  is_visible: z.boolean(),
  sort_order: z.int().min(-1000).max(1000),
});
