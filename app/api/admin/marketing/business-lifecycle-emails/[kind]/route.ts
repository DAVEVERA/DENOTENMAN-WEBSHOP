import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import {
  BUSINESS_LIFECYCLE_EMAIL_DEFAULTS,
  BUSINESS_LIFECYCLE_EMAIL_KINDS,
  businessLifecycleEmailPatchSchema,
  type BusinessLifecycleEmailKindValue,
} from "@/lib/business-lifecycle-email-content";

function isValidKind(value: string): value is BusinessLifecycleEmailKindValue {
  return (BUSINESS_LIFECYCLE_EMAIL_KINDS as string[]).includes(value);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { kind: rawKind } = await params;
  const kind = rawKind.toUpperCase();
  if (!isValidKind(kind)) {
    return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
  }

  const parsed = businessLifecycleEmailPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const buttonLabel = input.buttonLabel === undefined ? null : input.buttonLabel;

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessLifecycleEmailContent.findUnique({ where: { kind } });
    const row = await tx.businessLifecycleEmailContent.upsert({
      where: { kind },
      create: {
        kind,
        subject: input.subject,
        heading: input.heading,
        bodyText: input.bodyText,
        buttonLabel,
      },
      update: {
        subject: input.subject,
        heading: input.heading,
        bodyText: input.bodyText,
        buttonLabel,
      },
    });
    await recordAudit(
      tx,
      admin,
      "BusinessLifecycleEmailContent",
      row.id,
      existing ? "UPDATE" : "CREATE",
      existing,
      row
    );
    return row;
  });

  revalidatePath("/admin/marketing/service-en-support-zakelijk");

  const defaults = BUSINESS_LIFECYCLE_EMAIL_DEFAULTS[kind];
  return NextResponse.json({
    template: {
      kind,
      subject: updated.subject,
      heading: updated.heading,
      bodyText: updated.bodyText,
      buttonLabel: updated.buttonLabel ?? defaults.buttonLabel,
      isCustomized: true,
    },
  });
}
