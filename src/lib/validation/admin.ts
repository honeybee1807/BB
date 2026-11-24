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
