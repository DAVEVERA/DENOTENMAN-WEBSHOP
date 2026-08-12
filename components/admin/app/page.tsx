import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  Mail,
  Megaphone,
  PackagePlus,
  ShoppingBasket,
  ShoppingCart,
  UserPlus,
  Users,
  ShieldCheck,
} from "lucide-react";

const mainLinks = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Omzet, bestellingen en voorraad in beeld.",
    icon: BarChart3,
  },
  {
    title: "Producten",
    href: "/producten",
    description: "Assortiment, varianten en voorraad beheren.",
    icon: ShoppingBasket,
  },
  {
    title: "Bestellingen",
    href: "/bestellingen",
    description: "Orders verwerken, facturen en verzending.",
    icon: ShoppingCart,
  },
  {
    title: "Zakelijk",
    href: "/zakelijk",
    description: "B2B-klanten, prijzen en bestellijsten.",
    icon: BriefcaseBusiness,
  },
];

const quickLinks = [
  { title: "Nieuw Product", href: "/producten/nieuw", description: "Maak direct een nieuw product aan.", icon: PackagePlus },
  { title: "Nieuw zakelijke klant", href: "/zakelijk/klanten/nieuw", description: "Voeg een bedrijf toe aan B2B.", icon: UserPlus },
  { title: "Bestellijsten", href: "/zakelijk/bestellijsten", description: "Beheer zakelijke bestellijsten.", icon: ClipboardList },
  { title: "Klanten", href: "/klanten", description: "Bekijk particuliere klanten.", icon: Users },
  { title: "BTW", href: "/instellingen/btw", description: "Beheer btw-tarieven.", icon: Calculator },
  { title: "E-mail", href: "/instellingen/e-mail", description: "Pas mailinstellingen aan.", icon: Mail },
  { title: "Gebruikers", href: "/instellingen/gebruikers", description: "Beheer toegang en rollen.", icon: ShieldCheck },
  { title: "Marketing", href: "/marketing", description: "Open acties en campagnes.", icon: Megaphone },
];

export default function AdminHomePage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Admin</p>
        <h1>Beheeromgeving</h1>
      </section>

      <section className="admin-home-grid admin-home-grid--primary" aria-label="Hoofdmodules">
        {mainLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link key={link.href} href={link.href} className="admin-home-card admin-home-card--primary">
              <span className="admin-home-card__icon" aria-hidden="true">
                <Icon size={24} strokeWidth={2.2} />
              </span>
              <span>
                <strong>{link.title}</strong>
                <small>{link.description}</small>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="admin-home-grid" aria-label="Snelle admin acties">
        {quickLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link key={link.href} className="admin-home-card" href={link.href}>
              <span className="admin-home-card__icon" aria-hidden="true">
                <Icon size={22} strokeWidth={2.2} />
              </span>
              <span>
                <strong>{link.title}</strong>
                <small>{link.description}</small>
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
