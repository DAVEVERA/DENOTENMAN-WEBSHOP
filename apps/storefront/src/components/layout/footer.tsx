import Link from "next/link";
import { Leaf, Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="container-shop py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-white">
              <Leaf className="h-5 w-5 text-brand-green-400" />
              DeNotenman
            </div>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Premium noten, zuidvruchten, pitten &amp; zaden. Vers verpakt, transparante herkomst,
              zonder onnodige toevoegingen.
            </p>
          </div>

          {/* Winkel */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              Winkel
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/categorie/noten"
                  className="transition-colors hover:text-brand-green-400"
                >
                  Noten
                </Link>
              </li>
              <li>
                <Link
                  href="/categorie/gedroogd-fruit-zuidvruchten"
                  className="transition-colors hover:text-brand-green-400"
                >
                  Zuidvruchten
                </Link>
              </li>
              <li>
                <Link
                  href="/categorie/pitten-zaden"
                  className="transition-colors hover:text-brand-green-400"
                >
                  Pitten &amp; Zaden
                </Link>
              </li>
              <li>
                <Link
                  href="/categorie/snacks"
                  className="transition-colors hover:text-brand-green-400"
                >
                  Snacks
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              Informatie
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/over-ons" className="transition-colors hover:text-brand-green-400">
                  Over ons
                </Link>
              </li>
              <li>
                <Link href="/verzending" className="transition-colors hover:text-brand-green-400">
                  Verzending
                </Link>
              </li>
              <li>
                <Link
                  href="/algemene-voorwaarden"
                  className="transition-colors hover:text-brand-green-400"
                >
                  Algemene voorwaarden
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-brand-green-400">
                  Privacybeleid
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">
              Contact
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-neutral-500" />
                <a
                  href="mailto:info@denotenman.nl"
                  className="transition-colors hover:text-brand-green-400"
                >
                  info@denotenman.nl
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-neutral-500" />
                <span>+31 (0)6 12345678</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                <span>Amsterdam, Nederland</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} DeNotenman. Alle rechten voorbehouden.
        </div>
      </div>
    </footer>
  );
}
