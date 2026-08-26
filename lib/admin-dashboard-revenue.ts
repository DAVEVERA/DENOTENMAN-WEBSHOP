import type { DashboardTrendPoint } from "@/lib/admin-dashboard-contract";

const REVENUE_HISTORY_DAYS = 90;
const REVENUE_TIME_ZONE = "Europe/Amsterdam";

type MollieAmount = {
  currency: string;
  value: string;
};

export type MollieRevenuePayment = {
  mode: string;
  status: string;
  paidAt?: string;
  amount: MollieAmount;
  amountRefunded?: MollieAmount;
  amountChargedBack?: MollieAmount;
};

export type MollieRevenue = {
  revenueToday: number;
  daily: DashboardTrendPoint[];
  paidPayments: number;
  unsupportedCurrencies: number;
};

function dateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REVENUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function cents(amount: MollieAmount | undefined): number {
  if (!amount || amount.currency !== "EUR") return 0;
  const value = Number(amount.value);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function buildMollieRevenue(
  payments: MollieRevenuePayment[],
  now = new Date()
): MollieRevenue {
  const today = dateKey(now);
  const firstDay = addDays(today, -(REVENUE_HISTORY_DAYS - 1));
  const revenueByDay = new Map<string, number>();
  let paidPayments = 0;
  let unsupportedCurrencies = 0;

  for (const payment of payments) {
    if (payment.mode !== "live" || payment.status !== "paid" || !payment.paidAt) continue;
    const paidDate = new Date(payment.paidAt);
    if (!Number.isFinite(paidDate.getTime())) continue;
    const day = dateKey(paidDate);
    if (day < firstDay || day > today) continue;
    if (payment.amount.currency !== "EUR") {
      unsupportedCurrencies += 1;
      continue;
    }
    const netCents = cents(payment.amount)
      - cents(payment.amountRefunded)
      - cents(payment.amountChargedBack);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + netCents);
    paidPayments += 1;
  }

  const daily = Array.from({ length: REVENUE_HISTORY_DAYS }, (_, index) => {
    const date = addDays(firstDay, index);
    return {
      date,
      sessions: 0,
      revenue: (revenueByDay.get(date) ?? 0) / 100,
      ...(date === today ? { partial: true } : {}),
    };
  });

  return {
    revenueToday: (revenueByDay.get(today) ?? 0) / 100,
    daily,
    paidPayments,
    unsupportedCurrencies,
  };
}
