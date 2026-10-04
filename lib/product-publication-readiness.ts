export const publicationIssueCodes = [
  "NL_NAME_REQUIRED",
  "NL_SLUG_INVALID",
  "ACTIVE_VARIANT_WITH_PRICE_REQUIRED",
  "ACTIVE_CATEGORY_REQUIRED",
  "PRIMARY_IMAGE_REQUIRED",
] as const;

export type PublicationIssueCode = (typeof publicationIssueCodes)[number];

export type PublicationReadinessIssue = {
  code: PublicationIssueCode;
  path: string;
  message: string;
};

export type PublicationReadinessInput = {
  nlName: string | null | undefined;
  nlSlug: string | null | undefined;
  variants: ReadonlyArray<{
    isActive: boolean;
    priceCents: number;
    salePriceCents: number | null;
  }>;
  activeCategoryCount: number;
  hasPrimaryImage: boolean;
};

export type PublicationReadiness = {
  ready: boolean;
  issues: PublicationReadinessIssue[];
};

const validProductSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getPublicationReadiness(
  input: PublicationReadinessInput,
): PublicationReadiness {
  const issues: PublicationReadinessIssue[] = [];

  if (!input.nlName?.trim()) {
    issues.push({
      code: "NL_NAME_REQUIRED",
      path: "translations.nl.name",
      message: "Vul een Nederlandse productnaam in.",
    });
  }

  if (!input.nlSlug?.trim() || !validProductSlug.test(input.nlSlug.trim())) {
    issues.push({
      code: "NL_SLUG_INVALID",
      path: "translations.nl.slug",
      message: "Vul een geldige Nederlandse slug in met kleine letters, cijfers en koppeltekens.",
    });
  }

  const hasPricedActiveVariant = input.variants.some(
    (variant) => variant.isActive && (variant.salePriceCents ?? variant.priceCents) > 0,
  );
  if (!hasPricedActiveVariant) {
    issues.push({
      code: "ACTIVE_VARIANT_WITH_PRICE_REQUIRED",
      path: "variants",
      message: "Voeg minimaal een actieve variant toe met een effectieve prijs hoger dan EUR 0,00.",
    });
  }

  if (input.activeCategoryCount < 1) {
    issues.push({
      code: "ACTIVE_CATEGORY_REQUIRED",
      path: "categories",
      message: "Koppel minimaal een actieve categorie aan het product.",
    });
  }

  if (!input.hasPrimaryImage) {
    issues.push({
      code: "PRIMARY_IMAGE_REQUIRED",
      path: "images.primary",
      message: "Kies expliciet een primaire productafbeelding.",
    });
  }

  return { ready: issues.length === 0, issues };
}

export function publicationReadinessRegressed(
  current: PublicationReadiness,
  next: PublicationReadiness,
): boolean {
  const currentCodes = new Set(current.issues.map((issue) => issue.code));
  return next.issues.some((issue) => !currentCodes.has(issue.code));
}

export function publicationBlockedContract(issues: PublicationReadinessIssue[]) {
  return {
    status: 422,
    body: {
      error: "PUBLICATION_BLOCKED" as const,
      message: "Dit product kan nog niet online worden gezet.",
      issues,
    },
  };
}

export class PublicationBlockedError extends Error {
  readonly issues: PublicationReadinessIssue[];

  constructor(issues: PublicationReadinessIssue[]) {
    super("PUBLICATION_BLOCKED");
    this.name = "PublicationBlockedError";
    this.issues = issues;
  }
}

export function requirePublicationReadiness(input: PublicationReadinessInput): void {
  const readiness = getPublicationReadiness(input);
  if (!readiness.ready) throw new PublicationBlockedError(readiness.issues);
}
