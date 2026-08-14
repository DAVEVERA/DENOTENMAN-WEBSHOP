import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";
import { FavoritesPanel } from "@/components/account/FavoritesPanel";
import { OrderLookup } from "@/components/account/OrderLookup";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function AccountPage({
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
      <h1 className="text-heading-xl">{dictionary.account.title}</h1>

      <div className="mt-8">
        <h2 className="text-heading-lg text-text">{dictionary.accountOrders.title}</h2>
        <div className="mt-4">
          <OrderLookup
            locale={locale}
            dictionary={dictionary.accountOrders}
            checkoutDictionary={dictionary.checkout}
            orderDictionary={dictionary.order}
          />
        </div>
      </div>

      <div className="mt-10">
        <FavoritesPanel
          locale={locale}
          labels={{
            title: dictionary.account.favorites,
            empty: dictionary.account.favoritesEmpty,
            savedOnDevice: dictionary.account.savedOnDevice,
            remove: dictionary.product.removeFromFavorites,
            viewProduct: dictionary.product.viewProduct,
          }}
        />
      </div>
    </Container>
  );
}
