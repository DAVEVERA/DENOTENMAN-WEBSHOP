import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

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
      <h1 className="text-heading-xl">{dictionary.checkout.title}</h1>
      <div className="mt-8">
        <CheckoutForm locale={locale} dictionary={dictionary.checkout} />
      </div>
    </Container>
  );
}
