import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cart as cartPath } from "@/lib/routes";

export function CheckoutBackLink({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Link
      href={cartPath(locale)}
      className="inline-flex min-h-11 max-w-full touch-manipulation items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 py-2 font-heading text-body-sm font-semibold text-text transition-colors duration-hover-fast ease-hover hover:border-border-hover hover:bg-background active:bg-border"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
