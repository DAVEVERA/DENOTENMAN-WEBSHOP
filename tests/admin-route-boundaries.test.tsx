import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AdminDashboardLoading from "../app/admin/(dashboard)/loading";
import AdminDashboardError from "../app/admin/(dashboard)/error";

test("admin dashboard has explicit loading and retry states", () => {
  const loading = renderToStaticMarkup(<AdminDashboardLoading />);
  const failure = renderToStaticMarkup(<AdminDashboardError error={new Error("test")} reset={() => undefined} />);

  assert.match(loading, /Beheeromgeving laden/);
  assert.match(loading, /role="status"/);
  assert.match(failure, /Beheerpagina kon niet worden geladen/);
  assert.match(failure, /Opnieuw proberen/);
  assert.match(failure, /role="alert"/);
});
