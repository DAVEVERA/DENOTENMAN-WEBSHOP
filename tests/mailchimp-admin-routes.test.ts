import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as list, POST as create } from "../app/api/admin/marketing/newsletters/route";
import {
  DELETE as remove,
  GET as detail,
  PATCH as update,
} from "../app/api/admin/marketing/newsletters/[id]/route";
import { POST as sendTest } from "../app/api/admin/marketing/newsletters/[id]/test/route";
import { POST as schedule } from "../app/api/admin/marketing/newsletters/[id]/schedule/route";
import { POST as send } from "../app/api/admin/marketing/newsletters/[id]/send/route";

const baseUrl = "http://localhost/api/admin/marketing/newsletters";
const context = { params: Promise.resolve({ id: "campaign-1" }) };

function request(path = "", method = "GET"): NextRequest {
  return new NextRequest(`${baseUrl}${path}`, {
    method,
    ...(method === "GET"
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
  });
}

async function main(): Promise<void> {
  const responses = await Promise.all([
    list(request()),
    create(request("", "POST")),
    detail(request("/campaign-1"), context),
    update(request("/campaign-1", "PATCH"), context),
    remove(request("/campaign-1", "DELETE"), context),
    sendTest(request("/campaign-1/test", "POST"), context),
    schedule(request("/campaign-1/schedule", "POST"), context),
    send(request("/campaign-1/send", "POST"), context),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 401, "newsletter admin routes must reject missing sessions");
  }

  console.log("Mailchimp newsletter admin route tests passed");
}

void main();
