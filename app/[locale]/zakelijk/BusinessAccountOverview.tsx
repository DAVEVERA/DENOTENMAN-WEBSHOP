function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-body-sm text-text">{value ?? "—"}</dd>
    </div>
  );
}

export function BusinessAccountOverview({
  companyName,
  contactName,
  customerNumber,
  email,
  phone,
  kvkNumber,
  vatNumber,
  peppolParticipantId,
  country,
}: {
  companyName: string;
  contactName: string;
  customerNumber: string | null;
  email: string;
  phone: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  peppolParticipantId: string | null;
  country: string;
}) {
  const isBelgian = country === "BE";
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Bedrijfsnaam" value={companyName} />
        <Field label="Klantnummer" value={customerNumber} />
        <Field label="Contactpersoon" value={contactName} />
        <Field label="E-mailadres" value={email} />
        <Field label="Telefoonnummer" value={phone} />
        <Field label="KvK-nummer" value={kvkNumber} />
        <Field label="BTW-nummer" value={vatNumber} />
        {isBelgian ? <Field label="Peppol-ID" value={peppolParticipantId} /> : null}
      </dl>
    </div>
  );
}
