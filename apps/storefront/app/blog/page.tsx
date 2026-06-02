const posts = [
  {
    title: "Waarom ongebrande noten populair zijn",
    category: "Noten",
    href: "/blog/waarom-ongebrande-noten-populair-zijn",
  },
  {
    title: "Zakelijk noten bestellen",
    category: "Zakelijk",
    href: "/blog/zakelijk-noten-bestellen",
  },
];

export default function BlogPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Artikelen</h1>
          <p>Lees meer over noten, zaden, gedroogd fruit en zakelijk bestellen.</p>
        </div>

        <div className="list-grid">
          {posts.map((post) => (
            <a key={post.href} href={post.href} className="dashboard-card">
              <h2>{post.title}</h2>
              <p>{post.category}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}