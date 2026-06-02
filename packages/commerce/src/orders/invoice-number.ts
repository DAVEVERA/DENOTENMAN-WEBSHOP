export function createInvoiceNumber(date = new Date(), sequence = 1) {
  return `F-${date.getFullYear()}-${String(sequence).padStart(5, "0")}`;
}
