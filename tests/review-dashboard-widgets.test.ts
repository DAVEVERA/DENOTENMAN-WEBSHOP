import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_DASHBOARD_ANALYTICS, type DashboardAnalytics } from "../lib/admin-dashboard-contract";
import { buildWidgetView, widgetDeepLink, type WidgetContext } from "../lib/dashboard/adapter";
import { BUILTIN_WIDGETS, materializeBuiltin } from "../lib/dashboard/defaults";
import { getDashboardSource } from "../lib/dashboard/sources";
import type { DashboardWidgetConfig } from "../lib/dashboard/schema";

const REVIEW_SOURCES = ["google_rating", "review_mails_sent", "review_mails_pending"] as const;
const WORKLIST = "/admin/marketing/reviews";

const widgetById = (id: string): DashboardWidgetConfig => {
  const builtin = BUILTIN_WIDGETS.find((item) => item.id === id);
  assert.ok(builtin, `built-in ${id} exists`);
  return materializeBuiltin(builtin);
};

const analytics: DashboardAnalytics = { ...EMPTY_DASHBOARD_ANALYTICS, status: "live", message: "" };

function contextWith(reviews: WidgetContext["reviews"]): WidgetContext {
  return {
    analytics,
    commerce: { activeProducts: 1, categories: 1, totalOrders: 1, pendingOrders: 0 },
    recentOrdersCount: 0,
    reviews,
  };
}

const measured = contextWith({ rating: 4.7, reviewCount: 128, mailsSent: 24, pending: 9 });
const unmeasured = contextWith({ rating: null, reviewCount: null, mailsSent: 0, pending: 0 });

test("the three review widgets are registered as dashboard sources", () => {
  for (const id of REVIEW_SOURCES) {
    assert.ok(getDashboardSource(id), `${id} is not registered`);
  }
});

test("every review widget links through to the worklist", () => {
  for (const id of REVIEW_SOURCES) {
    assert.equal(getDashboardSource(id)?.deepLink, WORKLIST, `${id} has no deep link`);
  }
});

test("the three review widgets ship as built-ins", () => {
  const sources = new Map(BUILTIN_WIDGETS.map((widget) => [widget.id, widget.source]));
  assert.equal(sources.get("google-rating"), "google_rating");
  assert.equal(sources.get("review-mails-sent"), "review_mails_sent");
  assert.equal(sources.get("review-mails-pending"), "review_mails_pending");
});

test("a measured rating reaches the widget as a decimal", () => {
  const view = buildWidgetView(widgetById("google-rating"), measured);
  assert.equal(view.kind, "kpi");
  assert.equal(view.kind === "kpi" && view.value, 4.7);
  assert.equal(view.kind === "kpi" && view.format, "decimal");
});

test("the rating widget shows nothing rather than a zero when it has never been measured", () => {
  const view = buildWidgetView(widgetById("google-rating"), unmeasured);
  assert.equal(view.kind, "kpi");
  assert.equal(view.kind === "kpi" && view.value, null);
});

test("the review mail counters read their own numbers", () => {
  const sent = buildWidgetView(widgetById("review-mails-sent"), measured);
  const pending = buildWidgetView(widgetById("review-mails-pending"), measured);
  assert.equal(sent.kind === "kpi" && sent.value, 24);
  assert.equal(pending.kind === "kpi" && pending.value, 9);
});

test("an empty worklist is a real zero, not a missing measurement", () => {
  const pending = buildWidgetView(widgetById("review-mails-pending"), unmeasured);
  assert.equal(pending.kind === "kpi" && pending.value, 0);
});

test("clicking a review widget goes to the worklist", () => {
  for (const id of ["google-rating", "review-mails-sent", "review-mails-pending"]) {
    assert.equal(widgetDeepLink(widgetById(id)), WORKLIST, `${id} does not link to the worklist`);
  }
});
