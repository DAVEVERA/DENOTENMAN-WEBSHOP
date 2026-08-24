import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getBusinessPortalSession } from "@/lib/business-portal";
import { Logo } from "@/components/ui/Logo";
import { BusinessInvitationLoginForm } from "./BusinessInvitationLoginForm";
import { BusinessLoginLinkRequestForm } from "./BusinessLoginLinkRequestForm";

export const metadata: Metadata = { title: "Zakelijk inloggen | De Notenman", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ZakelijkInloggenPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/nl/zakelijk/inloggen");
  if (await getBusinessPortalSession()) redirect(`/${locale}/zakelijk`);
  const { token } = await searchParams;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff9da,transparent_38%),linear-gradient(180deg,#fff,#f7f2e6)] px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center"><Logo alt={{ mark: "De Notenman beeldmerk", wordmark: "De Notenman" }} parts="wordmark" size="responsive" /></div>
        <main className="mt-8 rounded-panel border border-border bg-surface p-5 shadow-card sm:p-8">
          <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Zakelijke omgeving</p>
          <h1 className="mt-2 text-center font-heading text-heading-lg text-text">Persoonlijke toegang</h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-body-sm leading-relaxed text-muted">Bekijk de bestellijsten die Fedor voor jouw bedrijf heeft klaargezet, pas aantallen aan en keur ze goed.</p>
          {token ? <BusinessInvitationLoginForm token={token} locale={locale} /> : <BusinessLoginLinkRequestForm />}
        </main>
      </div>
    </div>
  );
}
