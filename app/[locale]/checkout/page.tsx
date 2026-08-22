import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";
import { CheckoutBackLink } from "@/components/checkout/CheckoutBackLink";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  return {
    title: `${dictionaries[locale].checkout.title} | De Notenman`,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = dictionaries[locale];

  return (
    <Container className="py-10">
      <CheckoutBackLink locale={locale} label={dictionary.checkout.backToCart} />
      <h1 className="mt-4 text-heading-xl">{dictionary.checkout.title}</h1>
      <div className="mt-8">
        <CheckoutForm locale={locale} dictionary={dictionary.checkout} />
      </div>
    </Container>
  );
}
