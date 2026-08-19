import "server-only";
import { Prisma, type AftersalesTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAftersalesContent } from "@/lib/aftersales/schema";
import { renderAftersalesEmail } from "@/lib/aftersales/template";
import { sendAftersalesMail } from "@/lib/aftersales/provider";

export type DispatchAftersalesResult =
  | { status: "disabled" | "no-step" | "duplicate" }
  | { status: "sent"; deliveryId: string; provider: string }
  | { status: "failed"; deliveryId: string; error: string };

export async function dispatchAftersalesEvent(
  orderId: string,
  trigger: AftersalesTrigger
): Promise<DispatchAftersalesResult> {
  const flow = await prisma.aftersalesFlow.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: {
        where: { trigger, enabled: true, delayMinutes: 0 },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!flow) return { status: "disabled" };
  const step = flow.steps[0];
  if (!step) return { status: "no-step" };

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error(`Bestelling ${orderId} bestaat niet`);

  let delivery;
  try {
    delivery = await prisma.aftersalesDelivery.create({
      data: { orderId, stepId: step.id, trigger, status: "PENDING" },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "duplicate" };
    }
    throw error;
  }

  try {
    const content = parseAftersalesContent(step.content);
    const locale = order.locale === "en" || order.locale === "fr" ? order.locale : "nl";
    const rendered = renderAftersalesEmail(order, trigger, content[locale]);
    const result = await sendAftersalesMail({
      deliveryId: delivery.id,
      orderId,
      trigger,
      to: order.contactEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await prisma.aftersalesDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        provider: result.provider,
        providerMessageId: result.messageId,
        attempts: { increment: 1 },
        sentAt: new Date(),
        errorMessage: null,
      },
    });
    return { status: "sent", deliveryId: delivery.id, provider: result.provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende verzendfout";
    await prisma.aftersalesDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", attempts: { increment: 1 }, errorMessage: message.slice(0, 1000) },
    });
    console.error("Aftersales mail failed", { orderId, trigger, deliveryId: delivery.id, error });
    return { status: "failed", deliveryId: delivery.id, error: message };
  }
}
