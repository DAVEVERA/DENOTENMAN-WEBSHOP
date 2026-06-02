const cards = [
  {
    title: "Zakelijke klanten",
    text: "Bedrijven, contactpersonen, factuurgegevens en klantafspraken.",
    href: "/zakelijk/klanten",
  },
  {
    title: "Bestellijsten",
    text: "Zet producten klaar zodat zakelijke klanten direct kunnen bestellen en betalen.",
    href: "/zakelijk/bestellijsten",
  },
  {
    title: "Facturen",
    text: "Bekijk facturen, betalingsstatussen en gekoppelde bestellingen.",
    href: "/zakelijk/facturen",
  },
  {
    title: "Prijzen",
    text: "Beheer klantprijzen, prijsafspraken en staffels.",
    href: "/zakelijk/prijzen",
  },
];

const actions = [
  {
    label: "Nieuwe zakelijke klant",
    href: "/zakelijk/klanten/nieuw",
  },
  {
    label: "Nieuw account",
    href: "/zakelijk/accounts/nieuw",
  },
  {
    label: "Nieuwe bestellijst",
    href: "/zakelijk/bestellijsten/nieuw",
  },
];

export default function BusinessDashboardPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Zakelijke bestelomgeving</h1>
        <span>
          Beheer zakelijke klanten, accounts, bestellijsten, facturen, offertes,
          staffelprijzen en assortimenten.
        </span>
      </section>

      <section className="admin-actions">
        {actions.map((action) => (
          <a key={action.href} href={action.href} className="admin-button">
            {action.label}
          </a>
        ))}
      </section>

      <section className="admin-grid">
        {cards.map((card) => (
          <a key={card.href} href={card.href} className="admin-card admin-link-card">
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </a>
        ))}
      </section>
    </main>
  );
}