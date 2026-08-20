export type Circle = {
  centerX: number;
  centerY: number;
  radius: number;
};

export type SquareCrop = {
  left: number;
  top: number;
  size: number;
};

export type CropCalculation =
  | { ok: true; crop: SquareCrop }
  | { ok: false; reason: "invalid_dimensions" | "invalid_circle" | "insufficient_source_margin" };

export function calculateCenteredSquareCrop(
  sourceWidth: number,
  sourceHeight: number,
  circle: Circle,
  marginRatio: number
): CropCalculation {
  if (
    !Number.isInteger(sourceWidth) ||
    !Number.isInteger(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return { ok: false, reason: "invalid_dimensions" };
  }
  if (
    !Number.isFinite(circle.centerX) ||
    !Number.isFinite(circle.centerY) ||
    !Number.isFinite(circle.radius) ||
    circle.radius <= 0 ||
    !Number.isFinite(marginRatio) ||
    marginRatio < 0
  ) {
    return { ok: false, reason: "invalid_circle" };
  }

  const requiredRadius = circle.radius * (1 + marginRatio);
  const size = Math.ceil(requiredRadius * 2);
  const left = Math.floor(circle.centerX - size / 2);
  const top = Math.floor(circle.centerY - size / 2);
  const right = left + size;
  const bottom = top + size;

  if (
    size > sourceWidth ||
    size > sourceHeight ||
    left < 0 ||
    top < 0 ||
    right > sourceWidth ||
    bottom > sourceHeight
  ) {
    return { ok: false, reason: "insufficient_source_margin" };
  }

  return { ok: true, crop: { left, top, size } };
}
