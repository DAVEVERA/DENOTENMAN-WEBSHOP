import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import { product as productPath, categories as categoriesPath } from "@/lib/routes";

type FavoriteProduct = {
  slug: string;
  name: string;
  imageUrl: string;
  meta: string;
  copy: string;
  ctaLabel: string;
};

const favorites: FavoriteProduct[] = [
  {
    slug: "pistaches-gepeld-gebrand",
    name: "Pistache",
    imageUrl:
      "https://storage.googleapis.com/notenbucket/products/pistaches-gepeld-gebrand/4d5460ea-9512-4023-b44f-afbe8cd8a559.webp",
    meta: "Vers gebrand",
    copy: "Knapperig, vol van smaak en vers uit onze kraam.",
    ctaLabel: "Bestel pistache",
  },
  {
    slug: "cashewnoten-gezouten",
    name: "Cashew",
    imageUrl:
      "https://storage.googleapis.com/notenbucket/products/cashewnoten-gezouten/8ed685fe-e5df-4b43-b4d4-aa0e6eb6dea6.webp",
    meta: "Vers gebrand",
    copy: "Romig, zacht en precies goed gebrand.",
    ctaLabel: "Bestel cashew",
  },
  {
    slug: "pecannoten-gezouten",
    name: "Pecannoten",
    imageUrl:
      "https://storage.googleapis.com/notenbucket/products/pecannoten-gezouten/84a4f2b8-b028-404d-afd4-717774743972.webp",
    meta: "Van nature zoet",
    copy: "Vol, zacht en heerlijk als snack of door je ontbijt.",
    ctaLabel: "Bestel pecannoten",
  },
];

export function VideoHero({ locale }: { locale: Locale }) {
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
            Heerlijke vers gebrande noten &amp; gedroogde zuidvruchten!
          </h1>
          <p className="video-hero__intro">Nu ook thuisbezorgd</p>
          <a className="video-hero__button" href={categoriesPath(locale)}>
            Bestel nu!
          </a>
        </div>

        <section className="video-hero__favorites" aria-labelledby="favorites-title">
          <div className="video-hero__favorites-header">
            <h2 id="favorites-title" className="video-hero__favorites-title">
              Onze favorieten
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
                  <a
                    className="video-hero__button video-hero__button--product"
                    href={productPath(locale, item.slug)}
                  >
                    {item.ctaLabel}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
