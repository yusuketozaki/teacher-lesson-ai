import assert from "node:assert/strict";
import test from "node:test";
import { PROJECT_SCOPE } from "../src/lib/project-scope.ts";
import { GET } from "../src/app/api/health/route.ts";
test("skeleton excludes external AI, student records and uploads", () => {
  assert.equal(PROJECT_SCOPE.externalAiEnabled, false);
  assert.equal(PROJECT_SCOPE.studentRecordsEnabled, false);
  assert.equal(PROJECT_SCOPE.fileUploadsEnabled, false);
});
test("health endpoint returns skeleton status", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", stage: "skeleton" });
});
