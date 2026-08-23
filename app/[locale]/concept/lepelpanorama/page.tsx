import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LepelPanoramaConcept } from "@/components/home/LepelPanoramaConcept";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Conceptpreview lepelpanorama | De Notenman",
  description: "Niet-gepubliceerde conceptpreview van de interactieve homepagehero.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function LepelPanoramaConceptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <LepelPanoramaConcept />;
}
