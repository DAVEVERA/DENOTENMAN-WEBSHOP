export type CmsPageInput = {
  title: string;
  slug: string;
  body: string;
  isPublished?: boolean;
};

export function validateCmsPageInput(input: CmsPageInput) {
  if (!input.title.trim()) throw new Error("Titel is verplicht.");
  if (!input.slug.trim()) throw new Error("Slug is verplicht.");
  if (!input.body.trim()) throw new Error("Content is verplicht.");
  return input;
}
