import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeHero } from "../components/home/HomeHero";
import { HomeCategoryEntrances } from "../components/home/HomeCategoryEntrances";
import { HomeNutButterStory } from "../components/home/HomeNutButterStory";
import { HomeCraftStory } from "../components/home/HomeCraftStory";
import { HomeHoneyStory } from "../components/home/HomeHoneyStory";
import { HomeServiceProof } from "../components/home/HomeServiceProof";
import { HomeAssortmentCta } from "../components/home/HomeAssortmentCta";

test("home hero cycles three art-directed slides without navigation controls", () => {
  const markup = renderToStaticMarkup(
    <HomeHero
      carouselLabel="Uitgelicht assortiment"
      slideLabel="Hero {current} van {total}"
      slides={[
        {
          id: "noten",
          eyebrow: "Vers gebrand",
          title: "Noten van DeNotenman",
          description: "Een feitelijke introductie.",
          imageAlt: "Gemengde noten",
          desktopImage: "/hero/hero-nuts-desktop.webp",
          mobileImage: "/hero/hero-nuts-mobile.webp",
          ctaLabel: "Bekijk noten",
          ctaHref: "/nl/categorie/noten",
        },
        {
          id: "honing",
          eyebrow: "Van bloem tot pot",
          title: "Honing met herkomst",
          description: "Een feitelijke introductie.",
          imageAlt: "Biologische honing",
          desktopImage: "/hero/hero-honey-desktop.webp",
          mobileImage: "/hero/hero-honey-mobile.webp",
          ctaLabel: "Bekijk honing",
          ctaHref: "/nl/categorie/honing",
        },
        {
          id: "notenpasta",
          eyebrow: "Eigen standaard",
          title: "Notenpasta zonder poespas",
          description: "Een feitelijke introductie.",
          imageAlt: "De Notenman met notenpasta",
          desktopImage: "/hero/hero-nutbutter-desktop.webp",
          mobileImage: "/hero/hero-nutbutter-mobile.webp",
          ctaLabel: "Bekijk notenpasta",
          ctaHref: "/nl/categorie/notenpasta-s",
        },
      ]}
    />,
  );

  assert.equal((markup.match(/<h1/g) ?? []).length, 1);
  assert.equal((markup.match(/<picture/g) ?? []).length, 3);
  assert.match(markup, /Noten van DeNotenman/);
  assert.match(markup, /srcSet="\/hero\/hero-nuts-desktop\.webp"/);
  assert.match(markup, /src="\/hero\/hero-nuts-mobile\.webp"/);
  assert.match(markup, /srcSet="\/hero\/hero-honey-desktop\.webp"/);
  assert.match(markup, /src="\/hero\/hero-honey-mobile\.webp"/);
  assert.match(markup, /srcSet="\/hero\/hero-nutbutter-desktop\.webp"/);
  assert.match(markup, /src="\/hero\/hero-nutbutter-mobile\.webp"/);
  assert.match(markup, /bg-white\/\[0\.84\]/);
  assert.match(markup, /data-home-section="hero"/);
  assert.match(markup, /bg-transparent/);
  assert.match(markup, /via-home-canvas\/70 to-home-canvas/);
  assert.equal((markup.match(/<a /g) ?? []).length, 1);
  assert.match(markup, /href="\/nl\/categorie\/noten"/);
  assert.equal((markup.match(/<button/g) ?? []).length, 0);
  assert.doesNotMatch(markup, /aria-current|Vorige|Volgende/);
});

