import "server-only";
import { listAdminOrders, listAdminPayments } from "./orders";
import { listAdminProducts, listInventoryItems } from "./products";

export async function getAdminDashboard() {
  const [orders, payments, products, inventory] = await Promise.all([
    listAdminOrders(100),
    listAdminPayments(100),
    listAdminProducts(),
    listInventoryItems(),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const ordersToday = orders.filter((order) => {
    if (!order.createdAt) return false;
    return new Date(order.createdAt) >= startOfToday;
  });

  const openPayments = payments.filter((payment) =>
    ["draft", "open", "pending", "authorized"].includes(payment.status),
  );
  const lowInventory = inventory.filter((item) => item.stockStatus !== "in_stock");
  const activeProducts = products.filter((product) => product.isActive);

  return {
    stats: [
      { label: "Bestellingen vandaag", value: String(ordersToday.length), href: "/bestellingen" },
      { label: "Open betalingen", value: String(openPayments.length), href: "/betalingen" },
      { label: "Lage voorraad", value: String(lowInventory.length), href: "/voorraad" },
      { label: "Actieve producten", value: String(activeProducts.length), href: "/producten" },
    ],
    recentOrders: orders.slice(0, 6),
    openPayments: openPayments.slice(0, 6),
    lowInventory: lowInventory.slice(0, 6),
  };
}
