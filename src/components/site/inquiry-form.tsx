"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import { addDays, todayInSast } from "@/lib/format";
import { inquirySchema, type Inquiry, type InquiryForm as Values } from "@/lib/validation/inquiry";
import { Turnstile } from "./turnstile";

type Status = "idle" | "sending" | "sent" | "failed";
type Name = Exclude<keyof Values, "consent" | "propertyId" | "turnstileToken" | "website">;

const GENERIC_ERROR = "Sorry, we couldn't send your inquiry just now. Please try again.";

const noop = () => () => {};

// The label sits inside the top of the field, so it stays visible and the card stays compact.
const fieldClass =
  "block h-13.5 w-full rounded-public border border-field bg-white px-4 pt-5 pb-1.5 text-[15px] text-ink aria-invalid:border-danger";

const errorId = (name: string) => `inquiry-${name}-error`;

function ErrorText({ name, text }: { name: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={errorId(name)} className="mt-1.5 text-[13px] text-danger">
      {text}
    </p>
  );
}

function Field({
  name,
  label,
  optional,
  error,
  children,
}: {
  name: Name;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        <label
          htmlFor={`inquiry-${name}`}
          className="pointer-events-none absolute top-2 left-4 text-[11px] font-medium text-muted"
        >
          {label}
          {optional && " (optional)"}
        </label>
        {children}
      </div>
      <ErrorText name={name} text={error} />
    </div>
  );
}

export function InquiryCard({
  siteKey,
  property,
  className = "",
}: {
  siteKey: string;
  property?: { id: string; name: string };
  className?: string;
}) {
  return (
    <section
      aria-labelledby="inquiry-heading"
      className={`bg-white shadow-[0_24px_60px_-12px_rgb(11_42_61/0.28)] ${className}`}
    >
      <div className="on-dark bg-navy px-6 py-7 text-center text-white">
        <h2 id="inquiry-heading" className="font-serif text-2xl tracking-[0.06em] uppercase">
          Inquiry form
        </h2>
        <p className="mt-1.5 text-[13px] text-white/85">We&apos;ll help you find the perfect stay.</p>
      </div>
      <InquiryForm siteKey={siteKey} property={property} />
    </section>
  );
}

