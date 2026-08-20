import Link from "next/link";
import { cn } from "@/lib/cn";

export function ProductEditorNav({
  productId,
  active,
}: {
  productId: string;
  active: "product" | "faq";
}) {
  const tabs = [
    { id: "product" as const, label: "Productgegevens", href: `/admin/producten/${productId}` },
    {
      id: "faq" as const,
      label: "Veelgestelde vragen",
      href: `/admin/producten/${productId}/veelgestelde-vragen`,
    },
  ];

  return (
    <nav aria-label="Product bewerken" className="mt-6 border-b border-border">
      <ul className="flex min-w-0 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              aria-current={active === tab.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-4 font-heading text-body-sm font-bold transition-colors",
                active === tab.id
                  ? "border-accent text-text"
                  : "border-transparent text-muted hover:border-border hover:text-text",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
