import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import { mapDesignStudioError, publishDesignAsset } from "@/lib/design-studio/service";

export const runtime = "nodejs";

const publishSchema = z.object({ assetId: z.string().trim().min(1).max(100) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Alleen owners en admins mogen ontwerpen publiceren." }, { status: 403 });
  }
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = publishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Het conceptresultaat ontbreekt." }, { status: 422 });
  const { jobId } = await params;
  try {
    const result = await publishDesignAsset({ adminUserId: admin.id, jobId, assetId: parsed.data.assetId });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mapDesignStudioError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}
