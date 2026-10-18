import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { can } from "@/lib/roles";
import { sendReviewRequest } from "@/lib/review-requests-db";
import { reviewRequestBlockMessage } from "@/lib/review-requests";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(admin.role, "orders", "write")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const result = await sendReviewRequest(id);
    if (result.status === "sent") {
      return NextResponse.json({ ok: true, status: "sent" });
    }
    if (result.status === "skipped") {
      // Not an error: the rules deliberately held this one back, and the admin
      // gets the reason in their own language.
      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: result.reason,
        message: reviewRequestBlockMessage(result.reason),
      });
    }
    return NextResponse.json(
      { error: "SEND_FAILED", message: result.error },
      { status: 502 }
    );
  } catch (error) {
    console.error("Failed to send review request", { orderId: id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
