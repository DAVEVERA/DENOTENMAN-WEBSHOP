import { NextResponse, type NextRequest } from "next/server";
import { EmailDeliveryKind } from "@prisma/client";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { parseAftersalesContent } from "@/lib/aftersales/schema";
import { renderAftersalesEmail } from "@/lib/aftersales/template";
import { deliverTransactionalEmail } from "@/lib/transactional-email";
import { isAftersalesSchemaUnavailable } from "@/lib/aftersales/database";
import { checkTransactionalProviderReadiness } from "@/lib/aftersales/provider";
import { aftersalesTestSampleFilters } from "@/lib/aftersales/test-sample";

const inputSchema = z.object({
  stepId: z.string().trim().min(1),
  email: z.string().trim().email(),
}).strict();

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const readiness = await checkTransactionalProviderReadiness();
  if (!readiness.ready) {
    return NextResponse.json(
      { error: "PROVIDER_NOT_READY", message: readiness.message },
      { status: 409 }
    );
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  let step;
  try {
    step = await prisma.aftersalesStep.findUnique({
      where: { id: parsed.data.stepId },
      include: { flow: { select: { logoUrl: true } } },
    });
  } catch (error) {
    if (!isAftersalesSchemaUnavailable(error)) throw error;
    return NextResponse.json(
      {
        error: "AFTERSALES_SCHEMA_MISSING",
        message:
          "Database-migratie 20260819010000_add_aftersales_automation is nog niet uitgevoerd.",
      },
      { status: 503 }
    );
  }
  if (!step) return NextResponse.json({ error: "STEP_NOT_FOUND" }, { status: 404 });
  const [realOrderFilter, testOrderFilter] = aftersalesTestSampleFilters(step.trigger);
  let order = await prisma.order.findFirst({
    where: realOrderFilter,
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!order) {
    order = await prisma.order.findFirst({
      where: testOrderFilter,
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
  }
  if (!order) return NextResponse.json({ error: "NO_SAMPLE_ORDER" }, { status: 409 });

  try {
    const stepContent = parseAftersalesContent(step.content);
    const locale = order.locale === "en" || order.locale === "fr" ? order.locale : "nl";
    const rendered = renderAftersalesEmail(order, step.trigger, stepContent.locales[locale], stepContent.design, step.flow.logoUrl);
    const result = await deliverTransactionalEmail({
      idempotencyKey: `aftersales-test-${crypto.randomUUID()}`,
      kind: EmailDeliveryKind.AFTERSALES_TEST,
      recipientEmail: parsed.data.email,
      recipientName: admin.name,
      orderId: order.id,
      trigger: step.trigger,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });
    if (result.status !== "accepted") {
      return NextResponse.json(
        {
          error: "PROVIDER_ERROR",
          message: result.status === "failed" ? result.error : "Testmail is al verwerkt.",
          logId: result.logId,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, provider: result.provider, logId: result.logId });
  } catch (error) {
    console.error("Failed to send aftersales test", { stepId: step.id, error });
    return NextResponse.json(
      { error: "PROVIDER_ERROR", message: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 502 }
    );
  }
}
