import type { OptimizedImagePlan } from "./optimize-image";

export function createWebpTargets(plan: OptimizedImagePlan) {
  return plan.widths.map((width) => ({
    width,
    path: `${plan.outputBasePath}-${width}.webp`,
    format: "webp" as const,
  }));
}
