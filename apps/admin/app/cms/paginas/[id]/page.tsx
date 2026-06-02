import { notFound } from "next/navigation";
import { saveCmsPageAction } from "../../../../actions/cms.actions";
import { getCmsPage } from "../../../../lib/content";

type CmsPageDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CmsPageDetailPage({ params }: CmsPageDetailPageProps) {
  const { id } = await params;
  const page = await getCmsPage(id);

  if (!page) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>CMS pagina</p>
        <h1>{page.title}</h1>
        <span>Beheer titel, slug, inhoud, status en SEO.</span>
      </section>

      <form className="admin-form" action={saveCmsPageAction}>
        <input type="hidden" name="id" value={page.id} />
        <label>
          Titel
          <input type="text" name="title" defaultValue={page.title} />
        </label>

        <label>
          Slug
          <input type="text" name="slug" defaultValue={page.slug} />
        </label>

        <label>
          Inhoud
          <textarea name="content" defaultValue={page.content ?? ""} />
        </label>

        <label>
          Status
          <select name="status" defaultValue={page.status}>
            <option value="draft">Concept</option>
            <option value="published">Gepubliceerd</option>
          </select>
        </label>

        <button className="admin-button" type="submit">
          Pagina opslaan
        </button>
      </form>
    </main>
  );
}
