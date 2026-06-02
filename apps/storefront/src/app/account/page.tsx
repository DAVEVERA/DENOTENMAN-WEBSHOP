import Link from "next/link";
import { User, Package, MapPin, LogOut, Heart } from "lucide-react";

export const metadata = {
  title: "Mijn Account | DeNotenman",
  description: "Beheer je account, bestellingen en gegevens.",
};

export default function AccountPage() {
  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-brand-gold/30 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-primary sm:text-4xl">
              Welkom terug, <span className="text-brand-gold">Klant</span>
            </h1>
            <p className="mt-2 text-brand-primary/70">
              Beheer hier je gegevens, bekijk bestellingen en je favorieten.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-bold text-brand-primary/60 hover:text-red-500 transition-colors w-fit">
            <LogOut className="h-4 w-4" /> Uitloggen
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Package,
              title: "Mijn Bestellingen",
              desc: "Bekijk je bestelgeschiedenis en facturen.",
              href: "/account/bestellingen",
            },
            {
              icon: User,
              title: "Mijn Gegevens",
              desc: "Bewerk je naam, e-mail en wachtwoord.",
              href: "/account/gegevens",
            },
            {
              icon: MapPin,
              title: "Adresboek",
              desc: "Beheer je verzend- en factuuradressen.",
              href: "/account/adressen",
            },
            {
              icon: Heart,
              title: "Favorieten",
              desc: "Bekijk de producten die je hebt opgeslagen.",
              href: "/account/favorieten",
            },
          ].map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className="group flex flex-col bg-white rounded-3xl p-8 border border-brand-gold/20 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-brand-gold/60 transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/5 text-brand-primary group-hover:bg-brand-primary group-hover:text-brand-gold transition-colors mb-6">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-brand-primary mb-2 group-hover:text-brand-highlight transition-colors">
                {item.title}
              </h3>
              <p className="text-brand-primary/70">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
