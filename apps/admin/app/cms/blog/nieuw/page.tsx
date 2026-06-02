import { saveBlogPostAction } from "../../../../actions/cms.actions";

export default function NewBlogPostPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Blog</p>
        <h1>Nieuw artikel</h1>
        <span>Schrijf een nieuw blogartikel voor de webshop.</span>
      </section>

      <form className="admin-form" action={saveBlogPostAction}>
        <label>
          Titel
          <input type="text" name="title" placeholder="Titel van het artikel" />
        </label>

        <label>
          Categorie
          <select name="category">
            <option>Noten</option>
            <option>Zakelijk</option>
            <option>Recepten</option>
            <option>Gezondheid</option>
          </select>
        </label>

        <label>
          Inhoud
          <textarea name="content" placeholder="Artikelinhoud" />
        </label>

        <label>
          Status
          <select name="status" defaultValue="draft">
            <option value="draft">Concept</option>
            <option value="published">Gepubliceerd</option>
          </select>
        </label>

        <button className="admin-button" type="submit">
          Artikel aanmaken
        </button>
      </form>
    </main>
  );
}
