import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { z } from "zod";

const markReadSchema = z.object({ eventIds: z.array(z.string().min(1).max(100)).min(1).max(50) }).strict();

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [unreadCount, events] = await Promise.all([
    prisma.businessEvent.count({
      where: { actorType: "CUSTOMER", reads: { none: { adminUserId: admin.id } } },
    }),
    prisma.businessEvent.findMany({
      where: { actorType: "CUSTOMER" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true, summary: true, createdAt: true, businessAccountId: true,
        businessAccount: { select: { companyName: true } },
        reads: { where: { adminUserId: admin.id }, select: { adminUserId: true }, take: 1 },
      },
    }),
  ]);
  return NextResponse.json({
    unreadCount,
    events: events.map((event) => ({
      id: event.id, summary: event.summary, createdAt: event.createdAt.toISOString(),
      companyName: event.businessAccount.companyName,
      href: `/admin/zakelijk/${event.businessAccountId}`, unread: event.reads.length === 0,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const unread = await prisma.businessEvent.findMany({
    where: { id: { in: parsed.data.eventIds }, actorType: "CUSTOMER", reads: { none: { adminUserId: admin.id } } },
    select: { id: true },
  });
  if (unread.length > 0) {
    await prisma.businessEventRead.createMany({
      data: unread.map((event) => ({ businessEventId: event.id, adminUserId: admin.id })),
      skipDuplicates: true,
    });
  }
  return NextResponse.json({ ok: true });
}
