"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/admin-panel/LogoutButton";
import { BusinessNotificationsDropdown } from "@/components/admin-panel/BusinessNotificationsDropdown";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

export const primaryAdminLinks: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/producten", label: "Producten" },
  { href: "/admin/bestellingen", label: "Bestellingen" },
  { href: "/admin/design-studio", label: "Design Studio" },
  { href: "/admin/marketing", label: "Marketing" },
];

export const secondaryAdminGroups: NavGroup[] = [
  { label: "Verkoop", items: [{ href: "/admin/zakelijk", label: "Zakelijk" }, { href: "/admin/facturen", label: "Facturen" }, { href: "/admin/kortingen", label: "Kortingen" }] },
  { label: "Catalogus", items: [{ href: "/admin/categorieen", label: "Categorieën" }, { href: "/admin/notenplan", label: "Notenplan" }] },
  { label: "Groei", items: [{ href: "/admin/advertenties", label: "Google Ads" }, { href: "/admin/prijsmonitor", label: "Prijsmonitor" }] },
  { label: "Creatie", items: [{ href: "/admin/qrcodes", label: "QR-codes" }] },
  { label: "Beheer", items: [{ href: "/admin/logboek", label: "Logboek" }, { href: "/admin/instellingen", label: "Instellingen" }] },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-11 items-center rounded-button px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
        active ? "bg-accent text-contrast" : "text-text hover:bg-background"
      )}
    >
      {item.label}
    </Link>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const mobileWasOpen = useRef(false);
  const moreWasOpen = useRef(false);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      mobileWasOpen.current = true;
      mobilePanelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    } else if (mobileWasOpen.current) {
      mobileButtonRef.current?.focus();
      mobileWasOpen.current = false;
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (moreOpen) {
      moreWasOpen.current = true;
      morePanelRef.current?.querySelector<HTMLElement>("a")?.focus();
    } else if (moreWasOpen.current) {
      moreButtonRef.current?.focus();
      moreWasOpen.current = false;
    }
  }, [moreOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileOpen) setMobileOpen(false);
      else if (moreOpen) setMoreOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (moreOpen && !morePanelRef.current?.contains(target) && !moreButtonRef.current?.contains(target)) setMoreOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [mobileOpen, moreOpen]);

  const secondaryActive = secondaryAdminGroups.some((group) => group.items.some((item) => isActivePath(pathname, item.href)));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-card backdrop-blur supports-[backdrop-filter]:bg-surface/90 print:hidden">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/admin" className="shrink-0 rounded-button py-2" aria-label="De Notenman admin dashboard">
          <span className="block font-heading text-body-sm font-bold uppercase tracking-heading text-accent-ink">De Notenman</span>
          <span className="block text-xs font-semibold text-muted">Admin</span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Hoofdnavigatie admin">
          {primaryAdminLinks.map((item) => <AdminLink key={item.href} item={item} pathname={pathname} />)}
          <div className="relative">
            <button
              ref={moreButtonRef}
              type="button"
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded-button px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                secondaryActive ? "bg-accent text-contrast" : "text-text hover:bg-background"
              )}
              aria-expanded={moreOpen}
              aria-controls="admin-more-menu"
              onClick={() => setMoreOpen((open) => !open)}
            >
              Meer <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {moreOpen ? (
              <div ref={morePanelRef} id="admin-more-menu" className="absolute right-0 top-[calc(100%+0.5rem)] grid w-[min(34rem,calc(100vw-2rem))] grid-cols-2 gap-5 rounded-panel border border-border bg-surface p-5 shadow-card-hover xl:grid-cols-3">
                {secondaryAdminGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{group.label}</p>
                    <div className="mt-1 grid">{group.items.map((item) => <AdminLink key={item.href} item={item} pathname={pathname} />)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <BusinessNotificationsDropdown key={pathname} />
          <div className="hidden lg:block"><LogoutButton /></div>
        <button
          ref={mobileButtonRef}
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-button border border-border bg-surface px-3 font-heading text-body-sm font-semibold text-text lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-menu"
          aria-label={mobileOpen ? "Adminmenu sluiten" : "Adminmenu openen"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          <span className="hidden sm:inline">Menu</span>
        </button>
        </div>
      </div>

      {mobileOpen ? (
        <div ref={mobilePanelRef} id="admin-mobile-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-surface px-4 py-4 lg:hidden">
          <nav className="mx-auto grid max-w-3xl gap-1" aria-label="Mobiele hoofdnavigatie admin">
            {primaryAdminLinks.map((item) => <AdminLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}
            {secondaryAdminGroups.map((group) => (
              <div key={group.label} className="mt-3 border-t border-border pt-3">
                <p className="px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">{group.label}</p>
                <div className="mt-1 grid sm:grid-cols-2">{group.items.map((item) => <AdminLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}</div>
              </div>
            ))}
            <div className="mt-3 border-t border-border px-3 pt-3"><LogoutButton /></div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
