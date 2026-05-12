// Visueel loginformulier — auth-implementatie volgt in een latere sprint.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-neutral-900">Inloggen</h1>
        <p className="mt-1 text-sm text-neutral-500">Toegang voor beheerders.</p>

        <form className="mt-6 space-y-4" aria-label="Inlogformulier">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-green-500 focus:outline-none focus:ring-2 focus:ring-brand-green-500/20"
              placeholder="naam@denotenman.nl"
              disabled
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-green-500 focus:outline-none focus:ring-2 focus:ring-brand-green-500/20"
              placeholder="••••••••"
              disabled
            />
          </div>

          <button
            type="submit"
            disabled
            aria-disabled="true"
            className="w-full rounded-md bg-brand-green-600 px-4 py-2.5 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
          >
            Inloggen
          </button>
        </form>
      </div>
    </div>
  );
}
