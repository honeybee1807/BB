import type { Metadata } from "next";
import { InquiryCard } from "@/components/site/inquiry-form";
import { SectionHeading } from "@/components/site/section-heading";
import { publicEnv } from "@/lib/env";
import { staticPageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata("/contact", {
    title: "Contact Us | Bargain Breaks",
    description: "Send us an inquiry about halal accommodation and we will confirm the details personally.",
  });
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
      <SectionHeading level={1} title="Contact us" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
        <div className="flex max-w-xl flex-col gap-5 text-[17px] leading-relaxed text-ink">
          <p className="font-serif text-2xl leading-snug text-navy">The easiest way to reach us is the inquiry form.</p>
          <p>
            Tell us your dates, how many people are coming and anything you need, such as halal accommodation, a
            ground-floor room or space for a cot. If you have a home in mind, say so in your message.
          </p>
          <p>
            We read every inquiry personally, check availability with the home and reply by email or phone. Nothing is
            booked until we have spoken to you.
          </p>
        </div>
        <InquiryCard siteKey={publicEnv.turnstileSiteKey} />
      </div>
    </div>
  );
}
