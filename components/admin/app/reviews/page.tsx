import { listAdminReviews } from "../../lib/reviews";

export default async function ReviewsPage() {
  const reviews = await listAdminReviews();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Reviews</p>
        <h1>Reviewbeheer</h1>
        <span>Reviews worden pas getoond zodra echte review-opslag is gekoppeld.</span>
      </section>

      <section className="admin-list">
        {reviews.length === 0 ? <p>Geen reviews gevonden.</p> : null}
        {reviews.map((review) => (
          <article key={review.id} className="admin-list-row">
            <div>
              <h2>{review.title}</h2>
              <p>{review.customer}</p>
            </div>
            <span>{review.rating}/5</span>
            <strong>{review.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
