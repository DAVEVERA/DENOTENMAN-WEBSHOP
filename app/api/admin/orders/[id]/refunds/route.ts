import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import {
  createOrderRefund,
  OrderRefundError,
} from "@/lib/order-refund-service";

const requestSchema = z
  .object({
    requestId: z.string().uuid(),
    businessCancellationRequestId: z.string().trim().min(1).nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
    includeShipping: z.boolean().default(false),
    items: z
      .array(
        z
          .object({
            orderItemId: z.string().trim().min(1),
            quantity: z.number().int().min(1),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const refund = await createOrderRefund(
      {
        orderId: id,
        requestId: parsed.data.requestId,
        selections: parsed.data.items,
        includeShipping: parsed.data.includeShipping,
        reason: parsed.data.reason ?? null,
      },
      admin
    );
    if (parsed.data.businessCancellationRequestId) {
      await prisma.businessOrderCancellationRequest.updateMany({
        where: {
          id: parsed.data.businessCancellationRequestId,
          orderId: id,
          status: "PENDING",
        },
        data: { status: "PROCESSED" },
      });
    }
    revalidatePath(`/admin/bestellingen/${id}`);
    revalidatePath("/admin/bestellingen");
    revalidatePath("/nl/zakelijk");
    return NextResponse.json({
      refund: {
        id: refund.id,
        mollieRefundId: refund.mollieRefundId,
        amountCents: refund.amountCents,
        status: refund.status,
      },
    });
  } catch (error) {
    if (error instanceof OrderRefundError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("Partial order refund failed", { orderId: id, error });
    return NextResponse.json({ error: "REFUND_FAILED" }, { status: 500 });
  }
}
