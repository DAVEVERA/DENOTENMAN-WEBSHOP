export function nextPriceReportRun(
  now: Date,
  input: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    hourLocal: number;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
  }
): Date {
  const local = amsterdamParts(now);
  const calendar = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (input.frequency === "DAILY") {
    let candidate = amsterdamLocalToUtc(local.year, local.month, local.day, input.hourLocal);
    if (candidate <= now) {
      calendar.setUTCDate(calendar.getUTCDate() + 1);
      candidate = amsterdamLocalToUtc(
        calendar.getUTCFullYear(),
        calendar.getUTCMonth() + 1,
        calendar.getUTCDate(),
        input.hourLocal
      );
    }
    return candidate;
  }
  if (input.frequency === "WEEKLY") {
    const wanted = Math.max(1, Math.min(7, input.dayOfWeek || 1));
    const current = calendar.getUTCDay() === 0 ? 7 : calendar.getUTCDay();
    let add = (wanted - current + 7) % 7;
    calendar.setUTCDate(calendar.getUTCDate() + add);
    let candidate = amsterdamLocalToUtc(
      calendar.getUTCFullYear(),
      calendar.getUTCMonth() + 1,
      calendar.getUTCDate(),
      input.hourLocal
    );
    if (candidate <= now) {
      add = 7;
      calendar.setUTCDate(calendar.getUTCDate() + add);
      candidate = amsterdamLocalToUtc(
        calendar.getUTCFullYear(),
        calendar.getUTCMonth() + 1,
        calendar.getUTCDate(),
        input.hourLocal
      );
    }
    return candidate;
  }

  const wantedDay = Math.max(1, Math.min(28, input.dayOfMonth || 1));
  let candidate = amsterdamLocalToUtc(local.year, local.month, wantedDay, input.hourLocal);
  if (candidate <= now) {
    const nextMonth = new Date(Date.UTC(local.year, local.month, wantedDay));
    candidate = amsterdamLocalToUtc(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth() + 1,
      wantedDay,
      input.hourLocal
    );
  }
  return candidate;
}

function amsterdamParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour") };
}

function amsterdamLocalToUtc(year: number, month: number, day: number, hour: number): Date {
  const desired = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let candidate = new Date(desired);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const rendered = amsterdamParts(candidate);
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      0,
      0,
      0
    );
    const offset = renderedAsUtc - candidate.getTime();
    candidate = new Date(desired - offset);
  }
  return candidate;
}
