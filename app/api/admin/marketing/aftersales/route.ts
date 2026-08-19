import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { aftersalesFlowInputSchema } from "@/lib/aftersales/schema";
import {
  aftersalesProviderStatus,
  checkTransactionalProviderReadiness,
} from "@/lib/aftersales/provider";
import { isAftersalesSchemaUnavailable } from "@/lib/aftersales/database";

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = aftersalesFlowInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;
  if (input.isActive && aftersalesProviderStatus().provider === "none") {
    return NextResponse.json({ error: "PROVIDER_NOT_CONFIGURED" }, { status: 409 });
  }
  if (input.isActive) {
    const readiness = await checkTransactionalProviderReadiness();
    if (!readiness.ready) {
      return NextResponse.json(
        { error: "PROVIDER_NOT_READY", message: readiness.message },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.aftersalesFlow.findUnique({
        where: { id: input.id },
        include: { steps: { orderBy: { position: "asc" } } },
      });
      if (!existing) throw new Error("FLOW_NOT_FOUND");
      if (existing.updatedAt.toISOString() !== input.version) throw new Error("STALE_FLOW");
      const existingStepIds = new Set(existing.steps.map((step) => step.id));
      if (input.steps.some((step) => !existingStepIds.has(step.id))) {
        throw new Error("STEP_NOT_FOUND");
      }

      await transaction.aftersalesFlow.update({
        where: { id: input.id },
        data: { name: input.name, isActive: input.isActive },
      });
      for (const step of input.steps) {
        await transaction.aftersalesStep.update({
          where: { id: step.id },
          data: {
            name: step.name,
            position: step.position,
            enabled: step.enabled,
            delayMinutes: step.delayMinutes,
            content: step.content as Prisma.InputJsonValue,
          },
        });
      }
      const result = await transaction.aftersalesFlow.findUniqueOrThrow({
        where: { id: input.id },
        include: { steps: { orderBy: { position: "asc" } } },
      });
      await recordAudit(
        transaction,
        admin,
        "AftersalesFlow",
        input.id,
        "UPDATE",
        existing,
        result
      );
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/admin/marketing/aftersales");
    return NextResponse.json({
      flow: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        steps: updated.steps.map((step) => ({
          ...step,
          createdAt: step.createdAt.toISOString(),
          updatedAt: step.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    if (isAftersalesSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          error: "AFTERSALES_SCHEMA_MISSING",
          message:
            "Database-migratie 20260819010000_add_aftersales_automation is nog niet uitgevoerd.",
        },
        { status: 503 }
      );
    }
    if (error instanceof Error && error.message === "FLOW_NOT_FOUND") {
      return NextResponse.json({ error: "FLOW_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "STALE_FLOW") {
      return NextResponse.json({ error: "STALE_FLOW" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "STEP_NOT_FOUND") {
      return NextResponse.json({ error: "STEP_NOT_FOUND" }, { status: 400 });
    }
    console.error("Failed to update aftersales flow", { flowId: input.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
