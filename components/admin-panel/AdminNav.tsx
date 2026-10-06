"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/admin-panel/LogoutButton";
import { BusinessNotificationsDropdown } from "@/components/admin-panel/BusinessNotificationsDropdown";

type NavItem = { href: string; label: string };
/** Items under one dropdown; a heading turns them into a named sub-category (e.g. Financieel). */
type NavSection = { heading?: string; items: NavItem[] };
type NavEntry = { id: string; label: string; href?: string; sections?: NavSection[] };

export const adminNavEntries: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin" },
  {
    id: "catalogus",
    label: "Catalogus",
    sections: [{ items: [{ href: "/admin/producten", label: "Producten" }, { href: "/admin/categorieen", label: "Categorieën" }] }],
  },
  {
    id: "bestellingen",
    label: "Bestellingen",
    sections: [{ items: [{ href: "/admin/bestellingen", label: "Particuliere bestellingen" }, { href: "/admin/zakelijk", label: "Zakelijke bestellijsten" }] }],
  },
  { id: "design-studio", label: "Design Studio", href: "/admin/design-studio" },
  {
    id: "marketing",
    label: "Marketing",
    sections: [{ items: [{ href: "/admin/marketing", label: "Marketing" }, { href: "/admin/kortingen", label: "Kortingen" }] }],
  },
  {
    id: "beheer",
    label: "Beheer",
    sections: [
      { heading: "Financieel", items: [{ href: "/admin/facturen", label: "Facturen" }, { href: "/admin/ontwikkelaarsfacturen", label: "Facturen ontwikkelaar" }] },
      { items: [{ href: "/admin/instellingen", label: "Instellingen" }, { href: "/admin/logboek", label: "Logboek" }] },
    ],
  },
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

function entryActive(pathname: string, entry: NavEntry): boolean {
  if (entry.href) return isActivePath(pathname, entry.href);
  return (entry.sections ?? []).some((section) => section.items.some((item) => isActivePath(pathname, item.href)));
}

function SectionLinks({ sections, pathname, onNavigate, indent }: { sections: NavSection[]; pathname: string; onNavigate?: () => void; indent?: boolean }) {
  return (
    <>
      {sections.map((section, index) => (
        <div key={section.heading ?? index} className={cn(index > 0 && "mt-2 border-t border-border pt-2")}>
          {section.heading ? <p className="px-3 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">{section.heading}</p> : null}
          <div className={cn("grid", indent && section.heading && "pl-2")}>
            {section.items.map((item) => <AdminLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />)}
          </div>
        </div>
      ))}
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileWasOpen = useRef(false);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
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
    if (openGroup) groupRefs.current[openGroup]?.querySelector<HTMLElement>("a")?.focus();
  }, [openGroup]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileOpen) setMobileOpen(false);
      else if (openGroup) {
        groupButtonRefs.current[openGroup]?.focus();
        setOpenGroup(null);
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (openGroup && !groupRefs.current[openGroup]?.contains(event.target as Node)) setOpenGroup(null);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [mobileOpen, openGroup]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-card backdrop-blur supports-[backdrop-filter]:bg-surface/90 print:hidden">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/admin" className="shrink-0 rounded-button py-2" aria-label="De Notenman admin dashboard">
          <span className="block font-heading text-body-sm font-bold uppercase tracking-heading text-accent-ink">De Notenman</span>
          <span className="block text-xs font-semibold text-muted">Admin</span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Hoofdnavigatie admin">
          {adminNavEntries.map((entry) => {
            if (entry.href) return <AdminLink key={entry.id} item={{ href: entry.href, label: entry.label }} pathname={pathname} />;
            const open = openGroup === entry.id;
            return (
              <div key={entry.id} className="relative" ref={(node) => { groupRefs.current[entry.id] = node; }}>
                <button
                  ref={(node) => { groupButtonRefs.current[entry.id] = node; }}
                  type="button"
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1 rounded-button px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                    entryActive(pathname, entry) ? "bg-accent text-contrast" : "text-text hover:bg-background"
                  )}
                  aria-expanded={open}
                  aria-controls={`admin-menu-${entry.id}`}
                  onClick={() => setOpenGroup(open ? null : entry.id)}
                >
                  {entry.label} <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
                </button>
                {open ? (
                  <div id={`admin-menu-${entry.id}`} className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-panel border border-border bg-surface p-3 shadow-card-hover">
                    <SectionLinks sections={entry.sections ?? []} pathname={pathname} />
                  </div>
                ) : null}
              </div>
            );
          })}
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
            {adminNavEntries.map((entry, index) =>
              entry.href ? (
                <div key={entry.id} className={cn("grid", index > 0 && "mt-3 border-t border-border pt-3")}>
                  <AdminLink item={{ href: entry.href, label: entry.label }} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                </div>
              ) : (
                <div key={entry.id} className="mt-3 border-t border-border pt-3">
                  <p className="px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">{entry.label}</p>
                  <div className="mt-1">
                    <SectionLinks sections={entry.sections ?? []} pathname={pathname} onNavigate={() => setMobileOpen(false)} indent />
                  </div>
                </div>
              ),
            )}
            <div className="mt-3 border-t border-border px-3 pt-3"><LogoutButton /></div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
