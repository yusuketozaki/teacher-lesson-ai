import assert from "node:assert/strict";
import test from "node:test";
import { PROJECT_SCOPE } from "../src/lib/project-scope.ts";
import { GET } from "../src/app/api/health/route.ts";
test("mock prototype excludes external AI, student records, uploads and storage", () => {
  assert.equal(PROJECT_SCOPE.contentSource, "mock");
  assert.equal(PROJECT_SCOPE.externalAiEnabled, false);
  assert.equal(PROJECT_SCOPE.studentRecordsEnabled, false);
  assert.equal(PROJECT_SCOPE.fileUploadsEnabled, false);
  assert.equal(PROJECT_SCOPE.persistentStorageEnabled, false);
});
test("health endpoint returns mock prototype status", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    stage: "mock-prototype",
  });
});
