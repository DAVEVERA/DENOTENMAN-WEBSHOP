import type { Locale } from "@/lib/i18n";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { slug } = await params;

  return <article>{slug}</article>;
}
