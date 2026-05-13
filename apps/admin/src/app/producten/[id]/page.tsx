"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Spinner, Alert, AlertDescription } from "@denotenman/ui";
import type { Product } from "@denotenman/schemas";
import { adminApi } from "../../../lib/admin-api";
import { ProductForm } from "../../../components/product-form";

interface ProductEditPageProps {
  params: { id: string };
}

export default function ProductEditPage({ params }: ProductEditPageProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await adminApi.products.list(1);
        const found = result.items.find((p) => p.id === params.id);
        if (!found) {
          setError("Product niet gevonden.");
        } else {
          setProduct(found);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Product kon niet worden geladen.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [params.id]);

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
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          {product ? product.name : "Product bewerken"}
        </h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner label="Product laden..." />
          </div>
        )}

        {error && (
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {product && <ProductForm product={product} />}
      </div>
    </div>
  );
}
