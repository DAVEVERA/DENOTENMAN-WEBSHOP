import Link from "next/link";
import { listBlogPosts } from "../../../lib/content";

export default async function BlogPage() {
  const posts = await listBlogPosts();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>CMS</p>
        <h1>Blog</h1>
        <span>Beheer blogartikelen, categorieën en publicatiestatussen.</span>
      </section>

      <section className="admin-list">
        {posts.length === 0 ? <p>Geen blogartikelen gevonden.</p> : null}
        {posts.map((post) => (
          <Link key={post.id} href={`/cms/blog/${post.id}`} className="admin-list-row">
            <div>
              <h2>{post.title}</h2>
              <p>{post.category ?? "Geen categorie"}</p>
            </div>

            <strong>{post.status}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
