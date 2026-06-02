import { notFound } from "next/navigation";
import { formatAdminDate, getAdminOrder } from "../../../../lib/orders";

type AdminOrderShippingPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getText(state: Record<string, unknown>, key: string) {
  const value = state[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function AdminOrderShippingPage({ params }: AdminOrderShippingPageProps) {
  const { id } = await params;
  const order = await getAdminOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Bestelling</p>
        <h1>Verzending {order.orderNumber}</h1>
        <span>Verzendinformatie uit de checkout. PostNL-labelgeneratie is nog niet live gekoppeld.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Verzendmethode</h2>
          <p>{getText(order.checkoutState, "shippingMethodId") ?? "Niet gekozen"}</p>
        </article>

        <article className="admin-card">
          <h2>Adres</h2>
          <p>
            {[getText(order.checkoutState, "street"), getText(order.checkoutState, "houseNumber")]
              .filter(Boolean)
              .join(" ") || "Adres onbekend"}
          </p>
          <p>
            {[getText(order.checkoutState, "postalCode"), getText(order.checkoutState, "city")]
              .filter(Boolean)
              .join(" ") || "Plaats onbekend"}
          </p>
        </article>

        <article className="admin-card">
          <h2>Status</h2>
          <p>Orderstatus: {order.status}</p>
          <p>Aangemaakt: {formatAdminDate(order.createdAt)}</p>
        </article>
      </section>

      <section className="admin-section">
        <a className="admin-button admin-button--secondary" href={`/bestellingen/${order.id}`}>
          Terug naar bestelling
        </a>
      </section>
    </main>
  );
}
