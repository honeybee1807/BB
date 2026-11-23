import { after } from "next/server";
import { sendInquiryAlert } from "@/lib/email/send";
import { inquiryEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { daysBetween } from "@/lib/format";
import { json, readJsonBody, responses } from "@/lib/http";
import { getClientIp } from "@/lib/security/client-info";
import { hashIdentifier } from "@/lib/security/hash";
import { isSameOrigin } from "@/lib/security/origin";
import { INQUIRY_LIMITS, hit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { getAdminClient } from "@/lib/supabase/admin";
import { getPublicClient } from "@/lib/supabase/public";
import { inquirySchema } from "@/lib/validation/inquiry";

const THANKS = { ok: true };

// Cheap checks run before the Turnstile call and the database. Only a plain success goes back.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return responses.forbiddenOrigin();

  const parsed = inquirySchema.safeParse(await readJsonBody(request, 20_000));
  if (!parsed.success) return responses.badRequest();
  const inquiry = parsed.data;

  // bots that fill the hidden field get the normal reply and nothing is stored
  if (inquiry.website !== "") return json(THANKS);

  const ip = getClientIp(request.headers);
  if (!(await verifyTurnstile(inquiry.turnstileToken, ip))) {
    return responses.badRequest("We couldn't complete the security check. Please try again.");
  }

  const ipKey = hashIdentifier("ip", ip);
  try {
    for (const { bucket, max, windowSeconds } of INQUIRY_LIMITS) {
      if (!(await hit(bucket, ipKey, windowSeconds, max))) {
        return json(
          { ok: false, error: "We've had several inquiries from you already. Please try again a little later." },
          429,
        );
      }
    }
  } catch {
    return responses.serverError();
  }

  // An unpublished or unknown property is dropped rather than losing the inquiry.
  let property: { id: string; name: string } | null = null;
  if (inquiry.propertyId) {
    const { data } = await getPublicClient()
      .from("properties")
      .select("id, name")
      .eq("id", inquiry.propertyId)
      .maybeSingle();
    property = data;
  }

  const id = crypto.randomUUID();
  const admin = getAdminClient();
  const { error } = await admin.from("inquiries").insert({
    id,
    guest_name: inquiry.fullName,
    guest_email: inquiry.email,
    guest_phone: inquiry.phone,
    check_in: inquiry.checkIn,
    check_out: inquiry.checkOut,
    adults: inquiry.adults,
    children: inquiry.children,
    budget_min_zar: inquiry.budgetMin,
    budget_max_zar: inquiry.budgetMax,
    accommodation_type: inquiry.accommodationType,
    additional_requirements: inquiry.requirements || null,
    property_id: property?.id ?? null,
    consent_given_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[inquiry] insert failed:", error.code);
    return responses.serverError();
  }

  // A failed email keeps the inquiry; email_sent_at stays empty so the team can see it.
  after(async () => {
    const content = inquiryEmail({
      adminUrl: `${publicEnv.siteUrl}/admin/inquiries/${id}`,
      fullName: inquiry.fullName,
      email: inquiry.email,
      phone: inquiry.phone,
      checkIn: inquiry.checkIn,
      checkOut: inquiry.checkOut,
      nights: daysBetween(inquiry.checkIn, inquiry.checkOut),
      adults: inquiry.adults,
      children: inquiry.children,
      budgetMin: inquiry.budgetMin,
      budgetMax: inquiry.budgetMax,
      accommodationType: inquiry.accommodationType,
      propertyName: property?.name ?? null,
      requirements: inquiry.requirements,
    });
    const { sent } = await sendInquiryAlert(content, inquiry.email);
    if (!sent) return;
    const { error: updateError } = await admin
      .from("inquiries")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) console.error("[inquiry] email_sent_at update failed:", updateError.code);
  });

  return json(THANKS);
}
