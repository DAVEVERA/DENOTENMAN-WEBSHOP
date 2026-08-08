import type { Locale } from "@/lib/i18n";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  await params;

  return <div></div>;
}
