import { NextResponse, type NextRequest } from "next/server";
import {
  managedCostCreateSchema,
  parseListLimit,
} from "@/lib/cost-overview-schema";
import { createManagedCost, listManagedCosts } from "@/lib/cost-overview";
import {
  authorizeCostRequest,
  costErrorResponse,
  costJson,
  parseCostJson,
  requireCostIdempotencyKey,
} from "@/lib/cost-overview-http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorization = await authorizeCostRequest(request, false);
  if (authorization instanceof Response) return authorization;
  try {
    const limit = parseListLimit(request.nextUrl.searchParams.get("limit"));
    return costJson({
      costs: await listManagedCosts(limit),
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
  const body = await parseCostJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = managedCostCreateSchema.safeParse(body);
  if (!parsed.success)
    return costJson(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      400,
    );
  try {
    const result = await createManagedCost(
      authorization.admin,
      idempotencyKey,
      parsed.data,
    );
    return costJson(
      { cost: result.cost, replayed: result.replayed },
      result.replayed ? 200 : 201,
    );
  } catch (error) {
    return costErrorResponse(error);
  }
}
