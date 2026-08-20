import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as createJob } from "../app/api/admin/design-studio/photoroom/jobs/route";
import { POST as publishJob } from "../app/api/admin/design-studio/photoroom/jobs/[jobId]/publish/route";

test("Design Studio mutation routes reject unauthenticated requests before parsing input", async () => {
  const [created, published] = await Promise.all([
    createJob(new NextRequest("http://localhost/api/admin/design-studio/photoroom/jobs", { method: "POST", body: "invalid" })),
    publishJob(
      new NextRequest("http://localhost/api/admin/design-studio/photoroom/jobs/job_1/publish", { method: "POST", body: "invalid" }),
      { params: Promise.resolve({ jobId: "job_1" }) }
    ),
  ]);
  assert.equal(created.status, 401);
  assert.equal(published.status, 401);
  assert.deepEqual(await created.json(), { error: "UNAUTHORIZED" });
  assert.deepEqual(await published.json(), { error: "UNAUTHORIZED" });
});
