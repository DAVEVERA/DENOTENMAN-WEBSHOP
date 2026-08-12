import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl font-bold text-neutral-300">404</p>
      <h2 className="mt-4 text-xl font-semibold text-neutral-900">Pagina niet gevonden</h2>
      <p className="mt-2 text-sm text-neutral-500">
        De pagina die je zoekt bestaat niet of is verplaatst.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-brand-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-700 transition-colors"
      >
        Terug naar beheer
      </Link>
    </div>
  );
}
