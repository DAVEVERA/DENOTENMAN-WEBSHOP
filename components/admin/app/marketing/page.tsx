import Link from "next/link";
import {
  listDiscounts,
  listMarketingBanners,
  listMarketingCampaigns,
  listNewsletterCampaigns,
} from "../../lib/marketing";

const marketingLinks = [
  {
    title: "Acties",
    href: "/marketing/acties",
    description: "Campagnes, kanalen en tijdelijke commerciele acties.",
  },
  {
    title: "Banners",
    href: "/marketing/banners",
    description: "Homepage-, categorie- en promotiebanners beheren.",
  },
  {
    title: "Nieuwsbrieven",
    href: "/marketing/nieuwsbrieven",
    description: "Nieuwsbriefcampagnes, doelgroepen en verzendstatussen.",
  },
  {
    title: "Kortingen",
    href: "/kortingen",
    description: "Kortingscodes en actievoorwaarden beheren.",
  },
  {
    title: "Analytics",
    href: "/marketing/analytics",
    description: "Commerciele prestaties en omzetinzichten bekijken.",
  },
];

export default async function MarketingPage() {
  const [campaigns, banners, newsletters, discounts] = await Promise.all([
    listMarketingCampaigns().catch(() => []),
    listMarketingBanners().catch(() => []),
    listNewsletterCampaigns().catch(() => []),
    listDiscounts().catch(() => []),
  ]);

  const stats = [
    { label: "Acties", value: campaigns.length, href: "/marketing/acties" },
    { label: "Banners", value: banners.length, href: "/marketing/banners" },
    { label: "Nieuwsbrieven", value: newsletters.length, href: "/marketing/nieuwsbrieven" },
    { label: "Kortingen", value: discounts.length, href: "/kortingen" },
  ];

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Admin</p>
        <h1>Marketing</h1>
        <span>Beheer acties, banners, nieuwsbrieven, kortingen en commerciele inzichten.</span>
      </section>

      <section className="admin-actions">
        <Link className="admin-button" href="/marketing/acties/nieuw">
          Nieuwe actie
        </Link>
        <Link className="admin-button admin-button--secondary" href="/marketing/banners/nieuw">
          Nieuwe banner
        </Link>
        <Link className="admin-button admin-button--secondary" href="/marketing/nieuwsbrieven/nieuw">
          Nieuwe nieuwsbrief
        </Link>
      </section>

      <section className="admin-grid" aria-label="Marketing statistieken">
        {stats.map((stat) => (
          <Link key={stat.label} className="admin-card admin-link-card" href={stat.href}>
            <h2>{stat.value}</h2>
            <p>{stat.label}</p>
          </Link>
        ))}
      </section>

      <section className="admin-grid admin-section" aria-label="Marketing onderdelen">
        {marketingLinks.map((link) => (
          <Link key={link.href} className="admin-card admin-link-card" href={link.href}>
            <h2>{link.title}</h2>
            <p>{link.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
