import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { AdminDashboardWorkspace } from "@/components/admin-panel/AdminDashboardWorkspace";

export default async function AdminDashboardPage() {
  await connection();
  const session = await verifyAdminSessionToken(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { active: true },
  });
  if (!admin?.active) redirect("/admin/login");

  const [productCount, categoryCount, orderCount, pendingOrders, recentOrders] =
    await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          contactName: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      }),
    ]);

  return (
    <AdminDashboardWorkspace
      commerce={{
        activeProducts: productCount,
        categories: categoryCount,
        totalOrders: orderCount,
        pendingOrders,
      }}
      recentOrders={recentOrders.map((order) => ({
        id: order.id,
        contactName: order.contactName,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        total: formatPrice(order.totalCents, "nl"),
      }))}
    />
  );
}
