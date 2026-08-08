import type { Locale } from "@/lib/i18n";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { slug } = await params;

  return <article>{slug}</article>;
}
