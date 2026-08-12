import { notFound } from "next/navigation";
import { updateOrderStatusAction } from "../../../actions/order.actions";
import {
  formatAdminDate,
  formatAdminMoney,
  getAdminOrder,
} from "../../../lib/orders";

type AdminOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const orderStatuses = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Betaald" },
  { value: "processing", label: "In verwerking" },
  { value: "shipped", label: "Verzonden" },
  { value: "cancelled", label: "Geannuleerd" },
];

const paymentStatuses = [
  "draft",
  "open",
  "pending",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
];

function getCheckoutText(state: Record<string, unknown>, key: string) {
  const value = state[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { id } = await params;
  const order = await getAdminOrder(id);

  if (!order) {
    notFound();
  }

  const address = [
    getCheckoutText(order.checkoutState, "street"),
    getCheckoutText(order.checkoutState, "houseNumber"),
    getCheckoutText(order.checkoutState, "postalCode"),
    getCheckoutText(order.checkoutState, "city"),
  ].filter(Boolean);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Bestelling</p>
        <h1>{order.orderNumber}</h1>
        <span>Beheer klantgegevens, orderregels, betaling en orderstatus.</span>
      </section>

      <section className="admin-actions">
        <a className="admin-button admin-button--secondary" href={`/bestellingen/${order.id}/verzending`}>
          Verzending
        </a>
        <a className="admin-button admin-button--secondary" href={`/bestellingen/${order.id}/factuur`}>
          Factuur
        </a>
        <a className="admin-button admin-button--secondary" href={`/bestellingen/${order.id}/retour`}>
          Retour
        </a>
      </section>

      <section className="admin-grid admin-grid--two">
        <article className="admin-card">
          <h2>Klant</h2>
          <p>{order.customerName ?? "Naam onbekend"}</p>
          <p>{order.customerEmail ?? "E-mail onbekend"}</p>
          {address.length > 0 ? <p>{address.join(", ")}</p> : null}
        </article>

        <article className="admin-card">
          <h2>Status</h2>
          <p>Order: {order.status}</p>
          <p>Betaling: {order.paymentStatus}</p>
          <p>Aangemaakt: {formatAdminDate(order.createdAt)}</p>
        </article>

        <article className="admin-card">
          <h2>Totalen</h2>
          <p>Subtotaal: {formatAdminMoney(order.subtotalCents)}</p>
          <p>Verzending: {formatAdminMoney(order.shippingCents)}</p>
          <p>BTW: {formatAdminMoney(order.taxCents)}</p>
          <p><strong>Totaal: {formatAdminMoney(order.totalCents)}</strong></p>
        </article>

        <article className="admin-card">
          <h2>Status wijzigen</h2>
          <form className="admin-form admin-form--compact" action={updateOrderStatusAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <label>
              Orderstatus
              <select name="status" defaultValue={order.status}>
                {orderStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Betaalstatus
              <select name="paymentStatus" defaultValue={order.paymentStatus}>
                {paymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="admin-button" type="submit">
              Status opslaan
            </button>
          </form>
        </article>
      </section>

      <section className="admin-section">
        <h2>Orderregels</h2>
        <div className="admin-list">
          {order.items.length === 0 ? <p>Geen orderregels gevonden.</p> : null}
          {order.items.map((item) => (
            <article key={item.id} className="admin-list-row">
              <div className="admin-product-summary">
                {item.image ? <img src={item.image} alt="" /> : null}
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.quantity} x {formatAdminMoney(item.unitPriceCents)}</p>
                  {item.sku ? <p>SKU: {item.sku}</p> : null}
                </div>
              </div>
              <span>{formatAdminMoney(item.lineTotalCents)}</span>
              <strong>{item.quantity} st.</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Betalingen</h2>
        <div className="admin-list">
          {order.payments.length === 0 ? <p>Geen betalingen gekoppeld.</p> : null}
          {order.payments.map((payment) => (
            <article key={payment.id} className="admin-list-row">
              <div>
                <h2>{payment.provider}</h2>
                <p>{payment.providerPaymentId ?? "Nog geen provider payment id"}</p>
                <p>{formatAdminDate(payment.updatedAt ?? payment.createdAt)}</p>
              </div>
              <span>{formatAdminMoney(payment.amountCents)}</span>
              <strong>{payment.status}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
