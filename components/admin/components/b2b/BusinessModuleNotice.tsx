import type { BusinessModuleStatus } from "../../lib/business";

export function BusinessModuleNotice({ status }: { status: BusinessModuleStatus }) {
  return (
    <section className="admin-card">
      <h2>{status.configured ? "Actief" : "Nog niet ingericht"}</h2>
      <p>{status.reason}</p>
    </section>
  );
}
