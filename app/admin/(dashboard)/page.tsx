import { cookies } from "next/headers";
import { after, connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getInitialAdminDashboardAnalytics } from "@/lib/admin-dashboard-analytics";
import { AdminDashboardWorkspace } from "@/components/admin-panel/AdminDashboardWorkspace";
import { openDeveloperInvoiceSummary, processDeveloperInvoiceReminders } from "@/lib/developer-portal/service";

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

  const [productCount, categoryCount, orderCount, pendingOrders, recentOrders, initialAnalytics] =
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
          orderNumber: true,
          contactName: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      }),
      getInitialAdminDashboardAnalytics(),
    ]);
  const developerInvoices = await openDeveloperInvoiceSummary().catch(() => null);
  // Safety net next to the daily job: confirms payments and sends due reminders.
  after(() => processDeveloperInvoiceReminders().catch((error) => console.error("Developer invoice reminders failed", error)));

  return (
    <>
    {developerInvoices?.count ? (
      <p role="status" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900">
        <span className="min-w-0 flex-1">
          {developerInvoices.count === 1 ? "Er staat een factuur van de ontwikkelaar klaar" : `Er staan ${developerInvoices.count} facturen van de ontwikkelaar klaar`}: {formatPrice(developerInvoices.totalCents, "nl")}{developerInvoices.overdue ? `, waarvan ${developerInvoices.overdue} over de vervaldatum` : ""}.
        </span>
        <Link href="/admin/ontwikkelaarsfacturen" className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast">Bekijken en betalen</Link>
      </p>
    ) : null}
    <AdminDashboardWorkspace
      commerce={{
        activeProducts: productCount,
        categories: categoryCount,
        totalOrders: orderCount,
        pendingOrders,
      }}
      initialAnalytics={initialAnalytics}
      recentOrders={recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber ?? order.id,
        contactName: order.contactName,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        total: formatPrice(order.totalCents, "nl"),
      }))}
    />
    </>
  );
}
