import type { CSSProperties } from "react";
import offsets from "@/lib/data/product-image-offsets.json";
import aspectRatios from "@/lib/data/product-image-aspect.json";

const offsetMap = offsets as Record<string, number[]>;
const aspectMap = aspectRatios as Record<string, number>;

const MAX_ZOOM = 1.18;
const GAIN = 0.85;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type FocalStyle = CSSProperties & {
  "--focal-zoom"?: string;
  "--focal-x"?: string;
  "--focal-y"?: string;
};

/**
 * object-fit: cover on a non-square photo already crops away part of the
 * image before our transform ever runs (e.g. a 0.6 aspect portrait loses
 * ~40% of its height to cover-cropping alone). Stacking the full extra zoom
 * on top of that compounds the crop and can push the subject out of frame
 * entirely. Scale the extra zoom down as the source image departs from 1:1,
 * so already-tight crops don't get tighter still.
 */
function effectiveZoom(url: string | undefined | null): number {
  const ratio = url ? aspectMap[url] : undefined;
  if (!ratio) return MAX_ZOOM;

  const departureFromSquare = Math.min(ratio, 1 / ratio);
  return 1 + (MAX_ZOOM - 1) * clamp(departureFromSquare, 0, 1);
}

export function getProductImageStyle(url: string | undefined | null): FocalStyle {
  const zoom = effectiveZoom(url);
  const measured = url ? offsetMap[url] : undefined;

  if (!measured) {
    return { "--focal-zoom": `${zoom}` };
  }

  const maxTranslatePct = ((zoom - 1) / (2 * zoom)) * 100;
  const [offsetXPct, offsetYPct] = measured;
  const translateX = clamp(-offsetXPct * GAIN, -maxTranslatePct, maxTranslatePct);
  const translateY = clamp(-offsetYPct * GAIN, -maxTranslatePct, maxTranslatePct);

  return {
    "--focal-zoom": `${zoom}`,
    "--focal-x": `${translateX.toFixed(2)}%`,
    "--focal-y": `${translateY.toFixed(2)}%`,
  };
}
