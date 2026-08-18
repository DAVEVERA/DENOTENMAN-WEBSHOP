import Link from "next/link";
import type { MainCategoryDto } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { category as categoryPath } from "@/lib/routes";
import { cn } from "@/lib/cn";

export function PromotionalCategoryLink({
  category,
  locale,
  mobile = false,
  onClick,
}: {
  category: MainCategoryDto;
  locale: Locale;
  mobile?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={categoryPath(locale, category.slug)}
      prefetch={mobile ? false : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-4 py-2 font-heading font-bold text-contrast shadow-button transition-colors duration-hover-fast hover:bg-accent-hover active:bg-accent-hover",
        mobile ? "w-full text-body-md" : "text-body-sm"
      )}
    >
      {category.name}
    </Link>
  );
}
