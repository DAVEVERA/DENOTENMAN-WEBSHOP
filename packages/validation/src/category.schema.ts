export type CategoryInput = {
  name: string;
  slug: string;
  isActive?: boolean;
};

export function validateCategoryInput(input: CategoryInput) {
  if (!input.name.trim()) throw new Error("Categorienaam is verplicht.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    throw new Error("Categorie-slug is ongeldig.");
  }
  return input;
}
