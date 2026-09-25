import assert from "node:assert/strict";
import test from "node:test";
import {
  bannerCalendarEvents,
  buildMonthGrid,
  campaignCalendarEvents,
  newsletterCalendarEvents,
} from "../lib/marketing-calendar";

test("campaignCalendarEvents emits a start and end marker only when the date exists", () => {
  const events = campaignCalendarEvents([
    { id: "c1", title: "Paasactie", startsAt: new Date("2026-04-01"), endsAt: new Date("2026-04-10") },
    { id: "c2", title: "Doorlopend", startsAt: new Date("2026-04-05"), endsAt: null },
  ]);

  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => [event.id, event.label]),
    [
      ["actie-c1-start", "Start actie"],
      ["actie-c1-end", "Einde actie"],
      ["actie-c2-start", "Start actie"],
    ]
  );
  assert.ok(events.every((event) => event.type === "actie" && event.href === "/admin/marketing/acties"));
});

test("bannerCalendarEvents mirrors campaign behavior for banners", () => {
  const events = bannerCalendarEvents([
    { id: "b1", title: "Homepage banner", startsAt: new Date("2026-04-01"), endsAt: null },
  ]);

  assert.deepEqual(events, [
    {
      id: "banner-b1-start",
      type: "banner",
      label: "Start banner",
      title: "Homepage banner",
      date: new Date("2026-04-01"),
      href: "/admin/marketing/banners",
    },
  ]);
});

test("newsletterCalendarEvents skips campaigns without a send date and labels sent vs scheduled", () => {
  const events = newsletterCalendarEvents([
    { id: "n1", subject: "Concept", status: "save", sendTime: null },
    { id: "n2", subject: "Ingepland", status: "schedule", sendTime: "2026-04-12T09:00:00.000Z" },
    { id: "n3", subject: "Verzonden", status: "sent", sendTime: "2026-04-02T09:00:00.000Z" },
  ]);

  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => [event.id, event.label, event.href]),
    [
      ["nieuwsbrief-n2", "Ingepland", "/admin/marketing/nieuwsbrieven/n2"],
      ["nieuwsbrief-n3", "Verzonden", "/admin/marketing/nieuwsbrieven/n3"],
    ]
  );
});

test("buildMonthGrid produces full Monday-first weeks covering the whole month", () => {
  const days = buildMonthGrid(new Date(2026, 3, 1), []); // April 2026

  assert.equal(days.length % 7, 0);
  assert.equal(days[0].date.getDay(), 1); // Monday
  assert.ok(days.some((day) => day.inMonth && day.date.getDate() === 1 && day.date.getMonth() === 3));
  assert.ok(days.some((day) => day.inMonth && day.date.getDate() === 30 && day.date.getMonth() === 3));
});

test("buildMonthGrid groups events onto their calendar day", () => {
  const days = buildMonthGrid(new Date(2026, 3, 1), [
    {
      id: "actie-c1-start",
      type: "actie",
      label: "Start actie",
      title: "Paasactie",
      date: new Date(2026, 3, 5),
      href: "/admin/marketing/acties",
    },
  ]);

  const day = days.find((entry) => entry.inMonth && entry.date.getDate() === 5);
  assert.ok(day);
  assert.equal(day?.events.length, 1);
  assert.equal(day?.events[0]?.title, "Paasactie");
});
