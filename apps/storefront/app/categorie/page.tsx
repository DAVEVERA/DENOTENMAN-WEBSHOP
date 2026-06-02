const brands = [
  { name: "De Notenman", text: "Eigen selectie en verpakking.", href: "/merken/de-notenman" },
  { name: "Ambachtelijk", text: "Zorgvuldig geselecteerde producten.", href: "/merken/ambachtelijk" },
];

export default function BrandsPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Merken</h1>
          <p>Bekijk merken en productlijnen binnen de webshop.</p>
        </div>

        <div className="list-grid">
          {brands.map((brand) => (
            <a key={brand.name} href={brand.href} className="dashboard-card">
              <h2>{brand.name}</h2>
              <p>{brand.text}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}