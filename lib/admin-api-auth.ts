import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { AdminUser } from "@prisma/client";

export async function hasAdminSession(request: NextRequest): Promise<boolean> {
  const session = await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  return session !== null;
}

export async function getAdminSession(request: NextRequest): Promise<AdminUser | null> {
  const session = await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await prisma.adminUser.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;

  return user;
}
