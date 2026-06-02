import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessCustomer } from "../../../../lib/business";

type AdminBusinessCustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminBusinessCustomerDetailPage({
  params,
}: AdminBusinessCustomerDetailPageProps) {
  const { id } = await params;
  const customer = await getBusinessCustomer(id);

  if (!customer) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijke klant</p>
        <h1>{customer.company}</h1>
        <span>Bekijk bedrijfsgegevens, contactpersoon, factuurgegevens en toegang.</span>
      </section>

      <section className="admin-actions">
        <Link className="admin-button admin-button--secondary" href="/zakelijk/klanten">
          Terug naar klanten
        </Link>
      </section>

      <section className="admin-grid admin-grid--two">
        <article className="admin-card">
          <h2>Bedrijf</h2>
          <p>Naam: {customer.company}</p>
          <p>Status: {customer.status}</p>
          <p>KVK: {customer.kvkNumber ?? "Niet ingevuld"}</p>
          <p>BTW: {customer.vatNumber ?? "Niet ingevuld"}</p>
          <p>Op rekening: {customer.paymentOnAccount ? "Ja" : "Nee"}</p>
        </article>

        <article className="admin-card">
          <h2>Contact</h2>
          <p>{customer.contactName ?? "Geen contactpersoon"}</p>
          <p>{customer.email}</p>
          {customer.phone ? <p>{customer.phone}</p> : null}
        </article>

        <article className="admin-card">
          <h2>Factuuradres</h2>
          <p>{customer.invoiceAddress ?? "Geen factuuradres ingevuld."}</p>
        </article>

        <article className="admin-card">
          <h2>Leveradres</h2>
          <p>{customer.shippingAddress ?? "Gelijk aan factuuradres of niet ingevuld."}</p>
        </article>

        <article className="admin-card">
          <h2>Opmerking</h2>
          <p>{customer.notes ?? "Geen opmerkingen."}</p>
        </article>
      </section>
    </main>
  );
}
