const AMSTERDAM_TIME_ZONE = "Europe/Amsterdam";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AMSTERDAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function timeZoneOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(partsFormatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function parseAmsterdamCalendarDay(value: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const calendarProbe = new Date(Date.UTC(year, month - 1, day, 12));
  if (calendarProbe.getUTCFullYear() !== year || calendarProbe.getUTCMonth() !== month - 1 || calendarProbe.getUTCDate() !== day) return null;

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let instant = new Date(localAsUtc - timeZoneOffsetMs(new Date(localAsUtc)));
  const correctedOffset = timeZoneOffsetMs(instant);
  instant = new Date(localAsUtc - correctedOffset);
  return instant;
}
