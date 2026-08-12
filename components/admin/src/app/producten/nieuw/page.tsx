import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "../../../components/product-form";

export default function NieuwProductPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/producten"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Terug naar producten
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">Nieuw product</h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <ProductForm />
      </div>
    </div>
  );
}
