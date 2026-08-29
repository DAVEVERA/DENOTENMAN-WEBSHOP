import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  emptyPriceMonitorDashboard,
  getPriceMonitorDashboard,
} from "@/lib/price-monitor/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    return NextResponse.json(await getPriceMonitorDashboard(), {
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return NextResponse.json(emptyPriceMonitorDashboard(true), {
        headers: { "cache-control": "private, no-store, max-age=0" },
      });
    }
    console.error("Price monitor dashboard failed", { adminUserId: admin.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
