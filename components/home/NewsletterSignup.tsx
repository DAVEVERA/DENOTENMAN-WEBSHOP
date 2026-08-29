"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export type NewsletterSignupCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  emailLabel: string;
  emailPlaceholder: string;
  consentText: string;
  privacyLinkLabel: string;
  submit: string;
  submitting: string;
  success: string;
  invalid: string;
  unavailable: string;
  rateLimited: string;
};

type SubmissionState =
  | "idle"
  | "submitting"
  | "success"
  | "invalid"
  | "unavailable"
  | "rate-limited";

export function NewsletterSignup({
  locale,
  privacyHref,
  copy,
}: {
  locale: Locale;
  privacyHref: string;
  copy: NewsletterSignupCopy;
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<SubmissionState>("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) {
      setState("invalid");
      return;
    }

    const form = event.currentTarget;
    const website = String(new FormData(form).get("website") ?? "");
    setState("submitting");

    try {
      const response = await fetch("/api/mailchimp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, consent, website }),
      });

      if (response.ok) {
        setEmail("");
        setConsent(false);
        form.reset();
        setState("success");
        return;
      }

      if (response.status === 429) {
        setState("rate-limited");
      } else if (response.status === 400) {
        setState("invalid");
      } else {
        setState("unavailable");
      }
    } catch {
      setState("unavailable");
    }
  }

  const message =
    state === "success"
      ? copy.success
      : state === "invalid"
        ? copy.invalid
        : state === "rate-limited"
          ? copy.rateLimited
          : state === "unavailable"
            ? copy.unavailable
            : "";

  return (
    <section
      id="newsletter-signup"
      data-home-section="newsletter"
      aria-labelledby="newsletter-signup-title"
      className="bg-transparent px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14"
    >
      <div className="mx-auto grid max-w-[58rem] gap-7 rounded-[0.7rem] bg-[#121212] p-5 text-surface shadow-card sm:p-7 lg:grid-cols-[minmax(17rem,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-8 lg:px-8 lg:py-7">
        <div className="border-b-4 border-black pb-4 lg:border-b-0 lg:pb-0">
          <h2
            id="newsletter-signup-title"
            className="max-w-[22rem] font-heading text-[clamp(1.75rem,3vw,2.35rem)] font-bold leading-[1.13] tracking-[-0.025em] text-surface"
          >
            {copy.title}
          </h2>
        </div>

        <form
          onSubmit={submit}
          aria-busy={state === "submitting"}
          className="min-w-0"
        >
          <label
            htmlFor="newsletter-email"
            className="block font-heading text-body-md font-bold text-surface sm:text-body-sm"
          >
            {copy.emailLabel}
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              />
              <input
                id="newsletter-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={254}
                aria-describedby="newsletter-message"
                aria-invalid={state === "invalid" ? true : undefined}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (state !== "submitting") setState("idle");
                }}
                placeholder={copy.emailPlaceholder}
                className="min-h-12 w-full rounded-[0.45rem] border border-transparent bg-surface py-3 pl-12 pr-4 text-body-md text-text placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
              />
            </div>
            <button
              type="submit"
              disabled={state === "submitting" || !consent}
              className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-[0.45rem] bg-accent px-5 font-heading text-body-md font-bold text-contrast shadow-button transition-colors hover:bg-[#F2C500] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-body-sm"
            >
              {state === "submitting" ? copy.submitting : copy.submit}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div
            className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label htmlFor="newsletter-website">Website</label>
            <input
              id="newsletter-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-body-md leading-6 text-surface/85 sm:text-body-sm sm:leading-5">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                if (state !== "submitting") setState("idle");
              }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#E0B200] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
            />
            <span>
              {copy.consentText}{" "}
              <Link
                href={privacyHref}
                className="font-semibold text-surface underline decoration-surface/50 underline-offset-4 hover:decoration-surface"
              >
                {copy.privacyLinkLabel}
              </Link>
            </span>
          </label>

          <p
            id="newsletter-message"
            className={`min-h-0 text-body-sm font-semibold ${message ? "mt-2" : "h-0 overflow-hidden"} ${state === "success" ? "text-green-300" : "text-red-300"}`}
            role={
              state === "success" ? "status" : message ? "alert" : undefined
            }
            aria-live="polite"
          >
            {message}
          </p>
        </form>
      </div>
    </section>
  );
}
