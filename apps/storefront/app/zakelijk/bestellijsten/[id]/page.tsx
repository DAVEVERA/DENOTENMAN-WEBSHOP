import Link from "next/link";

const products = [
  {
    name: "Amandelen ongezouten",
    weight: "1 kg",
    price: "€ 14,95",
  },
  {
    name: "Cashewnoten gebrand",
    weight: "1 kg",
    price: "€ 16,95",
  },
  {
    name: "Notenmix luxe",
    weight: "1 kg",
    price: "€ 18,95",
  },
];

export default function BusinessOrderListDetailPage() {
  return (
    <main className="business-page">
      <section className="container orderlist-detail">
        <div>
          <h1>Vaste bestellijst</h1>
          <p>Controleer de producten en plaats direct je zakelijke bestelling.</p>
        </div>

        <div className="product-list">
          {products.map((product) => (
            <article key={product.name} className="product-row">
              <div>
                <h2>{product.name}</h2>
                <p>{product.weight}</p>
              </div>

              <strong>{product.price}</strong>

              <button className="button button--secondary" type="button">
                Toevoegen
              </button>
            </article>
          ))}
        </div>

        <Link href="/zakelijk/betalen/vaste-bestellijst" className="button button--primary">
          Bestelling afronden
        </Link>
      </section>
    </main>
  );
}
