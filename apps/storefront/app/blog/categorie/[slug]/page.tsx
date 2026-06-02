const posts = [
  {
    title: "Waarom ongebrande noten populair zijn",
    href: "/blog/waarom-ongebrande-noten-populair-zijn",
  },
  {
    title: "Welke noten passen bij ontbijt?",
    href: "/blog/welke-noten-passen-bij-ontbijt",
  },
];

export default function BlogCategoryPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Noten</h1>
          <p>Artikelen over noten, kwaliteit, gebruik en bewaren.</p>
        </div>

        <div className="list-grid">
          {posts.map((post) => (
            <a key={post.href} href={post.href} className="dashboard-card">
              <h2>{post.title}</h2>
              <p>Lees artikel</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}