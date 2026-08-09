import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <div></div>;
}
