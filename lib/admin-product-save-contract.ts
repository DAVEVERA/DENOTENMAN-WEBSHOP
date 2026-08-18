import type { ZodIssue } from "zod";

export type AdminProductErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "VERSION_REQUIRED"
  | "PRODUCT_NOT_FOUND"
  | "STALE_PRODUCT"
  | "SKU_CONFLICT"
  | "SLUG_CONFLICT"
  | "VARIANT_SKU_CONFLICT"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_PARENT_REQUIRED"
  | "RECOMMENDATION_NOT_FOUND"
  | "RECOMMENDATION_SELF"
  | "VARIANT_NOT_FOUND"
  | "VARIANT_HAS_ORDER_HISTORY"
  | "INTERNAL_ERROR";

export type AdminProductIssue = {
  code: string;
  path: Array<string | number>;
  message: string;
};

export type AdminProductErrorContract = {
  error: AdminProductErrorCode;
  message: string;
  field?: string;
  issues?: AdminProductIssue[];
  variantSku?: string;
  requestId?: string;
};

const contracts: Record<
  Exclude<AdminProductErrorCode, "VALIDATION_ERROR" | "VARIANT_HAS_ORDER_HISTORY" | "INTERNAL_ERROR">,
  { status: number; message: string; field?: string }
> = {
  UNAUTHORIZED: {
    status: 401,
    message: "Je beheersessie is verlopen. Log opnieuw in en probeer daarna opnieuw.",
  },
  INVALID_JSON: {
    status: 400,
    message: "De verzonden productgegevens konden niet worden gelezen. Herlaad de pagina en probeer opnieuw.",
  },
  VERSION_REQUIRED: {
    status: 400,
    field: "version",
    message: "De productversie ontbreekt. Herlaad de pagina voordat je opnieuw opslaat.",
  },
  PRODUCT_NOT_FOUND: {
    status: 404,
    message: "Dit product bestaat niet meer. Ga terug naar het productoverzicht.",
  },
  STALE_PRODUCT: {
    status: 409,
    field: "version",
    message: "Dit product is intussen elders gewijzigd. Herlaad de pagina voordat je opnieuw opslaat.",
  },
  SKU_CONFLICT: {
    status: 409,
    field: "sku",
    message: "Deze product-SKU is al in gebruik. Kies een andere SKU.",
  },
  SLUG_CONFLICT: {
    status: 409,
    field: "translations",
    message: "Een productslug is al in gebruik. Kies een andere slug in de betreffende taal.",
  },
  VARIANT_SKU_CONFLICT: {
    status: 409,
    field: "variants",
    message: "Een variant-SKU is al in gebruik. Kies een unieke SKU voor iedere variant.",
  },
  CATEGORY_NOT_FOUND: {
    status: 422,
    field: "categories",
    message: "Een gekozen categorie bestaat niet meer. Kies de categorie-indeling opnieuw.",
  },
  CATEGORY_PARENT_REQUIRED: {
    status: 422,
    field: "categories",
    message: "De gekozen categorie mist een bovenliggende categorie. Kies de volledige categorie-indeling opnieuw.",
  },
  RECOMMENDATION_NOT_FOUND: {
    status: 422,
    field: "recommendationIds",
    message: "Een gekozen meepakker bestaat niet meer. Kies de meepakkers opnieuw.",
  },
  RECOMMENDATION_SELF: {
    status: 422,
    field: "recommendationIds",
    message: "Een product kan zichzelf niet als meepakker hebben. Kies een ander product.",
  },
  VARIANT_NOT_FOUND: {
    status: 422,
    field: "variants",
    message: "Een variant bestaat niet meer of hoort bij een ander product. Herlaad de pagina.",
  },
};

export class AdminProductMutationError extends Error {
  readonly field?: string;
  readonly variantSku?: string;

  constructor(
    readonly code: AdminProductErrorCode,
    options: { field?: string; variantSku?: string } = {},
  ) {
    super(code);
    this.name = "AdminProductMutationError";
    this.field = options.field;
    this.variantSku = options.variantSku;
  }
}

export function validationErrorContract(issues: ZodIssue[]): AdminProductErrorContract {
  const normalized = issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
  const first = normalized[0];
  return {
    error: "VALIDATION_ERROR",
    message: first?.message ?? "Controleer de productgegevens en probeer opnieuw.",
    field: first?.path.join("."),
    issues: normalized,
  };
}

export function adminProductErrorContract(
  code: Exclude<AdminProductErrorCode, "VALIDATION_ERROR">,
  options: { field?: string; variantSku?: string; requestId?: string } = {},
): { status: number; body: AdminProductErrorContract } {
  if (code === "VARIANT_HAS_ORDER_HISTORY") {
    const variantSku = options.variantSku ?? "onbekend";
    return {
      status: 409,
      body: {
        error: code,
        field: options.field ?? "variants",
        variantSku,
        message: `Variant ${variantSku} staat in een bestelling en kan daarom niet worden verwijderd. Zet de variant op ‘Niet bestelbaar’ om de bestelgeschiedenis te bewaren.`,
      },
    };
  }
  if (code === "INTERNAL_ERROR") {
    return {
      status: 500,
      body: {
        error: code,
        requestId: options.requestId,
        message: options.requestId
          ? `De server kon het product niet opslaan. Probeer opnieuw. Blijft dit gebeuren, meld dan foutcode ${options.requestId}.`
          : "De server kon het product niet opslaan. Probeer opnieuw.",
      },
    };
  }

  const contract = contracts[code];
  return {
    status: contract.status,
    body: {
      error: code,
      message: contract.message,
      field: options.field ?? contract.field,
    },
  };
}

export function planVariantPersistence(
  current: Array<{ id: string; sku: string; orderItemCount: number }>,
  incoming: Array<{ id?: string; sku: string }>,
): { deleteIds: string[] } {
  const currentById = new Map(current.map((variant) => [variant.id, variant]));
  for (const variant of incoming) {
    if (variant.id && !currentById.has(variant.id)) {
      throw new AdminProductMutationError("VARIANT_NOT_FOUND", { field: "variants" });
    }
  }

  const retainedIds = new Set(incoming.flatMap((variant) => variant.id ? [variant.id] : []));
  const removed = current.filter((variant) => !retainedIds.has(variant.id));
  const referenced = removed.find((variant) => variant.orderItemCount > 0);
  if (referenced) {
    throw new AdminProductMutationError("VARIANT_HAS_ORDER_HISTORY", {
      field: "variants",
      variantSku: referenced.sku,
    });
  }

  return { deleteIds: removed.map((variant) => variant.id) };
}
