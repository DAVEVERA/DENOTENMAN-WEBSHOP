import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { loadCloudCosts } from "@/lib/cloud-costs-bigquery";
import { createCloudCostsGetHandler } from "@/lib/cloud-costs-route";

export const runtime = "nodejs";

const handler = createCloudCostsGetHandler({
  authenticate: async (request) => {
    const token = (request as NextRequest).cookies.get(ADMIN_SESSION_COOKIE)?.value;
    return (await verifyAdminSessionToken(token)) !== null;
  },
  loadCosts: loadCloudCosts,
});

export async function GET(request: NextRequest) {
  return handler(request);
}
