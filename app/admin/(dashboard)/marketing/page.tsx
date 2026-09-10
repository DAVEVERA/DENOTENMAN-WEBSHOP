import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export default async function MarketingHubPage() {
  await connection();
  const [campaignCount, bannerCount, newsletterCount, emailLogCount, mediaAssetCount, businessLifecycleEmailCount] = await Promise.all([
    prisma.marketingCampaign.count(),
    prisma.marketingBanner.count(),
    prisma.newsletterCampaign.count(),
    prisma.emailDeliveryLog.count(),
    prisma.mediaAsset.count(),
    prisma.businessLifecycleEmailContent.count(),
  ]);

  const sections = [
    {
      title: "Kortingsacties",
      href: "/admin/marketing/acties",
      description: "Campagnes, kanalen en tijdelijke commerciële acties.",
      count: campaignCount,
    },
    {
      title: "Website banners",
      href: "/admin/marketing/banners",
      description: "Homepage-, categorie- en promotiebanners beheren.",
      count: bannerCount,
    },
    {
      title: "Nieuwsbrieven",
      href: "/admin/marketing/nieuwsbrieven",
      description: "Nieuwsbriefcampagnes en verzendstatussen.",
      count: newsletterCount,
    },
    {
      title: "Mail flows",
      href: "/admin/marketing/aftersales",
      description: "Persoonlijke bestel- en verzendmails via Mailchimp.",
      count: "Service en Support",
    },
    {
      title: "Service en support zakelijk",
      href: "/admin/marketing/service-en-support-zakelijk",
      description: "Uitnodigings- en factuurmail bewerken.",
      count: businessLifecycleEmailCount,
    },
    {
      title: "Maillogboek",
      href: "/admin/marketing/email-logboek",
      description: "Ontvangers, bestellingen, providerstatussen en mislukte pogingen.",
      count: emailLogCount,
    },
    {
      title: "Mediabibliotheek",
      href: "/admin/marketing/media-bibliotheek",
      description: "Afbeeldingen uploaden en hergebruiken binnen alle marketingcategorieën.",
      count: mediaAssetCount,
    },
  ];

  return (
    <div>
      <div>
        <h1 className="text-heading-xl text-text">Marketing</h1>
        <p className="mt-1 text-body-sm text-muted">
          Beheer acties, banners en nieuwsbrieven.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-panel border border-border bg-surface p-6 shadow-card transition-colors duration-hover-fast hover:border-border-hover"
          >
            <p className="font-heading text-heading-lg text-text">{section.count}</p>
            <h2 className="mt-2 font-heading text-body-md font-semibold text-text">
              {section.title}
            </h2>
            <p className="mt-1 text-body-sm text-muted">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
