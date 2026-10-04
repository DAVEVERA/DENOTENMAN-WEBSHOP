import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AdminDashboardWorkspace } from "../components/admin-panel/AdminDashboardWorkspace";
import { EMPTY_DASHBOARD_ANALYTICS } from "../lib/admin-dashboard-contract";

const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

const props: ComponentProps<typeof AdminDashboardWorkspace> = {
  commerce: {
    activeProducts: 1,
    categories: 1,
    totalOrders: 1,
    pendingOrders: 1,
  },
  initialAnalytics: {
    ...EMPTY_DASHBOARD_ANALYTICS,
    generatedAt: "2026-10-04T23:30:00.000Z",
  },
  recentOrders: [{
    id: "order-418",
    orderNumber: "DN-2026-00418",
    contactName: "Hydration Test",
    status: "PENDING",
    createdAt: "2026-10-04T23:30:00.000Z",
    total: "€ 4,18",
  }],
};

function renderInitialDashboard(timeZone: string): string {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return renderToString(
      <AppRouterContext.Provider value={router}>
        <AdminDashboardWorkspace {...props} />
      </AppRouterContext.Provider>
    );
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
}

test("admin dashboard first render is deterministic across server and browser time zones", () => {
  const serverMarkup = renderInitialDashboard("UTC");
  const browserMarkup = renderInitialDashboard("Europe/Amsterdam");

  assert.equal(browserMarkup, serverMarkup);
  assert.match(serverMarkup, /aria-label="Dashboardindeling laden"/);
  assert.doesNotMatch(serverMarkup, /DN-2026-00418|23:30|01:30/);
});
