import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getOverview } from "../app/api/admin/cost-overview/route";
import {
  GET as listCosts,
  POST as createCost,
} from "../app/api/admin/cost-overview/costs/route";
import {
  PATCH as updateCost,
  DELETE as deleteCost,
} from "../app/api/admin/cost-overview/costs/[id]/route";
import {
  GET as listInvoices,
  POST as uploadInvoice,
} from "../app/api/admin/cost-overview/invoices/route";
import { DELETE as deleteInvoice } from "../app/api/admin/cost-overview/invoices/[id]/route";
import { GET as downloadInvoice } from "../app/api/admin/cost-overview/invoices/[id]/download/route";

const id = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };

test("all cost-overview endpoints authenticate before reading input or storage", async () => {
  const responses = await Promise.all([
    getOverview(new NextRequest("http://localhost/api/admin/cost-overview")),
    listCosts(
      new NextRequest("http://localhost/api/admin/cost-overview/costs"),
    ),
    createCost(
      new NextRequest("http://localhost/api/admin/cost-overview/costs", {
        method: "POST",
      }),
    ),
    updateCost(
      new NextRequest(`http://localhost/api/admin/cost-overview/costs/${id}`, {
        method: "PATCH",
        body: "not-json",
      }),
      context,
    ),
    deleteCost(
      new NextRequest(`http://localhost/api/admin/cost-overview/costs/${id}`, {
        method: "DELETE",
      }),
      context,
    ),
    listInvoices(
      new NextRequest("http://localhost/api/admin/cost-overview/invoices"),
    ),
    uploadInvoice(
      new NextRequest("http://localhost/api/admin/cost-overview/invoices", {
        method: "POST",
      }),
    ),
    deleteInvoice(
      new NextRequest(
        `http://localhost/api/admin/cost-overview/invoices/${id}`,
        { method: "DELETE" },
      ),
      context,
    ),
    downloadInvoice(
      new NextRequest(
        `http://localhost/api/admin/cost-overview/invoices/${id}/download`,
      ),
      context,
    ),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    Array(9).fill(401),
  );
  for (const response of responses) {
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});
