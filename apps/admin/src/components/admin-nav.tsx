"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, FolderTree, ExternalLink } from "lucide-react";
import { cn } from "@denotenman/ui";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/producten", label: "Producten", icon: Package },
  { href: "/bestellingen", label: "Bestellingen", icon: ShoppingBag },
  { href: "/categorieen", label: "Categorieën", icon: FolderTree },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col h-full" aria-label="Beheer navigatie">
      <div className="p-4 border-b border-neutral-200">
        <Link href="/" className="block">
          <span className="text-base font-bold text-neutral-900">DeNotenman</span>
          <span className="block text-xs text-neutral-500 mt-0.5">Beheer</span>
        </Link>
      </div>

      <ul className="flex-1 p-3 space-y-0.5" role="list">
        {navItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
              )}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon
                size={16}
                className={cn("shrink-0", isActive(href) ? "text-neutral-700" : "text-neutral-400")}
                aria-hidden="true"
              />
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="p-3 border-t border-neutral-200">
        <a
          href="https://denotenman.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
          denotenman.com
        </a>
      </div>
    </nav>
  );
}