function InquiryForm({ siteKey, property }: { siteKey: string; property?: { id: string; name: string } }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const message = useRef<HTMLDivElement>(null);
  // the page is prerendered, so today is read in the browser
  const today = useSyncExternalStore(noop, todayInSast, () => undefined);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitted },
  } = useForm<Values, unknown, Inquiry>({
    resolver: zodResolver(inquirySchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      checkIn: "",
      checkOut: "",
      adults: "2",
      children: "0",
      budgetMin: "",
      budgetMax: "",
      accommodationType: "no_preference",
      requirements: "",
      propertyId: property?.id,
      turnstileToken: "",
      website: "",
    },
  });

  const checkIn = useWatch({ control, name: "checkIn" });

  const onToken = useCallback(
    (token: string) => setValue("turnstileToken", token, { shouldValidate: isSubmitted }),
    [setValue, isSubmitted],
  );

  useEffect(() => {
    if (status === "sent" || status === "failed") message.current?.focus();
  }, [status]);

  const send = handleSubmit(async () => {
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getValues()),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    }
    setValue("turnstileToken", "");
    setResetCount((n) => n + 1);
    setStatus("failed");
  });

  if (status === "sent") {
    return (
      <div ref={message} tabIndex={-1} role="status" className="px-8 py-12 text-center outline-none">
        <p className="font-serif text-2xl text-navy">Thank you</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your inquiry is on its way. We read every one personally and will be in touch soon to talk about your stay.
        </p>
      </div>
    );
  }

  const a11y = (name: keyof typeof errors) => ({
    id: `inquiry-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? errorId(name) : undefined,
  });

  return (
    <form noValidate onSubmit={send} className="relative flex flex-col gap-4 px-5 py-7 sm:px-8">
      {property && (
        <p className="text-sm text-muted">
          Inquiring about <span className="font-semibold text-navy">{property.name}</span>
        </p>
      )}

      <div className="grid gap-4 min-[420px]:grid-cols-2">
        <Field name="fullName" error={errors.fullName?.message} label="Full name">
          <input {...register("fullName")} {...a11y("fullName")} autoComplete="name" className={fieldClass} />
        </Field>
        <Field name="email" error={errors.email?.message} label="Email address">
          <input {...register("email")} {...a11y("email")} type="email" autoComplete="email" className={fieldClass} />
        </Field>
      </div>

      <Field name="phone" error={errors.phone?.message} label="Phone number">
        <input {...register("phone")} {...a11y("phone")} type="tel" autoComplete="tel" className={fieldClass} />
      </Field>

      <div className="grid gap-4 min-[420px]:grid-cols-2">
        <Field name="checkIn" error={errors.checkIn?.message} label="Check-in date">
          <input {...register("checkIn")} {...a11y("checkIn")} type="date" min={today} className={fieldClass} />
        </Field>
        <Field name="checkOut" error={errors.checkOut?.message} label="Check-out date">
          <input
            {...register("checkOut")}
            {...a11y("checkOut")}
            type="date"
            min={checkIn ? addDays(checkIn, 1) : today}
            className={fieldClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field name="adults" error={errors.adults?.message} label="Adults">
          <input
            {...register("adults")}
            {...a11y("adults")}
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            className={fieldClass}
          />
        </Field>
        <Field name="children" error={errors.children?.message} label="Children">
          <input
            {...register("children")}
            {...a11y("children")}
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            className={fieldClass}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-navy">
          Budget <span className="font-normal text-muted">(optional, whole rand)</span>
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field name="budgetMin" error={errors.budgetMin?.message} label="Minimum (R)">
            <input {...register("budgetMin")} {...a11y("budgetMin")} inputMode="numeric" className={fieldClass} />
          </Field>
          <Field name="budgetMax" error={errors.budgetMax?.message} label="Maximum (R)">
            <input {...register("budgetMax")} {...a11y("budgetMax")} inputMode="numeric" className={fieldClass} />
          </Field>
        </div>
      </fieldset>

      <Field name="accommodationType" error={errors.accommodationType?.message} label="Accommodation type">
        <select {...register("accommodationType")} {...a11y("accommodationType")} className={fieldClass}>
          <option value="no_preference">No preference</option>
          <option value="resort">Resort</option>
          <option value="holiday_home">Holiday home</option>
        </select>
      </Field>

      <Field name="requirements" error={errors.requirements?.message} label="Additional requirements" optional>
        <textarea
          {...register("requirements")}
          {...a11y("requirements")}
          rows={4}
          className={`${fieldClass} h-auto pt-7 leading-relaxed`}
        />
      </Field>

      <div>
        <div className="flex gap-3">
          <input
            {...register("consent")}
            {...a11y("consent")}
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-teal"
          />
          <label htmlFor="inquiry-consent" className="text-[13px] leading-relaxed text-muted">
            I agree that Bargain Breaks may use these details to reply to my inquiry, as set out in the{" "}
            <Link href="/privacy" className="text-navy underline underline-offset-2">
              privacy notice
            </Link>
            .
          </label>
        </div>
        <ErrorText name="consent" text={errors.consent?.message} />
      </div>

      <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label htmlFor="inquiry-website">Website</label>
        <input {...register("website")} id="inquiry-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <Turnstile siteKey={siteKey} onToken={onToken} resetCount={resetCount} />
        <ErrorText name="turnstileToken" text={errors.turnstileToken?.message} />
      </div>

      {status === "failed" && (
        <div
          ref={message}
          tabIndex={-1}
          role="alert"
          className="border-l-4 border-danger bg-sand-light px-4 py-3 outline-none"
        >
          <p className="text-sm text-ink">{error}</p>
          <p className="mt-1 text-[13px] text-muted">Your details are still here, so you can send it again.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-1 h-13.5 w-full bg-teal text-[13px] font-bold tracking-[0.16em] text-white uppercase transition-colors duration-150 hover:bg-teal-hover disabled:cursor-wait disabled:opacity-70"
      >
        {status === "sending" ? "Sending..." : status === "failed" ? "Try again" : "Send inquiry"}
      </button>
    </form>
  );
}
