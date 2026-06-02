const orderLists = [
  {
    id: "vaste-bestellijst",
    title: "Vaste bestellijst",
    description: "Producten die voor jouw zakelijke account zijn klaargezet.",
  },
  {
    id: "weekaanvulling",
    title: "Weekaanvulling",
    description: "Snel opnieuw bestellen voor vaste voorraadmomenten.",
  },
];

export default function BusinessOrderListsPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Bestellijsten</h1>
          <p>Bestel direct uit de producten die voor jouw account klaarstaan.</p>
        </div>

        <div className="list-grid">
          {orderLists.map((list) => (
            <a
              key={list.id}
              href={`/zakelijk/bestellijsten/${list.id}`}
              className="dashboard-card"
            >
              <h2>{list.title}</h2>
              <p>{list.description}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}