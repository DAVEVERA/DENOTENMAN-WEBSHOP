import { ShoppingBag, Clock, TrendingUp, Package } from "lucide-react";
import { adminApi } from "../lib/admin-api";
import type { AdminStats } from "../lib/admin-api";

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        <span className="text-neutral-400" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

async function getStats(): Promise<AdminStats | null> {
  try {
    return await adminApi.stats();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  if (!stats) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <div className="mt-4 rounded-lg border border-danger-border bg-danger-light px-4 py-3">
          <p className="text-sm text-danger">
            Statistieken konden niet worden geladen. Controleer de API-verbinding.
          </p>
        </div>
      </div>
    );
  }

  const openOrders = stats.pendingOrders + stats.paidOrders;

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Overzicht van de DeNotenman webshop.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bestellingen totaal"
          value={stats.totalOrders}
          icon={<ShoppingBag size={18} />}
        />
        <StatCard label="Open bestellingen" value={openOrders} icon={<Clock size={18} />} />
        <StatCard
          label="Omzet deze maand"
          value={formatEuro(stats.revenueThisMonth)}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Actieve producten"
          value={stats.activeProducts}
          icon={<Package size={18} />}
        />
      </div>
    </div>
  );
}
