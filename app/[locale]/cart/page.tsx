import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";
import { CartPanel } from "@/components/cart/CartPanel";
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

  return (
    <Container className="py-10">
      <h1 className="text-heading-xl">{dictionary.cart.title}</h1>
      <div className="mt-8">
        <CartPanel
          locale={locale}
          labels={{
            empty: dictionary.cart.empty,
            total: dictionary.cart.total,
            checkout: dictionary.cart.checkout,
            remove: dictionary.cart.remove,
            decrease: dictionary.cart.decrease,
            increase: dictionary.cart.increase,
          }}
        />
      </div>
    </Container>
  );
}
