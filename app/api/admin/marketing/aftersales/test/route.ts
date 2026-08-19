import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { parseAftersalesContent } from "@/lib/aftersales/schema";
import { renderAftersalesEmail } from "@/lib/aftersales/template";
import { sendAftersalesMail } from "@/lib/aftersales/provider";

const inputSchema = z.object({
  stepId: z.string().trim().min(1),
  email: z.string().trim().email(),
}).strict();

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const step = await prisma.aftersalesStep.findUnique({ where: { id: parsed.data.stepId } });
  if (!step) return NextResponse.json({ error: "STEP_NOT_FOUND" }, { status: 404 });
  const order = await prisma.order.findFirst({
    where: {
      isTest: false,
      status: step.trigger === "ORDER_FULFILLED" ? "FULFILLED" : { in: ["PAID", "FULFILLED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "NO_SAMPLE_ORDER" }, { status: 409 });

  try {
    const content = parseAftersalesContent(step.content);
    const locale = order.locale === "en" || order.locale === "fr" ? order.locale : "nl";
    const rendered = renderAftersalesEmail(order, step.trigger, content[locale]);
    const result = await sendAftersalesMail({
      deliveryId: `test-${crypto.randomUUID()}`,
      orderId: order.id,
      trigger: `test_${step.trigger.toLowerCase()}`,
      to: parsed.data.email,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });
    return NextResponse.json({ ok: true, provider: result.provider });
  } catch (error) {
    console.error("Failed to send aftersales test", { stepId: step.id, error });
    return NextResponse.json(
      { error: "PROVIDER_ERROR", message: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 502 }
    );
  }
}
