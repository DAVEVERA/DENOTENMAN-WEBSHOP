export default function InventoryImportPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Voorraad</p>
        <h1>Voorraad importeren</h1>
        <span>Importeer voorraadstanden via CSV of handmatige upload.</span>
      </section>

      <form className="admin-form">
        <label>
          Importbestand
          <input type="file" name="file" accept=".csv" />
        </label>

        <label>
          Importmethode
          <select name="mode">
            <option>Voorraad overschrijven</option>
            <option>Voorraad optellen</option>
            <option>Alleen verschillen verwerken</option>
          </select>
        </label>

        <button className="admin-button" type="submit">
          Import starten
        </button>
      </form>
    </main>
  );
}