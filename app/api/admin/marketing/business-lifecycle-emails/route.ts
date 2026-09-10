import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { BUSINESS_LIFECYCLE_EMAIL_DEFAULTS, BUSINESS_LIFECYCLE_EMAIL_KINDS } from "@/lib/business-lifecycle-email-content";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await prisma.businessLifecycleEmailContent.findMany({ where: { kind: { in: BUSINESS_LIFECYCLE_EMAIL_KINDS } } });
  const rowByKind = new Map(rows.map((row) => [row.kind, row]));

  const templates = BUSINESS_LIFECYCLE_EMAIL_KINDS.map((kind) => {
    const row = rowByKind.get(kind);
    const defaults = BUSINESS_LIFECYCLE_EMAIL_DEFAULTS[kind];
    if (!row) {
      return { kind, ...defaults, isCustomized: false };
    }
    return {
      kind,
      subject: row.subject,
      heading: row.heading,
      bodyText: row.bodyText,
      buttonLabel: row.buttonLabel ?? defaults.buttonLabel,
      isCustomized: true,
    };
  });

  return NextResponse.json({ templates });
}
