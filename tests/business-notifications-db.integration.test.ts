import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from "../lib/admin-auth";
import { GET, PATCH } from "../app/api/admin/business-events/route";

test("notification dropdown returns bounded customer events with per-admin read state and guarded marking", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
  const suffix = randomUUID();
  const account = await prisma.businessAccount.create({ data: { companyName: "QA notification company", contactName: "QA", email: `${suffix}@example.invalid` } });
  const admin = await prisma.adminUser.create({ data: { username: suffix, passwordHash: "unused", name: "QA" } });
  const other = await prisma.adminUser.create({ data: { username: `${suffix}-other`, passwordHash: "unused", name: "QA" } });
  try {
    const cookie = `${ADMIN_SESSION_COOKIE}=${await createAdminSessionToken(admin.id)}`;
    const events = await Promise.all(Array.from({ length: 10 }, (_, index) => prisma.businessEvent.create({ data: {
      businessAccountId: account.id, actorType: "CUSTOMER", actorName: "QA", type: "ORDER_LIST_NOTE_ADDED", summary: `QA notification ${index}`, createdAt: new Date(Date.now() + 60_000 + index * 1000),
    } })));
    await prisma.businessEvent.create({ data: { businessAccountId: account.id, actorType: "ADMIN", actorName: "QA", type: "ACCOUNT_UPDATED", summary: "Never shown as customer notification", createdAt: new Date(Date.now() + 120_000) } });
    await prisma.businessEventRead.create({ data: { businessEventId: events[9].id, adminUserId: other.id } });
    const request = () => new NextRequest("http://localhost:3105/api/admin/business-events", { headers: { cookie } });
    assert.equal((await GET(new NextRequest(request().url))).status, 401);
    const response = await GET(request());
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.events?.length, 8);
    assert.equal(result.events[0].id, events[9].id);
    assert.equal(result.events[0].unread, true, "another admin's read state must not leak");
    assert.equal(result.events[0].companyName, "QA notification company");
    assert.equal(result.events[0].href, `/admin/zakelijk/${account.id}`);
    assert.equal(result.events.some((event: { summary: string }) => event.summary.includes("Never shown")), false);
    const mark = (origin: string) => PATCH(new NextRequest(request().url, { method: "PATCH", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify({ eventIds: [events[9].id] }) }));
    assert.equal((await mark("https://untrusted.example")).status, 403);
    assert.equal((await mark("http://localhost:3105")).status, 200);
    const after = await (await GET(request())).json();
    assert.equal(after.events[0].unread, false);
    assert.equal(after.unreadCount, result.unreadCount - 1);
  } finally {
    await prisma.businessAccount.delete({ where: { id: account.id } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [admin.id, other.id] } } });
  }
});
