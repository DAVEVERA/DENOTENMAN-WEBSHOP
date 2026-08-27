import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { mapDesignStudioError } from "@/lib/design-studio/service";
import { refreshVModelCampaignJob } from "@/lib/design-studio/vmodel-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Alleen owners en admins mogen VModel-resultaten bekijken." }, { status: 403 });
  }
  const { jobId } = await params;
  try {
    const job = await refreshVModelCampaignJob(jobId);
    return NextResponse.json({ job }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mapDesignStudioError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}
