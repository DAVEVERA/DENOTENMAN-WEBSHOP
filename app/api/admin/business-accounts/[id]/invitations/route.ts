import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import {
  BusinessPortalError,
  createBusinessInvitation,
  sendBusinessInvitationEmail,
} from "@/lib/business-portal";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const created = await createBusinessInvitation({
      businessAccountId: id,
      adminUserId: admin.id,
      adminName: admin.name,
    });
    const delivery = await sendBusinessInvitationEmail({
      invitationId: created.invitation.id,
      token: created.token,
      account: created.account,
      adminName: admin.name,
    });

    if (delivery.status === "failed") {
      return NextResponse.json(
        {
          error: "INVITATION_EMAIL_FAILED",
          message: "De uitnodiging is veilig aangemaakt, maar de e-mailprovider heeft de verzending niet geaccepteerd. Probeer opnieuw.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, expiresAt: created.invitation.expiresAt }, { status: 201 });
  } catch (error) {
    if (error instanceof BusinessPortalError) {
      const status = error.code === "ACCOUNT_NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("Failed to create business invitation", error);
    return NextResponse.json({ error: "INVITATION_FAILED" }, { status: 500 });
  }
}
