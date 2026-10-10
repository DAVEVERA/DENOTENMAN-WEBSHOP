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

/**
 * The framing used when circle detection is not confident enough to crop on.
 * Takes the largest centred square the source allows, which for the square
 * sources the catalogue actually holds is the whole frame — so a card still
 * gets a pre-rendered variant without anyone guessing where the product is.
 */
export function calculateFullFrameSquareCrop(
  sourceWidth: number,
  sourceHeight: number
): CropCalculation {
  if (
    !Number.isInteger(sourceWidth) ||
    !Number.isInteger(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return { ok: false, reason: "invalid_dimensions" };
  }

  const size = Math.min(sourceWidth, sourceHeight);
  return {
    ok: true,
    crop: {
      left: Math.floor((sourceWidth - size) / 2),
      top: Math.floor((sourceHeight - size) / 2),
      size,
    },
  };
}
