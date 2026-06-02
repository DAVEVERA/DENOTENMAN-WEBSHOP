import { notFound } from "next/navigation";
import { getAdminOrder } from "../../../../lib/orders";

type AdminOrderReturnPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminOrderReturnPage({ params }: AdminOrderReturnPageProps) {
  const { id } = await params;
  const order = await getAdminOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Bestelling</p>
        <h1>Retour {order.orderNumber}</h1>
        <span>Retourinformatie op basis van echte orderregels. Retourlabels zijn nog niet live gekoppeld.</span>
      </section>

      <section className="admin-list">
        {order.items.map((item) => (
          <article key={item.id} className="admin-list-row">
            <div>
              <h2>{item.name}</h2>
              <p>Besteld: {item.quantity} stuks</p>
            </div>
            <span>{item.sku ?? "Geen SKU"}</span>
            <strong>Retour mogelijk</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
