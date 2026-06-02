"use client";

export function InvoicePrintButton() {
  return (
    <button className="admin-button" type="button" onClick={() => window.print()}>
      Factuur printen
    </button>
  );
}
