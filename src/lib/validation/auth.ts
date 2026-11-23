import { z } from "zod";

/** Shared by the login form (client) and the login route (server). Unknown keys are rejected. */
export const loginSchema = z.strictObject({
  email: z.email({ error: "Enter a valid email address." }).max(254),
  password: z.string().min(1, { error: "Enter your password." }).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaEnrolSchema = z.strictObject({});

export const mfaVerifySchema = z.strictObject({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code from your authenticator app." }),
});

export const logoutSchema = z.strictObject({
  reason: z.enum(["user", "idle"]).optional(),
});
