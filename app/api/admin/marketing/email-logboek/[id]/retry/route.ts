import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { aftersalesProviderStatus } from "@/lib/aftersales/provider";
import { retryTransactionalEmail } from "@/lib/transactional-email";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/admin/marketing/email-logboek/[id]/retry">
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (aftersalesProviderStatus().provider === "none") {
    return NextResponse.json(
      {
        error: "PROVIDER_NOT_CONFIGURED",
        message: "Configureer eerst een transactionele mailprovider.",
      },
      { status: 409 }
    );
  }

  const { id } = await context.params;
  try {
    const result = await retryTransactionalEmail(id);
    if (result.status === "accepted") {
      return NextResponse.json({ ok: true, result });
    }
    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.code, message: result.error, logId: result.logId },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "EMAIL_NOT_RETRYABLE", message: "Deze mail is al geaccepteerd of wordt verwerkt." },
      { status: 409 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_LOG_NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("Transactional email retry failed", { logId: id, adminId: admin.id, error });
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Opnieuw aanbieden is intern mislukt." },
      { status: 500 }
    );
  }
}
