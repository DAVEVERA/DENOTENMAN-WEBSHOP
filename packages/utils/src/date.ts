const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

export function formatDateNL(d: Date | string): string {
  return dateFormatter.format(toDate(d));
}

export function formatDateTimeNL(d: Date | string): string {
  return dateTimeFormatter.format(toDate(d));
}
