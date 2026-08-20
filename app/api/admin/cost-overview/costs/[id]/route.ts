import { NextResponse, type NextRequest } from "next/server";
import {
  deleteCostSchema,
  managedCostUpdateSchema,
} from "@/lib/cost-overview-schema";
import { softDeleteManagedCost, updateManagedCost } from "@/lib/cost-overview";
import {
  authorizeCostRequest,
  costErrorResponse,
  costJson,
  isUuid,
  parseCostJson,
  requireCostIdempotencyKey,
} from "@/lib/cost-overview-http";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: Context) {
  const authorization = await authorizeCostRequest(request, true);
  if (authorization instanceof Response) return authorization;
  const idempotencyKey = requireCostIdempotencyKey(request);
  if (idempotencyKey instanceof NextResponse) return idempotencyKey;
  const { id } = await params;
  if (!isUuid(id)) return costJson({ error: "NOT_FOUND" }, 404);
  const body = await parseCostJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = managedCostUpdateSchema.safeParse(body);
  if (!parsed.success)
    return costJson(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      400,
    );
  try {
    const result = await updateManagedCost(
      id,
      authorization.admin,
      idempotencyKey,
      parsed.data,
    );
    return costJson({ cost: result.cost, replayed: result.replayed });
  } catch (error) {
    return costErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const authorization = await authorizeCostRequest(request, true);
  if (authorization instanceof Response) return authorization;
  const idempotencyKey = requireCostIdempotencyKey(request);
  if (idempotencyKey instanceof NextResponse) return idempotencyKey;
  const { id } = await params;
  if (!isUuid(id)) return costJson({ error: "NOT_FOUND" }, 404);
  const body = await parseCostJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = deleteCostSchema.safeParse(body);
  if (!parsed.success)
    return costJson(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      400,
    );
  try {
    const result = await softDeleteManagedCost(
      id,
      authorization.admin,
      idempotencyKey,
      parsed.data.expectedVersion,
    );
    return costJson({ cost: result.cost, replayed: result.replayed });
  } catch (error) {
    return costErrorResponse(error);
  }
}
