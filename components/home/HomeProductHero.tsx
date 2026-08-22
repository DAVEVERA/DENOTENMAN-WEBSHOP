import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import type { HomeSliderProductDto } from "@/lib/home-product-slider";
import { HomeProductSlider } from "@/components/home/HomeProductSlider";

export function HomeProductHero({
  locale,
  dictionary,
  products,
}: {
  locale: Locale;
  dictionary: typeof nl;
  products: HomeSliderProductDto[];
}) {
  return (
    <section aria-labelledby="home-product-hero-title">
      {products.length > 0 ? (
        <HomeProductSlider
          locale={locale}
          products={products}
          copy={{
            carouselLabel: dictionary.hero.carouselLabel,
            touchHint: dictionary.hero.touchHint,
            openProduct: dictionary.product.openQuickView,
            previous: dictionary.hero.previous,
            next: dictionary.hero.next,
            pause: dictionary.hero.pauseCarousel,
            resume: dictionary.hero.resumeCarousel,
            position: dictionary.hero.productPosition,
            fromPrice: dictionary.hero.fromPrice,
            close: dictionary.product.closeDetails,
            quickOrder: dictionary.product.quickOrder,
            moreInfo: dictionary.product.moreInfo,
            outOfStock: dictionary.product.outOfStock,
            added: dictionary.product.addedToCart,
            goToCart: dictionary.product.goToCart,
            continueShopping: dictionary.product.continueShopping,
            addToFavorites: dictionary.product.addToFavorites,
            removeFromFavorites: dictionary.product.removeFromFavorites,
          }}
        />
      ) : null}
      <h1 id="home-product-hero-title" className="sr-only">
        {dictionary.hero.accessibleHeadline}
      </h1>
    </section>
  );
}
