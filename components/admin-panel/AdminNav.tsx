"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/admin-panel/LogoutButton";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/producten", label: "Producten" },
  { href: "/admin/bestellingen", label: "Bestellingen" },
  { href: "/admin/categorieen", label: "Categorieën" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent">
              De Notenman
            </p>
            <p className="text-body-sm text-muted">Admin</p>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => {
              const active =
                link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-button px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                    active ? "bg-accent text-contrast" : "text-text hover:bg-background"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
