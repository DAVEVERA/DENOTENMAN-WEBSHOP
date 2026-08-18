import type { MeasurementUnit, Prisma } from "@prisma/client";

export const KILOKNALLER_MINIMUM_BASE_UNITS = 1000;

export function isKiloknallerCategory(canonicalSlug: string): boolean {
  return canonicalSlug === "acties";
}

export function isKiloknallerVariant(
  unit: MeasurementUnit,
  amountBaseUnits: number,
  isActive: boolean
): boolean {
  return (
    isActive &&
    (unit === "WEIGHT" || unit === "VOLUME") &&
    amountBaseUnits >= KILOKNALLER_MINIMUM_BASE_UNITS
  );
}

export const kiloknallerProductWhere = {
  isActive: true,
  variants: {
    some: {
      isActive: true,
      weightGrams: { gte: KILOKNALLER_MINIMUM_BASE_UNITS },
    },
  },
} satisfies Prisma.ProductWhereInput;
