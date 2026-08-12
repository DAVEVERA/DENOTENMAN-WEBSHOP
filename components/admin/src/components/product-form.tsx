"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Input, Textarea, Select, Checkbox, Button, Alert, AlertDescription } from "@denotenman/ui";
import type { Product, CategoryTree } from "@denotenman/schemas";
import { adminApi } from "../lib/admin-api";

const ProductFormSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  sku: z.string().min(1, "SKU is verplicht"),
  slug: z
    .string()
    .min(1, "Slug is verplicht")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug mag alleen kleine letters, cijfers en koppeltekens bevatten",
    ),
  categoryId: z.string().min(1, "Categorie is verplicht"),
  status: z.enum(["draft", "active", "archived"]),
  description: z.string().nullable(),
  organic: z.boolean(),
});

type ProductFormValues = z.infer<typeof ProductFormSchema>;
type FieldErrors = Partial<Record<keyof ProductFormValues, string>>;

function ep(msg: string | undefined): { error: string } | Record<string, never> {
  return msg !== undefined ? { error: msg } : {};
}

interface ProductFormProps {
  product?: Product;
}

function flattenCategories(
  trees: CategoryTree[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const tree of trees) {
    result.push({ id: tree.id, name: tree.name, depth });
    if (tree.children.length > 0) {
      for (const child of tree.children) {
        result.push({ id: child.id, name: child.name, depth: depth + 1 });
      }
    }
  }
  return result;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<ProductFormValues>({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    slug: product?.slug ?? "",
    categoryId: product?.categoryId ?? "",
    status: product?.status ?? "draft",
    description: product?.description ?? "",
    organic: product?.organic ?? false,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; depth: number }[]>([]);

  useEffect(() => {
    adminApi.categories
      .list()
      .then((trees) => {
        setCategories(flattenCategories(trees));
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  function handleChange<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev: ProductFormValues) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev: FieldErrors) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const parsed = ProductFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const rawKey = issue.path[0];
        if (typeof rawKey === "string") {
          fieldErrors[rawKey as keyof ProductFormValues] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (product) {
        await adminApi.products.update(product.id, parsed.data);
      } else {
        await adminApi.products.create(parsed.data);
      }
      router.push("/producten");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Er is een fout opgetreden.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      noValidate
      className="space-y-6"
    >
      {serverError && (
        <Alert variant="danger">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Naam"
          required
          value={values.name}
          onChange={(e) => {
            handleChange("name", e.target.value);
          }}
          {...ep(errors.name)}
          placeholder="Bijv. Cashewnoten naturel"
        />

        <Input
          label="SKU"
          required
          value={values.sku}
          onChange={(e) => {
            handleChange("sku", e.target.value);
          }}
          {...ep(errors.sku)}
          placeholder="Bijv. CASH-NAT-250"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Slug"
          required
          value={values.slug}
          onChange={(e) => {
            handleChange("slug", e.target.value);
          }}
          {...ep(errors.slug)}
          placeholder="Bijv. cashewnoten-naturel"
        />

        <Select
          label="Categorie"
          required
          value={values.categoryId}
          onChange={(e) => {
            handleChange("categoryId", e.target.value);
          }}
          {...ep(errors.categoryId)}
        >
          <option value="">Kies een categorie...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.depth > 0 ? "  — " : ""}
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      <Select
        label="Status"
        required
        value={values.status}
        onChange={(e) => {
          handleChange("status", e.target.value as ProductFormValues["status"]);
        }}
        {...ep(errors.status)}
        containerClassName="max-w-xs"
      >
        <option value="draft">Concept</option>
        <option value="active">Actief</option>
        <option value="archived">Gearchiveerd</option>
      </Select>

      <Textarea
        label="Beschrijving"
        value={values.description ?? ""}
        onChange={(e) => {
          handleChange("description", e.target.value || null);
        }}
        {...ep(errors.description)}
        rows={5}
        placeholder="Optionele productbeschrijving..."
      />

      <Checkbox
        label="Biologisch gecertificeerd"
        checked={values.organic}
        onChange={(e) => {
          handleChange("organic", e.target.checked);
        }}
        {...ep(errors.organic)}
      />

      <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Bezig..." : product ? "Wijzigingen opslaan" : "Product aanmaken"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            router.push("/producten");
          }}
          disabled={isSubmitting}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
