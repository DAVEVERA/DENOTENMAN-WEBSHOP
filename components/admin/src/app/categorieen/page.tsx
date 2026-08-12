"use client";

import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { Button, Input, Spinner, Alert, AlertDescription } from "@denotenman/ui";
import type { CategoryTree } from "@denotenman/schemas";
import { adminApi } from "../../lib/admin-api";

const CategoryFormSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  slug: z
    .string()
    .min(1, "Slug is verplicht")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug mag alleen kleine letters, cijfers en koppeltekens bevatten",
    ),
  parentId: z.string().nullable(),
});

type CategoryFormValues = z.infer<typeof CategoryFormSchema>;
type FieldErrors = Partial<Record<keyof CategoryFormValues, string>>;

function ep(msg: string | undefined): { error: string } | Record<string, never> {
  return msg !== undefined ? { error: msg } : {};
}

interface FlatCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  productCount: number;
  depth: number;
}

function flattenCategoryTrees(trees: CategoryTree[]): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const tree of trees) {
    result.push({
      id: tree.id,
      name: tree.name,
      slug: tree.slug,
      parentId: tree.parentId,
      parentName: null,
      productCount: tree.productCount,
      depth: 0,
    });
    for (const child of tree.children) {
      result.push({
        id: child.id,
        name: child.name,
        slug: child.slug,
        parentId: child.parentId,
        parentName: tree.name,
        productCount: child.productCount,
        depth: 1,
      });
    }
  }
  return result;
}

const emptyForm: CategoryFormValues = {
  name: "",
  slug: "",
  parentId: null,
};

export default function CategorieenPage() {
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [trees, setTrees] = useState<CategoryTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CategoryFormValues>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formServerError, setFormServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.categories.list();
      setTrees(result);
      setCategories(flattenCategoryTrees(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Categorieën konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function handleFormChange<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K],
  ) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  }

  function openNewForm() {
    setEditingId(null);
    setFormValues(emptyForm);
    setFormErrors({});
    setFormServerError(null);
    setShowForm(true);
  }

  function openEditForm(cat: FlatCategory) {
    setEditingId(cat.id);
    setFormValues({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
    });
    setFormErrors({});
    setFormServerError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setFormValues(emptyForm);
    setFormErrors({});
    setFormServerError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormServerError(null);

    const parsed = CategoryFormSchema.safeParse(formValues);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const rawKey = issue.path[0];
        if (typeof rawKey === "string") {
          fieldErrors[rawKey as keyof CategoryFormValues] = issue.message;
        }
      }
      setFormErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...parsed.data,
        parentId: parsed.data.parentId ?? undefined,
      };

      if (editingId) {
        await adminApi.categories.update(editingId, payload);
      } else {
        await adminApi.categories.create(payload);
      }
      await loadCategories();
      cancelForm();
    } catch (err) {
      setFormServerError(err instanceof Error ? err.message : "Er is een fout opgetreden.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(cat: FlatCategory) {
    const confirmed = window.confirm(
      `Weet je zeker dat je de categorie "${cat.name}" wilt verwijderen?`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(cat.id);
    try {
      await adminApi.categories.remove(cat.id);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Categorie kon niet worden verwijderd.");
    } finally {
      setDeletingId(null);
    }
  }

  const topLevelCategories = trees.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Categorieën</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-neutral-500">
              {categories.length} {categories.length === 1 ? "categorie" : "categorieën"} in totaal
            </p>
          )}
        </div>
        {!showForm && (
          <Button size="sm" onClick={openNewForm}>
            <Plus size={14} aria-hidden="true" />
            Nieuwe categorie
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="danger" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900">
              {editingId ? "Categorie bewerken" : "Nieuwe categorie"}
            </h2>
            <button
              onClick={cancelForm}
              className="rounded p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-green"
              aria-label="Formulier sluiten"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {formServerError && (
            <Alert variant="danger" className="mb-4">
              <AlertDescription>{formServerError}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            noValidate
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Naam"
                required
                value={formValues.name}
                onChange={(e) => {
                  handleFormChange("name", e.target.value);
                }}
                {...ep(formErrors.name)}
                placeholder="Bijv. Noten"
              />
              <Input
                label="Slug"
                required
                value={formValues.slug}
                onChange={(e) => {
                  handleFormChange("slug", e.target.value);
                }}
                {...ep(formErrors.slug)}
                placeholder="Bijv. noten"
              />
            </div>

            <div>
              <label htmlFor="parentId" className="block text-sm font-medium text-neutral-700">
                Bovenliggende categorie
              </label>
              <select
                id="parentId"
                value={formValues.parentId ?? ""}
                onChange={(e) => {
                  handleFormChange("parentId", e.target.value || null);
                }}
                className="mt-1 w-full max-w-xs appearance-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1"
              >
                <option value="">Geen (hoofd-categorie)</option>
                {topLevelCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  "Bezig..."
                ) : (
                  <>
                    <Check size={14} aria-hidden="true" />
                    {editingId ? "Wijzigingen opslaan" : "Categorie aanmaken"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelForm}
                disabled={isSubmitting}
              >
                Annuleren
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Categorieën laden..." />
          </div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-neutral-500">Geen categorieën gevonden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Naam</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Slug</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">
                    Bovenliggende
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-600">Producten</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-600">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {cat.depth > 0 && (
                        <span className="mr-2 text-neutral-300" aria-hidden="true">
                          —
                        </span>
                      )}
                      {cat.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{cat.slug}</td>
                    <td className="px-4 py-3 text-neutral-600">{cat.parentName ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{cat.productCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            openEditForm(cat);
                          }}
                          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-green"
                          aria-label={`${cat.name} bewerken`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => {
                            void handleDelete(cat);
                          }}
                          disabled={deletingId === cat.id}
                          className="rounded p-1.5 text-neutral-500 hover:bg-danger-light hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`${cat.name} verwijderen`}
                        >
                          {deletingId === cat.id ? (
                            <Spinner size="sm" label="Verwijderen..." />
                          ) : (
                            <Trash2 size={14} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
