import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "../../../components/product/ProductGrid";
import { getCategoryLinks, listProducts } from "../../../lib/products";
import {
  absoluteUrl,
  getBreadcrumbJsonLd,
  getProductDescription,
  serializeJsonLd,
  SITE_NAME,
} from "../../../lib/seo";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const categoryCopy: Record<string, { title: string; description: string; intro: string }> = {
  noten: {
    title: "Noten kopen",
    description: "Koop dagverse noten online bij De Notenman. Kies uit gebrande, ongebrande en gemengde noten.",
    intro:
      "Ontdek dagverse noten van De Notenman. Kies uit klassiekers, mixen en specialiteiten voor ontbijt, borrel, bakwerk of zakelijke voorraad.",
  },
  zuidvruchten: {
    title: "Gedroogd fruit kopen",
    description: "Bestel gedroogd fruit en zuidvruchten online bij De Notenman.",
    intro:
      "Gedroogd fruit en zuidvruchten zijn ideaal als tussendoortje, in ontbijt of als natuurlijke smaakmaker in recepten.",
  },
  "zaden-pitten": {
    title: "Pitten en zaden kopen",
    description: "Bestel pitten en zaden online bij De Notenman voor ontbijt, salades en bakrecepten.",
    intro:
      "Pitten en zaden geven ontbijt, salades en bakrecepten extra beet en voedingswaarde. De Notenman verpakt ze dagvers per besteleenheid.",
  },
  snacks: {
    title: "Snacks kopen",
    description: "Bestel hartige en zoete snacks online bij De Notenman.",
    intro:
      "Van borrelmoment tot voorraadkast: bestel snacks met de marktkwaliteit die je van De Notenman gewend bent.",
  },
  superfoods: {
    title: "Superfoods kopen",
    description: "Bestel superfoods online bij De Notenman voor ontbijt, smoothies en recepten.",
    intro:
      "Superfoods uit het assortiment van De Notenman zijn makkelijk te combineren met ontbijt, smoothies, baksels en salades.",
  },
};

function getCategorySeo(slug: string, label: string) {
  return (
    categoryCopy[slug] ?? {
      title: `${label} kopen`,
      description: `Koop ${label.toLowerCase()} online bij De Notenman. Dagvers geselecteerd en snel geleverd.`,
      intro: `Bestel ${label.toLowerCase()} online bij De Notenman. Je kiest eenvoudig de gewenste besteleenheid en rekent veilig af.`,
    }
  );
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const allProducts = await listProducts();
  const category = getCategoryLinks(allProducts).find((item) => item.slug === slug);

  if (!category) {
    return {};
  }

  const seo = getCategorySeo(slug, category.label);

  return {
    title: {
      absolute: `${seo.title} | ${SITE_NAME}`,
    },
    description: seo.description,
    alternates: {
      canonical: `/categorie/${slug}`,
    },
    openGraph: {
      title: `${seo.title} | ${SITE_NAME}`,
      description: seo.description,
      url: `/categorie/${slug}`,
      images: ["/Notenman_onlylogo.png"],
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const allProducts = await listProducts();
  const category = getCategoryLinks(allProducts).find((item) => item.slug === slug);

  if (!category) {
    notFound();
  }
  const categoryProducts = allProducts.filter((product) => product.category === slug);
  const relatedCategories = getCategoryLinks(allProducts).filter((item) => item.slug !== slug).slice(0, 4);
  const seo = getCategorySeo(slug, category.label);
  const categoryUrl = absoluteUrl(`/categorie/${slug}`);
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${seo.title} bij ${SITE_NAME}`,
    url: categoryUrl,
    description: seo.description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: categoryProducts.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/winkel/${product.slug}`),
        item: {
          "@type": "Product",
          name: product.name,
          url: absoluteUrl(`/winkel/${product.slug}`),
          image: product.image ? absoluteUrl(product.image) : absoluteUrl("/Notenman_onlylogo.png"),
          description: getProductDescription(product),
          category: product.categoryLabel,
        },
      })),
    },
  };
  const breadcrumbJsonLd = getBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Categorieen", url: "/categorie" },
    { name: category.label, url: `/categorie/${slug}` },
  ]);

  return (
    <main className="business-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <section className="container list-page">
        <div className="category-seo-intro">
          <p>Assortiment</p>
          <h1>{seo.title}</h1>
          <span>{seo.intro}</span>
          {relatedCategories.length > 0 ? (
            <nav aria-label="Gerelateerde categorieen">
              {relatedCategories.map((item) => (
                <Link key={item.slug} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <ProductGrid activeCategory={slug} products={allProducts} showFilters />
      </section>
    </main>
  );
}
