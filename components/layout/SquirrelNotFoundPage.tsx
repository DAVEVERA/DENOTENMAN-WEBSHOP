"use client";

import { usePathname } from "next/navigation";
import { SquirrelEmptyState } from "@/components/layout/SquirrelEmptyState";
import { defaultLocale, isLocale } from "@/lib/i18n";

export function SquirrelNotFoundPage() {
  const pathname = usePathname();
  const rawLocale = pathname.split("/").filter(Boolean)[0];
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : defaultLocale;

  return <SquirrelEmptyState locale={locale} />;
}
