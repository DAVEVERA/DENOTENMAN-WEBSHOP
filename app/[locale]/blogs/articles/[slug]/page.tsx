import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <article>{slug}</article>;
}
