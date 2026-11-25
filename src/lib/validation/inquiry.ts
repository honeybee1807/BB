import { z } from "zod";
import { daysBetween, todayInSast } from "@/lib/format";

export const MAX_NIGHTS = 60;

const date = (message: string) => z.iso.date({ error: message });

const count = (min: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, { error: message })
    .transform(Number)
    .refine((n) => n >= min && n <= 30, { error: message });

const optionalRand = z
  .string()
  .trim()
  .regex(/^\d{0,8}$/, { error: "Use whole rand, numbers only." })
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((n) => n === null || n <= 10_000_000, { error: "That amount is too high." });

// Form fields are strings, so the browser and the route parse exactly the same values.
export const inquirySchema = z
  .strictObject({
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Please enter your full name." })
      .max(100, { error: "Please keep your name under 100 characters." }),
    email: z.email({ error: "Please enter a valid email address." }).trim().max(254),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9 +()]{7,20}$/, { error: "Please enter a phone number using digits, spaces, + or brackets." })
      .refine((v) => v.replace(/\D/g, "").length >= 7, { error: "Please enter a phone number we can call." }),
    checkIn: date("Please choose a check-in date."),
    checkOut: date("Please choose a check-out date."),
    adults: count(1, "Please enter between 1 and 30 adults."),
    children: count(0, "Please enter between 0 and 30 children."),
    budgetMin: optionalRand,
    budgetMax: optionalRand,
    accommodationType: z.enum(["no_preference", "resort", "holiday_home"], {
      error: "Please choose an accommodation type.",
    }),
    requirements: z.string().trim().max(2000, { error: "Please keep this under 2,000 characters." }),
    consent: z.literal(true, { error: "Please agree so we can contact you about your stay." }),
    propertyId: z.uuid().optional(),
    turnstileToken: z.string().min(1, { error: "Please complete the security check." }).max(2048),
    // honeypot, hidden from people
    website: z.string().max(200),
  })
  .superRefine((v, ctx) => {
    if (v.checkIn < todayInSast()) {
      ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Check-in can't be in the past." });
    }
    if (v.checkOut <= v.checkIn) {
      ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in." });
    } else if (daysBetween(v.checkIn, v.checkOut) > MAX_NIGHTS) {
      ctx.addIssue({ code: "custom", path: ["checkOut"], message: `Stays can be up to ${MAX_NIGHTS} nights.` });
    }
    if (v.budgetMin !== null && v.budgetMax !== null && v.budgetMax < v.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "The maximum can't be below the minimum." });
    }
  });

export type InquiryForm = z.input<typeof inquirySchema>;
export type Inquiry = z.output<typeof inquirySchema>;
