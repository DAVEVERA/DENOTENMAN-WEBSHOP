import { notFound } from "next/navigation";
import { sendInvoiceAction } from "../../../../actions/order.actions";
import { InvoicePrintButton } from "../../../../components/orders/InvoicePrintButton";
import { getInvoiceAddress, getInvoiceNumber } from "../../../../lib/invoices";
import { formatAdminDate, formatAdminMoney, getAdminOrder } from "../../../../lib/orders";

type AdminOrderInvoicePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    sent?: string;
  }>;
};

export default async function AdminOrderInvoicePage({ params, searchParams }: AdminOrderInvoicePageProps) {
  const { id } = await params;
  const query = await searchParams;
  const order = await getAdminOrder(id);

  if (!order) {
    notFound();
  }

  const address = getInvoiceAddress(order);
  const invoiceNumber = getInvoiceNumber(order);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Bestelling</p>
        <h1>Factuur {invoiceNumber}</h1>
        <span>Print of verzend een professioneel vormgegeven De Notenman factuur.</span>
      </section>

      {query?.sent === "1" ? <p className="admin-alert admin-alert--success">Factuur is verzonden.</p> : null}

      <section className="admin-actions invoice-actions">
        <InvoicePrintButton />
        <form action={sendInvoiceAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="admin-button admin-button--secondary" type="submit" disabled={!order.customerEmail}>
            Factuur verzenden
          </button>
        </form>
        <a className="admin-button admin-button--ghost" href={`/bestellingen/${order.id}`}>
          Terug naar bestelling
        </a>
      </section>

      <article className="invoice-document">
        <header className="invoice-document__header">
          <img src="/Notenman_onlylogo.png" alt="De Notenman" />
          <div>
            <p>Factuur</p>
            <h2>{invoiceNumber}</h2>
            <span>{formatAdminDate(order.createdAt)}</span>
          </div>
        </header>

        <section className="invoice-document__meta">
          <div>
            <h3>Gefactureerd aan</h3>
            <p><strong>{order.customerName ?? "Naam onbekend"}</strong></p>
            <p>{order.customerEmail ?? "E-mail onbekend"}</p>
            {address.length > 0 ? <p>{address.join(", ")}</p> : null}
          </div>

          <div>
            <h3>De Notenman</h3>
            <p>Ambachtelijke noten, zuidvruchten en natuurvoeding.</p>
            <p>Order: <strong>{order.orderNumber}</strong></p>
            <p>Status: {order.status} / {order.paymentStatus}</p>
          </div>
        </section>

        <section className="invoice-document__lines">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Aantal</th>
                <th>Prijs</th>
                <th>Totaal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.sku ? <span>SKU: {item.sku}</span> : null}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatAdminMoney(item.unitPriceCents)}</td>
                  <td>{formatAdminMoney(item.lineTotalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="invoice-document__totals">
          <div>
            <span>Subtotaal</span>
            <strong>{formatAdminMoney(order.subtotalCents)}</strong>
          </div>
          <div>
            <span>Verzending</span>
            <strong>{formatAdminMoney(order.shippingCents)}</strong>
          </div>
          <div>
            <span>BTW</span>
            <strong>{formatAdminMoney(order.taxCents)}</strong>
          </div>
          <div className="invoice-document__total">
            <span>Totaal</span>
            <strong>{formatAdminMoney(order.totalCents)}</strong>
          </div>
        </section>

        <footer className="invoice-document__footer">
          <p>Bedankt voor je bestelling bij De Notenman.</p>
          <span>Vers, zorgvuldig geselecteerd en met aandacht verpakt.</span>
        </footer>
      </article>
    </main>
  );
}
