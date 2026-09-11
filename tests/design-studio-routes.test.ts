import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as createJob } from "../app/api/admin/design-studio/photoroom/jobs/route";
import { GET as getPhotoRoomStatus } from "../app/api/admin/design-studio/photoroom/status/route";
import { POST as publishJob } from "../app/api/admin/design-studio/photoroom/jobs/[jobId]/publish/route";
import { POST as createVModelJob } from "../app/api/admin/design-studio/vmodel/jobs/route";
import { GET as getVModelJob } from "../app/api/admin/design-studio/vmodel/jobs/[jobId]/route";
import { POST as publishAnyJob } from "../app/api/admin/design-studio/jobs/[jobId]/publish/route";

test("Design Studio mutation routes reject unauthenticated requests before parsing input", async () => {
  const [created, photoRoomStatus, published, vmodelCreated, vmodelRead, genericPublished] = await Promise.all([
    createJob(new NextRequest("http://localhost/api/admin/design-studio/photoroom/jobs", { method: "POST", body: "invalid" })),
    getPhotoRoomStatus(new NextRequest("http://localhost/api/admin/design-studio/photoroom/status")),
    publishJob(
      new NextRequest("http://localhost/api/admin/design-studio/photoroom/jobs/job_1/publish", { method: "POST", body: "invalid" }),
      { params: Promise.resolve({ jobId: "job_1" }) }
    ),
    createVModelJob(new NextRequest("http://localhost/api/admin/design-studio/vmodel/jobs", { method: "POST", body: "invalid" })),
    getVModelJob(new NextRequest("http://localhost/api/admin/design-studio/vmodel/jobs/job_1"), { params: Promise.resolve({ jobId: "job_1" }) }),
    publishAnyJob(
      new NextRequest("http://localhost/api/admin/design-studio/jobs/job_1/publish", { method: "POST", body: "invalid" }),
      { params: Promise.resolve({ jobId: "job_1" }) },
    ),
  ]);
  assert.equal(created.status, 401);
  assert.equal(photoRoomStatus.status, 401);
  assert.equal(published.status, 401);
  assert.equal(vmodelCreated.status, 401);
  assert.equal(vmodelRead.status, 401);
  assert.equal(genericPublished.status, 401);
  assert.deepEqual(await created.json(), { error: "UNAUTHORIZED" });
  assert.deepEqual(await photoRoomStatus.json(), { error: "UNAUTHORIZED" });
  assert.deepEqual(await published.json(), { error: "UNAUTHORIZED" });
  assert.deepEqual(await vmodelCreated.json(), { error: "UNAUTHORIZED" });
  assert.deepEqual(await vmodelRead.json(), { error: "UNAUTHORIZED" });
  assert.deepEqual(await genericPublished.json(), { error: "UNAUTHORIZED" });
});
