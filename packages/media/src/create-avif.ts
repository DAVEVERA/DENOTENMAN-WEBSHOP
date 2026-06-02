import type { OptimizedImagePlan } from "./optimize-image";

export function createAvifTargets(plan: OptimizedImagePlan) {
  return plan.widths.map((width) => ({
    width,
    path: `${plan.outputBasePath}-${width}.avif`,
    format: "avif" as const,
  }));
}
