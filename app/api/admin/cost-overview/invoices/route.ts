import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  parseInvoiceMetadata,
  parseListLimit,
} from "@/lib/cost-overview-schema";
import {
  CostInvoiceValidationError,
  buildCostInvoiceStorageKey,
  deleteCostInvoiceObject,
  invoiceFileSizeError,
  invoiceUploadLengthError,
  saveImmutableCostInvoice,
  validateCostInvoice,
} from "@/lib/cost-invoice-storage";
import {
  createCostInvoiceRecord,
  listCostInvoices,
  preflightCostInvoiceMutation,
  safeOriginalFilename,
} from "@/lib/cost-overview";
import {
  authorizeCostRequest,
  costErrorResponse,
  costJson,
  requireCostIdempotencyKey,
} from "@/lib/cost-overview-http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorization = await authorizeCostRequest(request, false);
  if (authorization instanceof Response) return authorization;
  try {
    const limit = parseListLimit(request.nextUrl.searchParams.get("limit"));
    return costJson({
      invoices: await listCostInvoices(limit),
      canManage: authorization.canManage,
    });
  } catch (error) {
    return costErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeCostRequest(request, true);
  if (authorization instanceof Response) return authorization;
  const idempotencyKey = requireCostIdempotencyKey(request);
  if (idempotencyKey instanceof NextResponse) return idempotencyKey;
  const lengthError = invoiceUploadLengthError(
    request.headers.get("content-length"),
  );
  if (lengthError) {
    return costJson(
      { error: lengthError },
      lengthError === "CONTENT_LENGTH_REQUIRED"
        ? 411
        : lengthError === "INVOICE_TOO_LARGE"
          ? 413
          : 400,
    );
  }
  const form = await request.formData().catch(() => null);
  if (!form) return costJson({ error: "INVALID_FORM_DATA" }, 400);
  const metadata = parseInvoiceMetadata(form);
  const file = form.get("file");
  if (!metadata.success || !(file instanceof File)) {
    return costJson(
      {
        error: "VALIDATION_ERROR",
        issues: metadata.success ? [] : metadata.error.issues,
      },
      400,
    );
  }
  const fileSizeError = invoiceFileSizeError(
    file.size,
    request.headers.get("content-length"),
  );
  if (fileSizeError) {
    return costJson(
      { error: fileSizeError },
      fileSizeError === "INVOICE_TOO_LARGE" ? 413 : 400,
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  let validated;
  try {
    validated = await validateCostInvoice(bytes, file.type);
  } catch (error) {
    const code =
      error instanceof CostInvoiceValidationError
        ? error.message
        : "INVALID_INVOICE";
    return costJson({ error: code }, code === "INVOICE_TOO_LARGE" ? 413 : 400);
  }
  const storageKey = buildCostInvoiceStorageKey(validated.extension);
  const originalFilename = safeOriginalFilename(
    file.name,
    validated.contentType,
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const mutationPayload = {
    metadata: metadata.data,
    originalFilename,
    contentType: validated.contentType,
    fileSize: validated.fileSize,
    sha256,
  };
  try {
    const replay = await preflightCostInvoiceMutation(
      authorization.admin.id,
      idempotencyKey,
      mutationPayload,
    );
    if (replay) return costJson({ invoice: replay, replayed: true });
  } catch (error) {
    return costErrorResponse(error);
  }
  let stored = false;
  let committed = false;
  try {
    await saveImmutableCostInvoice(storageKey, bytes, validated.contentType);
    stored = true;
    const result = await createCostInvoiceRecord({
      admin: authorization.admin,
      idempotencyKey,
      metadata: metadata.data,
      storageKey,
      originalFilename,
      contentType: validated.contentType,
      fileSize: validated.fileSize,
      sha256,
    });
    if (result.replayed) {
      await deleteCostInvoiceObject(storageKey);
      stored = false;
    } else {
      committed = true;
    }
    return costJson(
      { invoice: result.invoice, replayed: result.replayed },
      result.replayed ? 200 : 201,
    );
  } catch (error) {
    if (stored && !committed) {
      await deleteCostInvoiceObject(storageKey).catch(() => undefined);
    }
    return costErrorResponse(error);
  }
}
