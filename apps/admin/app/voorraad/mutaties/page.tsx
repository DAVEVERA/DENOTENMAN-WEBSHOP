export default function InventoryMutationsPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Voorraad</p>
        <h1>Mutaties</h1>
        <span>Voorraadmutaties vereisen een echte inventory ledger tabel. Er worden geen voorbeeldmutaties getoond.</span>
      </section>

      <section className="admin-card">
        <h2>Nog niet ingericht</h2>
        <p>Maak een inventory_mutations tabel met product, variant, wijziging, reden en admin-user voordat dit live wordt.</p>
      </section>
    </main>
  );
}
