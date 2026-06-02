import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Inloggen | DeNotenman",
  description: "Log in op je DeNotenman account.",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-surface px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {/* Achtergrondpatroon */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(var(--brand-primary) 2px, transparent 2px)`,
          backgroundSize: "30px 30px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full sm:mx-auto sm:max-w-md">
        <Link href="/" aria-label="Naar startpagina">
          <Image
            src="/logo.png"
            alt="De Notenman"
            width={250}
            height={80}
            sizes="(max-width: 640px) 180px, 250px"
            className="mx-auto h-16 w-auto object-contain sm:h-20"
          />
        </Link>
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-brand-primary sm:mt-8 sm:text-3xl">
          Welkom terug
        </h1>
        <p className="mt-2 text-center text-sm text-brand-primary/70">
          Of{" "}
          <Link
            href="/account/registreren"
            className="font-bold text-brand-gold hover:text-brand-highlight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary rounded"
          >
            maak een nieuw account aan
          </Link>
        </p>
      </div>

      <div className="relative z-10 mt-6 w-full sm:mx-auto sm:mt-8 sm:max-w-md">
        <div className="rounded-3xl border border-brand-gold/20 bg-white px-5 py-8 shadow-2xl sm:px-10 sm:py-10">
          <form className="space-y-5" action="#" method="POST" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-brand-primary">
                E-mailadres
              </label>
              <div className="mt-1.5">
                {/* text-base voorkomt automatisch zoomen op iOS/Android */}
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  inputMode="email"
                  className="block w-full rounded-xl border-0 bg-surface/50 px-4 py-3 text-base text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 transition-all focus:ring-2 focus:ring-inset focus:ring-brand-gold"
                  placeholder="jouw@email.nl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-brand-primary">
                Wachtwoord
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-xl border-0 bg-surface/50 px-4 py-3 text-base text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 transition-all focus:ring-2 focus:ring-inset focus:ring-brand-gold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Onthoud mij + vergeten-link: wrappend op kleine schermen */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-5 w-5 rounded border-brand-gold/50 accent-brand-primary focus:ring-brand-gold"
                />
                <span className="text-sm text-brand-primary/80">Onthoud mij</span>
              </label>

              <Link
                href="/account/wachtwoord-vergeten"
                className="flex min-h-[44px] items-center whitespace-nowrap rounded text-sm font-bold text-brand-gold hover:text-brand-highlight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              >
                Wachtwoord vergeten?
              </Link>
            </div>

            <div>
              {/* min-h-[48px] voor comfortabele touch target */}
              <button
                type="submit"
                className="group flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-base font-bold text-brand-gold shadow-md transition-all hover:bg-brand-primary/90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              >
                Inloggen{" "}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
