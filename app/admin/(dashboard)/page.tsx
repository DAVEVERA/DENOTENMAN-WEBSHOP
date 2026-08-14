import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export default async function AdminDashboardPage() {
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

  const stats = [
    { label: "Actieve producten", value: productCount, href: "/admin/producten" },
    { label: "Categorieën", value: categoryCount, href: "/admin/categorieen" },
    { label: "Bestellingen totaal", value: orderCount, href: "/admin/bestellingen" },
    { label: "Openstaand", value: pendingOrders, href: "/admin/bestellingen?status=PENDING" },
  ];

  return (
    <div>
      <h1 className="text-heading-xl text-text">Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-panel border border-border bg-surface p-4 shadow-card transition-colors duration-hover-fast hover:border-border-hover"
          >
            <p className="text-body-sm text-muted">{stat.label}</p>
            <p className="mt-1 font-heading text-heading-lg font-bold text-text">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-md text-text">Recente bestellingen</h2>
          <Link
            href="/admin/bestellingen"
            className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
          >
            Alle bestellingen
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="mt-4 text-body-sm text-muted">Nog geen bestellingen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-panel border border-border bg-surface">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-heading">Bestelnummer</th>
                  <th className="px-4 py-3 font-heading">Klant</th>
                  <th className="px-4 py-3 font-heading">Status</th>
                  <th className="px-4 py-3 font-heading">Datum</th>
                  <th className="px-4 py-3 text-right font-heading">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/bestellingen/${order.id}`}
                        className="font-mono text-accent-hover underline underline-offset-4"
                      >
                        {order.id.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text">{order.contactName}</td>
                    <td className="px-4 py-3 text-text">{order.status}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Intl.DateTimeFormat("nl-NL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatPrice(order.totalCents, "nl")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