test("category entrances use a two-column mobile grid and six columns on desktop", () => {
  const categories = Array.from({ length: 6 }, (_, index) => ({
    id: String(index + 1),
    name: `Categorie ${index + 1}`,
    href: `/nl/categorie/${index + 1}`,
    imageSrc: `/category-${index + 1}.webp`,
  }));
  const markup = renderToStaticMarkup(
    <HomeCategoryEntrances
      eyebrow="Ontdek"
      title="Shop per categorie"
      intro="Kies een categorie."
      viewAllLabel="Alles bekijken"
      viewAllHref="/nl/categorieen"
      categories={categories}
    />,
  );

  assert.match(markup, /grid-cols-2/);
  assert.match(markup, /data-home-section="categories"/);
  assert.match(markup, /bg-transparent/);
  assert.match(markup, /sm:grid-cols-3/);
  assert.match(markup, /lg:grid-cols-6/);
  assert.doesNotMatch(markup, /snap-x|overflow-x-auto|min-w-\[8\.5rem\]/);
  assert.equal((markup.match(/<li/g) ?? []).length, 6);
  // Redesigned as image-forward tiles: the photo fills the card
  // (aspect-[4/5]) with the category name and a large accent arrow badge
  // overlaid on a bottom scrim, instead of a short text-led pill.
  assert.match(markup, /aspect-\[4\/5\] touch-manipulation/);
  assert.equal((markup.match(/sizes="\(max-width: 639px\) 45vw/g) ?? []).length, 6);
  assert.equal((markup.match(/alt=""/g) ?? []).length, 6);
  assert.doesNotMatch(markup, />0[1-6]</);
});

test("nut-butter story art-directs the selected desktop and mobile images without cropping", () => {
  const markup = renderToStaticMarkup(
    <HomeNutButterStory
      eyebrow="De pot in"
      title="Zijn stempel. Zijn standaard."
      body="Van pindakaas en amandelpasta tot pistachepasta en tahin."
      detail="Geselecteerd op smaak, structuur en ingrediënten."
      highlights={["Zonder omwegen", "Voor brood of de lepel"]}
      imageAlt="Notenpasta van De Notenman"
      ctaLabel="Bekijk alle notenpasta's"
      ctaHref="/nl/categorie/notenpasta-s"
    />,
  );

  assert.match(markup, /srcSet="\/home\/notenpasta-story-desktop\.webp"/);
  assert.match(markup, /src="\/home\/notenpasta-story-mobile\.webp"/);
  assert.match(markup, /media="\(min-width: 768px\)"/);
  assert.match(markup, /object-contain/);
  assert.match(markup, /data-home-section="nut-butter-story"/);
  assert.match(markup, /bg-transparent/);
  assert.match(markup, /from-home-canvas to-transparent/);
  assert.doesNotMatch(markup, /#efe8dc_7rem|bg-\[#e8dccb\]/);
  assert.doesNotMatch(markup, /rounded-\[1\.5rem\]|shadow-\[0_18px/);
  assert.match(markup, /pindakaas en amandelpasta/);
  assert.match(markup, /Geselecteerd op smaak/);
  assert.match(markup, /Voor brood of de lepel/);
  assert.match(markup, /href="\/nl\/categorie\/notenpasta-s"/);
  assert.match(markup, /loading="lazy"/);
});

test("honey story keeps copy and art-directed product imagery in separate mobile regions", () => {
  const markup = renderToStaticMarkup(
    <HomeHoneyStory
      eyebrow="Van bloem tot pot"
      title="Honing met een eigen karakter"
      body="Zacht, bloemig, donker of krachtig."
      imageAlt="Selectie biologische honingpotten"
      ctaLabel="Bekijk alle honing"
      ctaHref="/nl/categorie/honing"
    />,
  );

  assert.match(markup, /srcSet="\/hero\/hero-honey-desktop\.webp"/);
  assert.match(markup, /src="\/hero\/hero-honey-mobile\.webp"/);
  assert.match(markup, /lg:hidden/);
  assert.match(markup, /lg:block/);
  assert.match(markup, /href="\/nl\/categorie\/honing"/);
  assert.match(markup, /min-h-11 touch-manipulation/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /data-home-section="honey-story"/);
  assert.match(markup, /bg-transparent/);
  assert.match(markup, /from-home-canvas via-home-canvas\/90 to-transparent/);
  assert.doesNotMatch(markup, /#f4efe6_7rem/);
});

test("story, market proof and assortment CTA render only supplied copy and usable links", () => {
  const story = renderToStaticMarkup(
    <HomeCraftStory
      eyebrow="Op de markt"
      title="Persoonlijk contact"
      body="Een controleerbare tekst."
      points={["Punt een", "Punt twee"]}
      imageSrc="/home/de-notenman-marktbak.webp"
      imageAlt="Assortiment"
      ctaLabel="Lees meer"
      ctaHref="/nl/paginas/over-ons"
    />,
  );
  const service = renderToStaticMarkup(
    <HomeServiceProof
      eyebrow="Marktdagen"
      title="Bezoek De Notenman"
      intro="Vaste dagen en tijden."
      markets={[
        {
          id: "thu",
          day: "Donderdag",
          location: "Hilvarenbeek",
          hours: "08:00–12:00",
        },
      ]}
      ctaLabel="Bekijk alle markten"
      ctaHref="/nl/paginas/markten"
    />,
  );
  const assortment = renderToStaticMarkup(
    <HomeAssortmentCta
      title="Bekijk het assortiment"
      body="Zoek en filter op de assortimentpagina."
      ctaLabel="Naar assortiment"
      ctaHref="/nl/categorieen"
    />,
  );

  assert.match(story, /loading="lazy"/);
  assert.match(story, /data-home-section="craft-story"/);
  assert.match(story, /bg-transparent/);
  assert.match(story, /to-home-canvas/);
  assert.match(story, /%2Fhome%2Fde-notenman-marktbak\.webp/);
  assert.match(story, /object-contain/);
  assert.match(story, /lg:grid-cols-2/);
  assert.doesNotMatch(story, /rounded-\[1\.5rem\]|shadow-\[/);
  assert.match(story, /Punt een/);
  assert.match(service, /Hilvarenbeek/);
  assert.match(service, /08:00–12:00/);
  assert.match(service, /data-home-section="service-proof"/);
  assert.match(service, /bg-transparent/);
  assert.match(service, /bg-\[#f6f3ee\]\/75/);
  assert.match(assortment, /min-h-12/);
  assert.match(assortment, /data-home-section="assortment-cta"/);
  assert.match(assortment, /bg-transparent/);
  assert.match(assortment, /bg-\[#121212\]/);
  assert.doesNotMatch(
    `${story}${service}${assortment}`,
    /vandaag besteld|gratis verzending|review/i,
  );
});
