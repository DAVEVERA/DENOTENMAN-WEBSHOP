import Link from "next/link";
import { listCmsPages } from "../../../lib/content";

export default async function CmsPagesPage() {
  const pages = await listCmsPages();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>CMS</p>
        <h1>Pagina’s</h1>
        <span>Beheer vaste pagina’s, juridische content en SEO-inhoud.</span>
      </section>

      <section className="admin-list">
        {pages.length === 0 ? <p>Geen CMS-pagina&apos;s gevonden.</p> : null}
        {pages.map((page) => (
          <Link key={page.id} href={`/cms/paginas/${page.id}`} className="admin-list-row">
            <div>
              <h2>{page.title}</h2>
              <p>{page.slug}</p>
            </div>

            <strong>{page.status}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
