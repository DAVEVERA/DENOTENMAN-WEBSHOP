const reviews = [
  {
    name: "Jan",
    rating: "5/5",
    text: "Goede kwaliteit en snel geleverd.",
  },
  {
    name: "Sanne",
    rating: "4/5",
    text: "Vers en netjes verpakt.",
  },
];

export function ProductReviews() {
  return (
    <section className="product-reviews">
      <h2>Reviews</h2>

      <div className="product-list">
        {reviews.map((review) => (
          <article key={review.name} className="dashboard-card">
            <h3>{review.name}</h3>
            <strong>{review.rating}</strong>
            <p>{review.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}