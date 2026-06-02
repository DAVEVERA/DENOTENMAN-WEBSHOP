import { notFound } from "next/navigation";
import { saveBlogPostAction } from "../../../../actions/cms.actions";
import { getBlogPost } from "../../../../lib/content";

type BlogPostDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BlogPostDetailPage({ params }: BlogPostDetailPageProps) {
  const { id } = await params;
  const post = await getBlogPost(id);

  if (!post) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Blogartikel</p>
        <h1>{post.title}</h1>
        <span>Beheer titel, inhoud, categorie, publicatie en SEO.</span>
      </section>

      <form className="admin-form" action={saveBlogPostAction}>
        <input type="hidden" name="id" value={post.id} />
        <label>
          Titel
          <input type="text" name="title" defaultValue={post.title} />
        </label>

        <label>
          Slug
          <input type="text" name="slug" defaultValue={post.slug} />
        </label>

        <label>
          Categorie
          <input type="text" name="category" defaultValue={post.category ?? ""} />
        </label>

        <label>
          Inhoud
          <textarea name="content" defaultValue={post.content ?? ""} />
        </label>

        <label>
          Status
          <select name="status" defaultValue={post.status}>
            <option value="draft">Concept</option>
            <option value="published">Gepubliceerd</option>
          </select>
        </label>

        <button className="admin-button" type="submit">
          Artikel opslaan
        </button>
      </form>
    </main>
  );
}
