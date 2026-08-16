"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/admin-panel/LogoutButton";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/producten", label: "Producten" },
  { href: "/admin/bestellingen", label: "Bestellingen" },
  { href: "/admin/zakelijk", label: "Zakelijk" },
  { href: "/admin/notenplan", label: "Notenplan" },
  { href: "/admin/advertenties", label: "Google Ads" },
  { href: "/admin/qrcodes", label: "QR-codes" },
  { href: "/admin/categorieen", label: "Categorieën" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/kortingen", label: "Kortingen" },
  { href: "/admin/logboek", label: "Logboek" },
  { href: "/admin/instellingen", label: "Instellingen" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div>
            <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent">
              De Notenman
            </p>
            <p className="text-body-sm text-muted">Admin</p>
          </div>
          <nav className="flex w-full min-w-0 max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:max-w-none sm:flex-wrap sm:overflow-visible sm:pb-0">
            {links.map((link) => {
              const active =
                link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-button px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
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
