import Image from "next/image";
import Link from "next/link";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { product as productPath, categories as categoriesPath } from "@/lib/routes";

const favoriteImages = [
  "https://storage.googleapis.com/notenbucket/products/pistaches-gepeld-gebrand/4d5460ea-9512-4023-b44f-afbe8cd8a559.webp",
  "https://storage.googleapis.com/notenbucket/products/cashewnoten-gezouten/8ed685fe-e5df-4b43-b4d4-aa0e6eb6dea6.webp",
  "https://storage.googleapis.com/notenbucket/products/pecannoten-gezouten/84a4f2b8-b028-404d-afd4-717774743972.webp",
] as const;

type FavoriteCopy = {
  slug: string;
  name: string;
  meta: string;
  copy: string;
  ctaLabel: string;
};

type FavoriteProduct = FavoriteCopy & {
  imageUrl: string;
};

export function VideoHero({ locale, dictionary }: { locale: Locale; dictionary: typeof nl }) {
  const favorites: FavoriteProduct[] = dictionary.hero.favorites.map((favorite, index) => ({
    ...favorite,
    imageUrl: favoriteImages[index] ?? favoriteImages[0],
  }));

  return (
    <section className="video-hero" aria-labelledby="hero-title">
      <Image
        src="/hero/hero_bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="video-hero__bg"
      />
      <div className="video-hero__content">
        <div className="video-hero__chalkboard">
          <div className="video-hero__eyebrow">De Notenman</div>
          <h1 id="hero-title" className="video-hero__title">
            {dictionary.hero.headline}
          </h1>
          <p className="video-hero__intro">{dictionary.hero.intro}</p>
          <a className="video-hero__button" href={categoriesPath(locale)}>
            {dictionary.hero.cta}
          </a>
        </div>

        <section className="video-hero__favorites" aria-labelledby="favorites-title">
          <div className="video-hero__favorites-header">
            <h2 id="favorites-title" className="video-hero__favorites-title">
              {dictionary.hero.favoritesTitle}
            </h2>
          </div>

          <div className="video-hero__grid">
            {favorites.map((item) => (
              <article key={item.slug} className="video-hero__card">
                <img
                  className="video-hero__card-image"
                  src={item.imageUrl}
                  alt={item.name}
                  width={900}
                  height={900}
                />
                <div className="video-hero__card-body">
                  <p className="video-hero__card-meta">{item.meta}</p>
                  <h3 className="video-hero__card-title">{item.name}</h3>
                  <p className="video-hero__card-copy">{item.copy}</p>
                  <Link
                    className="video-hero__button video-hero__button--product"
                    href={productPath(locale, item.slug)}
                  >
                    {item.ctaLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
