import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Inloggen | DeNotenman",
  description: "Log in op je DeNotenman account.",
};

export default function LoginPage() {
  return (
    <div className="bg-surface min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(var(--brand-primary) 2px, transparent 2px)`,
          backgroundSize: "30px 30px",
        }}
      ></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="De Notenman"
            width={250}
            height={80}
            className="mx-auto h-20 w-auto object-contain"
          />
        </Link>
        <h2 className="mt-8 text-center text-3xl font-bold tracking-tight text-brand-primary">
          Welkom terug
        </h2>
        <p className="mt-2 text-center text-sm text-brand-primary/70">
          Of{" "}
          <Link
            href="/account/registreren"
            className="font-bold text-brand-gold hover:text-brand-highlight transition-colors"
          >
            maak een nieuw account aan
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-10 px-4 shadow-2xl rounded-3xl sm:px-10 border border-brand-gold/20">
          <form className="space-y-6" action="#" method="POST">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-brand-primary">
                E-mailadres
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full rounded-xl border-0 py-3 px-4 text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 focus:ring-2 focus:ring-inset focus:ring-brand-gold sm:text-sm sm:leading-6 bg-surface/50 transition-all"
                  placeholder="jouw@email.nl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-brand-primary">
                Wachtwoord
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-xl border-0 py-3 px-4 text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 focus:ring-2 focus:ring-inset focus:ring-brand-gold sm:text-sm sm:leading-6 bg-surface/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-brand-gold/50 text-brand-primary focus:ring-brand-gold accent-brand-primary"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-brand-primary/80">
                  Onthoud mij
                </label>
              </div>

              <div className="text-sm">
                <Link
                  href="/account/wachtwoord-vergeten"
                  className="font-bold text-brand-gold hover:text-brand-highlight transition-colors"
                >
                  Wachtwoord vergeten?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center items-center gap-2 rounded-xl bg-brand-primary px-3 py-3.5 text-sm font-bold text-brand-gold shadow-md hover:bg-brand-primary/90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-all group"
              >
                Inloggen{" "}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
