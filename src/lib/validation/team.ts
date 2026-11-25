import { z } from "zod";

const role = z.enum(["owner", "team_member"], { error: "Choose a role." });

export const inviteSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address." }).max(254)),
  role,
});

export const inviteActionSchema = z.strictObject({ action: z.enum(["resend", "cancel"]) });

export const memberUpdateSchema = z.union([z.strictObject({ role }), z.strictObject({ active: z.boolean() })]);

const fullName = z.string().trim().min(1, { error: "Enter your name." }).max(100);
const password = z
  .string()
  .min(12, { error: "Use at least 12 characters." })
  .max(200, { error: "Use 200 characters or fewer." });

export const acceptInviteSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  fullName,
  password,
});

export const acceptFormSchema = z
  .strictObject({ fullName, password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "The passwords don't match." });
export type AcceptFormInput = z.input<typeof acceptFormSchema>;
