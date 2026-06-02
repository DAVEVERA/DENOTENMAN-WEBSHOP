export type ReviewInput = {
  productId: number;
  rating: number;
  authorName: string;
  body: string;
};

export function validateReviewInput(input: ReviewInput) {
  if (!Number.isInteger(input.productId) || input.productId <= 0) {
    throw new Error("Product-id is ongeldig.");
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Beoordeling moet tussen 1 en 5 liggen.");
  }
  if (!input.authorName.trim() || !input.body.trim()) {
    throw new Error("Naam en reviewtekst zijn verplicht.");
  }
  return input;
}
