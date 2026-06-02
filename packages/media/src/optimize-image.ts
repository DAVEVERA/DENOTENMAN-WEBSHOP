export type OptimizedImagePlan = {
  sourcePath: string;
  outputBasePath: string;
  widths: number[];
  formats: Array<"webp" | "avif" | "original">;
};

export function createOptimizedImagePlan(input: OptimizedImagePlan) {
  if (!input.sourcePath.trim()) throw new Error("Bronbestand ontbreekt.");
  if (!input.outputBasePath.trim()) throw new Error("Outputpad ontbreekt.");
  if (input.widths.length === 0) throw new Error("Minimaal een breedte is verplicht.");
  return input;
}
