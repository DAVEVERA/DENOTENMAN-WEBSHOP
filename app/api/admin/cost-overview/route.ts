import type { NextRequest } from "next/server";
import {
  authorizeCostRequest,
  costErrorResponse,
  costJson,
} from "@/lib/cost-overview-http";
import { listCostInvoices, listManagedCosts } from "@/lib/cost-overview";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorization = await authorizeCostRequest(request, false);
  if (authorization instanceof Response) return authorization;
  try {
    const [managedCosts, invoices] = await Promise.all([
      listManagedCosts(100),
      listCostInvoices(50),
    ]);
    return costJson({
      managedCosts,
      invoices,
      canManage: authorization.canManage,
    });
  } catch (error) {
    return costErrorResponse(error);
  }
}
