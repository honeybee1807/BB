import type { Metadata } from "next";
import { SectionHeading } from "@/components/site/section-heading";
import { staticPageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata("/privacy", {
    title: "Privacy Policy | Bargain Breaks",
    description: "How Bargain Breaks collects, uses and protects your personal information under POPIA.",
  });
}

const SECTIONS = [
  {
    title: "What we collect",
    body: "When you send an inquiry we collect your name, email address, phone number, travel dates, the number of adults and children, your budget if you give one, your accommodation preference and anything you write in your message. We also record the date and time you agreed to this notice.",
  },
  {
    title: "Why we collect it",
    body: "We use your details only to answer your inquiry, check availability with the home and arrange your stay. We do not sell your information, and we do not add you to a mailing list.",
  },
  {
    title: "Who can see it",
    body: "Only the Bargain Breaks team can see your inquiry. Where we need to check availability or confirm a stay, we share only what the home needs to know. Our website and email providers store the information on our behalf and may not use it for anything else.",
  },
  {
    title: "Keeping it safe",
    body: "Inquiries are stored in a secure database that only our signed-in team can reach. Team accounts are protected with strong passwords, and the owner account with a second sign-in step.",
  },
  {
    title: "Spam protection",
    body: "The inquiry form uses Cloudflare Turnstile to check that a person, not a program, is sending it. Turnstile may process technical details such as your IP address for this check only.",
  },
  {
    title: "Your rights",
    body: "Under the Protection of Personal Information Act (POPIA) you may ask what information we hold about you, ask us to correct it, or ask us to delete it. Reply to any email from us to make a request. You may also complain to the Information Regulator of South Africa.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
      <SectionHeading level={1} title="Privacy notice" />
      <div className="mt-10 flex max-w-2xl flex-col gap-10 text-[16px] leading-relaxed text-ink">
        <p className="font-serif text-xl leading-snug text-navy">
          This notice explains what Bargain Breaks does with the personal information you give us through this website.
        </p>
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-[13px] font-bold tracking-[0.12em] text-navy uppercase">{s.title}</h2>
            <p className="mt-3">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
