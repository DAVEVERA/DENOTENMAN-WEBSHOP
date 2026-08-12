import "server-only";
import { listAdminOrders } from "./orders";

export type AdminCustomerSummary = {
  id: string;
  email: string;
  name: string;
  orderCount: number;
  totalCents: number;
  latestOrderAt: string | null;
};

export async function listAdminCustomers(): Promise<AdminCustomerSummary[]> {
  const orders = await listAdminOrders(500);
  const customers = new Map<string, AdminCustomerSummary>();

  for (const order of orders) {
    if (!order.customerEmail) continue;

    const email = order.customerEmail.toLowerCase();
    const current =
      customers.get(email) ??
      ({
        id: encodeURIComponent(email),
        email,
        name: order.customerName ?? order.customerEmail,
        orderCount: 0,
        totalCents: 0,
        latestOrderAt: null,
      } satisfies AdminCustomerSummary);

    current.orderCount += 1;
    current.totalCents += order.totalCents;

    if (
      order.createdAt &&
      (!current.latestOrderAt || new Date(order.createdAt) > new Date(current.latestOrderAt))
    ) {
      current.latestOrderAt = order.createdAt;
    }

    customers.set(email, current);
  }

  return Array.from(customers.values()).sort((left, right) =>
    (right.latestOrderAt ?? "").localeCompare(left.latestOrderAt ?? ""),
  );
}

export async function getAdminCustomer(id: string) {
  const email = decodeURIComponent(id).toLowerCase();
  const [customers, orders] = await Promise.all([listAdminCustomers(), listAdminOrders(500)]);
  const customer = customers.find((item) => item.email === email) ?? null;

  if (!customer) return null;

  return {
    ...customer,
    orders: orders.filter((order) => order.customerEmail?.toLowerCase() === email),
  };
}
