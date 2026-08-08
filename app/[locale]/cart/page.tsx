import type { Locale } from "@/lib/i18n";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  await params;

  return <div></div>;
}
