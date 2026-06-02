"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type AdminMenuProps = {
  isAuthenticated: boolean;
  logoutAction: () => Promise<void>;
};

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/producten", label: "Producten" },
  { href: "/categorieen", label: "Categorieen" },
  { href: "/bestellingen", label: "Bestellingen" },
  { href: "/klanten", label: "Klanten" },
  { href: "/qrcodes", label: "QR-codes" },
  { href: "/marketing", label: "Marketing" },
  { href: "/zakelijk", label: "Zakelijk" },
  { href: "/instellingen", label: "Instellingen" },
];

export function AdminMenu({ isAuthenticated, logoutAction }: AdminMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }, [pathname]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const menu = menuRef.current;

      if (!menu?.open || menu.contains(event.target as Node)) {
        return;
      }

      menu.open = false;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeMenu() {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }

  return (
    <details ref={menuRef} className="admin-menu">
      <summary className="admin-menu__trigger" aria-label="Admin menu openen">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </summary>

      <nav className="admin-menu__panel" aria-label="Admin navigatie">
        {navigationItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={closeMenu}>
            {item.label}
          </Link>
        ))}

        {isAuthenticated ? (
          <form action={logoutAction} onSubmit={closeMenu}>
            <button className="admin-header__logout" type="submit">
              Uitloggen
            </button>
          </form>
        ) : null}
      </nav>
    </details>
  );
}
