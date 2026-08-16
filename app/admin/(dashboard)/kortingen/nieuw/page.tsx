import Link from "next/link";
import { DiscountCreateForm } from "./DiscountCreateForm";

export default function NewDiscountPage() {
  return (
    <div>
      <Link href="/admin/kortingen" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar kortingen
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe kortingscode</h1>
        <p className="mt-1 text-body-sm text-muted">
          Maak een nieuwe kortingscode aan.
        </p>
      </div>
      <div className="mt-8">
        <DiscountCreateForm />
      </div>
    </div>
  );
}
