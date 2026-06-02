const products = [
  { name: "Amandelen ongezouten", price: "€ 14,95", href: "/winkel/amandelen-ongezouten" },
  { name: "Notenmix luxe", price: "€ 18,95", href: "/winkel/notenmix-luxe" },
];

export default function WishlistPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Verlanglijst</h1>
          <p>Bekijk je bewaarde producten.</p>
        </div>

        <div className="list-grid">
          {products.map((product) => (
            <a key={product.name} href={product.href} className="dashboard-card">
              <h2>{product.name}</h2>
              <p>{product.price}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}