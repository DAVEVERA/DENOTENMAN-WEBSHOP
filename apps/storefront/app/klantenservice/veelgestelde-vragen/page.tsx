const faqs = [
  {
    question: "Wanneer wordt mijn bestelling verzonden?",
    answer: "Bestellingen worden zo snel mogelijk verwerkt en verzonden.",
  },
  {
    question: "Kan ik zakelijk bestellen?",
    answer: "Ja, zakelijke klanten hebben een eigen bestelomgeving.",
  },
  {
    question: "Waar vind ik mijn factuur?",
    answer: "Facturen staan in je account of zakelijke omgeving.",
  },
];

export default function FaqPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Veelgestelde vragen</h1>
          <p>Antwoorden op veelgestelde vragen over bestellen, betalen en verzenden.</p>
        </div>

        <div className="product-list">
          {faqs.map((faq) => (
            <article key={faq.question} className="dashboard-card">
              <h2>{faq.question}</h2>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}