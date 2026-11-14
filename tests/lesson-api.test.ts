import assert from "node:assert/strict";
import test from "node:test";
import {
  requestGoalCandidates,
  requestLessonPlan,
} from "../src/lib/lesson/api-client.ts";
import { LIMITS } from "../src/lib/lesson/limits.ts";
import { POST as postGoalCandidates } from "../src/app/api/mock/goal-candidates/route.ts";
import { POST as postLessonPlan } from "../src/app/api/mock/lesson-plan/route.ts";
import type { LessonConditions } from "../src/lib/lesson/types.ts";

const conditions: LessonConditions = {
  unitSource: "catalog",
  unitId: "average",
  unitName: "平均",
  totalLessons: 6,
  lessonNumber: 1,
  durationMinutes: 45,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const okCandidates = {
  source: "mock",
  candidates: [{ id: "c1", text: "候補" }],
};

/** A fake fetch that never resolves but rejects when its signal aborts. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
  });

test("api-client: success posts JSON to the mock route", async () => {
  let seenUrl = "";
  let seenBody: unknown;
  const result = await requestGoalCandidates(conditions, {
    fetchImpl: async (input, init) => {
      seenUrl = String(input);
      seenBody = JSON.parse(String(init?.body));
      assert.equal(init?.method, "POST");
      return jsonResponse(okCandidates);
    },
  });
  assert.deepEqual(result, { ok: true, data: okCandidates });
  assert.equal(seenUrl, "/api/mock/goal-candidates");
  assert.deepEqual(seenBody, { conditions });
});

test("api-client: error kinds", async () => {
  const cases: Array<[typeof fetch, string]> = [
    [async () => jsonResponse({ error: "x" }, 500), "server"],
    [async () => new Response("not json", { status: 200 }), "invalid_response"],
    [
      async () => jsonResponse({ source: "ai", candidates: [] }),
      "invalid_response",
    ],
    [() => Promise.reject(new TypeError("offline")), "network"],
  ];
  for (const [fetchImpl, kind] of cases) {
    const result = await requestGoalCandidates(conditions, { fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, kind);
      assert.ok(result.message.length > 0);
    }
  }
});

test("api-client: timeout", async () => {
  const result = await requestLessonPlan(conditions, "目標", {
    fetchImpl: hangingFetch,
    timeoutMs: 20,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "timeout");
    assert.match(result.message, /時間内/);
  }
});

test("api-client: caller abort, before and during the request", async () => {
  const pre = new AbortController();
  pre.abort();
  const before = await requestGoalCandidates(conditions, {
    signal: pre.signal,
    fetchImpl: hangingFetch,
  });
  assert.equal(before.ok === false && before.kind, "aborted");

  const during = new AbortController();
  const pending = requestGoalCandidates(conditions, {
    signal: during.signal,
    fetchImpl: hangingFetch,
    timeoutMs: 5000,
  });
  setTimeout(() => during.abort(), 10);
  const result = await pending;
  assert.equal(result.ok === false && result.kind, "aborted");
});

test("api-client: lesson plan end-to-end through the route handler", async () => {
  const fetchImpl: typeof fetch = (input, init) =>
    postLessonPlan(new Request(`http://localhost${String(input)}`, init));
  const result = await requestLessonPlan(conditions, "試作の目標", {
    fetchImpl,
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.data.source, "mock");
    assert.equal(result.data.plan.goal, "試作の目標");
  }
});

function post(body: string) {
  return new Request("http://localhost/api/mock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("goal-candidates route: valid request", async () => {
  const response = await postGoalCandidates(
    post(JSON.stringify({ conditions })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.source, "mock");
  assert.equal(body.candidates.length, LIMITS.goalCandidateCount);
});

test("routes: invalid JSON, schema-invalid and oversized bodies", async () => {
  const marker = "SYNTHETIC-ECHO-CHECK";
  for (const handler of [postGoalCandidates, postLessonPlan]) {
    const invalidJson = await handler(post(`{"conditions": ${marker}`));
    assert.equal(invalidJson.status, 400);
    const invalidText = await invalidJson.text();
    assert.equal(invalidText.includes(marker), false);
    assert.ok(JSON.parse(invalidText).error);

    const schemaInvalid = await handler(
      post(
        JSON.stringify({
          conditions: { ...conditions, unitName: marker },
          goal: marker,
        }),
      ),
    );
    assert.equal(schemaInvalid.status, 400);
    assert.equal((await schemaInvalid.text()).includes(marker), false);

    const oversized = await handler(
      post(
        JSON.stringify({
          conditions,
          goal: "あ".repeat(LIMITS.requestBodyMaxBytes),
        }),
      ),
    );
    assert.equal(oversized.status, 413);
  }
});

test("lesson-plan route: valid request and over-long goal", async () => {
  const response = await postLessonPlan(
    post(JSON.stringify({ conditions, goal: " 試作の目標 " })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.source, "mock");
  assert.equal(body.plan.goal, "試作の目標");
  const { introduction, development, summary } = body.plan;
  assert.equal(
    introduction.minutes + development.minutes + summary.minutes,
    45,
  );

  const tooLong = await postLessonPlan(
    post(
      JSON.stringify({
        conditions,
        goal: "あ".repeat(LIMITS.goalMaxLength + 1),
      }),
    ),
  );
  assert.equal(tooLong.status, 400);
});
