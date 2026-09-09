import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";
import { CartPanel } from "@/components/cart/CartPanel";
import { COUNTRY_PREFERENCE_COOKIE, parseCountryPreference } from "@/lib/country-preference";
import { getShippingPolicy } from "@/lib/shipping";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = dictionaries[locale];
  const cookieStore = await cookies();
  const country = parseCountryPreference(cookieStore.get(COUNTRY_PREFERENCE_COOKIE)?.value) ?? "NL";
  const freeShippingThresholdCents = getShippingPolicy(country).freeShippingThresholdCents;

  return (
    <Container className="py-10">
      <h1 className="text-heading-xl">{dictionary.cart.title}</h1>
      <div className="mt-8">
        <CartPanel
          locale={locale}
          freeShippingThresholdCents={freeShippingThresholdCents}
          labels={{
            empty: dictionary.cart.empty,
            total: dictionary.cart.total,
            checkout: dictionary.cart.checkout,
            remove: dictionary.cart.remove,
            decrease: dictionary.cart.decrease,
            increase: dictionary.cart.increase,
            freeShippingProgress: dictionary.cart.freeShippingProgress,
            freeShippingReached: dictionary.cart.freeShippingReached,
          }}
        />
      </div>
    </Container>
  );
}
