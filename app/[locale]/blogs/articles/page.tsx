import type { Locale } from "@/lib/i18n";

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  await params;

  return <ul></ul>;
}
