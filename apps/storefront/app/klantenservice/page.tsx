const links = [
  { title: "Contact", href: "/klantenservice/contact" },
  { title: "Verzenden", href: "/klantenservice/verzenden" },
  { title: "Retourneren", href: "/klantenservice/retourneren" },
  { title: "Betalen", href: "/klantenservice/betalen" },
  { title: "Veelgestelde vragen", href: "/klantenservice/veelgestelde-vragen" },
];

export default function CustomerServicePage() {
  return (
    <main className="business-page">
      <section className="container dashboard-page">
        <div>
          <h1>Waarmee kunnen we helpen?</h1>
          <p>Vind snel informatie over contact, verzending, retouren en betalen.</p>
        </div>

        <div className="dashboard-grid">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="dashboard-card">
              <h2>{link.title}</h2>
              <p>Bekijk informatie.</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}