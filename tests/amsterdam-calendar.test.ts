import assert from "node:assert/strict";
import test from "node:test";
import {
  AMSTERDAM_TIME_ZONE,
  amsterdamCalendarWeekday,
  formatAmsterdamCalendarDate,
  formatAmsterdamDate,
  formatAmsterdamDateTime,
  parseAmsterdamCalendarDay,
  shiftAmsterdamCalendarDate,
} from "../lib/amsterdam-calendar";

const numericDateTime = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} satisfies Intl.DateTimeFormatOptions;

test("formats order and invoice dates in Europe/Amsterdam instead of the host timezone", () => {
  assert.equal(AMSTERDAM_TIME_ZONE, "Europe/Amsterdam");
  assert.equal(
    formatAmsterdamDate(new Date("2026-03-28T23:30:00.000Z")),
    "29 maart 2026"
  );
  assert.equal(
    formatAmsterdamDate(new Date("2026-10-24T22:30:00.000Z")),
    "25 oktober 2026"
  );
  assert.equal(
    formatAmsterdamCalendarDate(new Date("2026-03-28T23:30:00.000Z")),
    "2026-03-29"
  );
  assert.equal(
    shiftAmsterdamCalendarDate(new Date("2026-10-25T23:30:00.000Z"), -1),
    "2026-10-25"
  );
  assert.equal(amsterdamCalendarWeekday(new Date("2026-10-25T23:30:00.000Z")), 1);
});

test("formats instants deterministically across the spring DST jump", () => {
  assert.equal(
    formatAmsterdamDateTime(new Date("2026-03-29T00:30:00.000Z"), "nl-NL", numericDateTime),
    "29-03-2026, 01:30"
  );
  assert.equal(
    formatAmsterdamDateTime(new Date("2026-03-29T01:30:00.000Z"), "nl-NL", numericDateTime),
    "29-03-2026, 03:30"
  );
});

test("Amsterdam calendar-day bounds cover the 23-hour and 25-hour DST days", () => {
  assert.equal(
    parseAmsterdamCalendarDay("2026-03-29", false)?.toISOString(),
    "2026-03-28T23:00:00.000Z"
  );
  assert.equal(
    parseAmsterdamCalendarDay("2026-03-29", true)?.toISOString(),
    "2026-03-29T21:59:59.999Z"
  );
  assert.equal(
    parseAmsterdamCalendarDay("2026-10-25", false)?.toISOString(),
    "2026-10-24T22:00:00.000Z"
  );
  assert.equal(
    parseAmsterdamCalendarDay("2026-10-25", true)?.toISOString(),
    "2026-10-25T22:59:59.999Z"
  );
});
