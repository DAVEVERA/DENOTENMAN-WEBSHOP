const settingsLinks = [
  {
    title: "Algemeen",
    href: "/instellingen/algemeen",
    description: "Webshopnaam, contactgegevens en basisinstellingen.",
  },
  {
    title: "Btw",
    href: "/instellingen/btw",
    description: "Btw-tarieven en fiscale instellingen.",
  },
  {
    title: "Verzending",
    href: "/instellingen/verzending",
    description: "Verzendmethoden, tarieven en drempels.",
  },
  {
    title: "Betalingen",
    href: "/instellingen/betalingen",
    description: "Betaalmethoden en Mollie-instellingen.",
  },
  {
    title: "E-mail",
    href: "/instellingen/e-mail",
    description: "Afzenders en transactionele e-mailinstellingen.",
  },
  {
    title: "Gebruikers",
    href: "/instellingen/gebruikers",
    description: "Beheerders, rollen en toegang.",
  },
  {
    title: "Rollen",
    href: "/instellingen/rollen",
    description: "Rechtenprofielen voor admin gebruikers.",
  },
];

export default function SettingsPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Beheer</p>
        <h1>Instellingen</h1>
        <span>Configureer de webshop, betalingen, verzending en gebruikers.</span>
      </section>

      <section className="admin-grid" aria-label="Instellingen">
        {settingsLinks.map((link) => (
          <a key={link.href} className="admin-card admin-link-card" href={link.href}>
            <h2>{link.title}</h2>
            <p>{link.description}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
