import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGoalCandidatesRequest,
  parseGoalCandidatesResponse,
  parseLessonConditions,
  parseLessonPlanRequest,
  parseLessonPlanResponse,
} from "../src/lib/lesson/schema.ts";

const catalogConditions = {
  unitSource: "catalog",
  unitId: "volume",
  unitName: "体積",
  totalLessons: 10,
  lessonNumber: 2,
  durationMinutes: 45,
};
const customConditions = {
  unitSource: "custom",
  unitName: "試作単元",
  totalLessons: 1,
  lessonNumber: 1,
  durationMinutes: 5,
};

const validPlan = {
  goal: "目標",
  introduction: { activity: "導入の活動", minutes: 5 },
  development: { activity: "展開の活動", minutes: 30 },
  summary: { activity: "まとめの活動", minutes: 10 },
  materials: ["ノート", "掲示物"],
  understandingChecks: ["ノートを見る"],
  reviewNotice: "注意",
};

test("parseLessonConditions accepts valid catalog and custom conditions", () => {
  assert.deepEqual(parseLessonConditions(catalogConditions), {
    ok: true,
    value: catalogConditions,
  });
  assert.deepEqual(parseLessonConditions(customConditions), {
    ok: true,
    value: customConditions,
  });
});

test("parseLessonConditions rejects invalid values", () => {
  const bad: unknown[] = [
    null,
    [],
    "x",
    { ...catalogConditions, unitSource: "other" },
    { ...catalogConditions, unitId: "unknown" },
    { ...catalogConditions, unitName: "別の名前" },
    { ...customConditions, unitName: "" },
    { ...customConditions, unitName: "   " },
    { ...customConditions, unitName: "あ".repeat(41) },
    { ...customConditions, unitName: "体積" },
    { ...customConditions, unitName: "\u200b" },
    { ...customConditions, unitName: "試作\u200b単元" },
    { ...customConditions, unitName: "試作\u0007単元" },
    { ...customConditions, unitName: "\u3164" },
    { ...customConditions, unitId: "volume" },
    { ...catalogConditions, totalLessons: 0 },
    { ...catalogConditions, totalLessons: 31 },
    { ...catalogConditions, totalLessons: "10" },
    { ...catalogConditions, lessonNumber: 11 },
    { ...catalogConditions, lessonNumber: 1.5 },
    { ...catalogConditions, durationMinutes: 4 },
    { ...catalogConditions, durationMinutes: 121 },
    { ...catalogConditions, durationMinutes: undefined },
  ];
  for (const value of bad) {
    assert.equal(parseLessonConditions(value).ok, false, JSON.stringify(value));
  }
});

test("request parsers", () => {
  assert.equal(
    parseGoalCandidatesRequest({ conditions: catalogConditions }).ok,
    true,
  );
  assert.equal(parseGoalCandidatesRequest({}).ok, false);
  const ok = parseLessonPlanRequest({
    conditions: catalogConditions,
    goal: "  目標  ",
  });
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.value.goal, "目標");
  for (const goal of ["", "   ", 1, null, undefined, "あ".repeat(201)]) {
    assert.equal(
      parseLessonPlanRequest({ conditions: catalogConditions, goal }).ok,
      false,
    );
  }
});

test("error messages do not echo input", () => {
  const secret = "SYNTHETIC-ECHO-CHECK";
  const results = [
    parseLessonConditions({ ...customConditions, unitName: secret.repeat(5) }),
    parseLessonPlanRequest({
      conditions: catalogConditions,
      goal: secret.repeat(30),
    }),
    parseGoalCandidatesResponse({ source: secret }),
  ];
  for (const r of results) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.includes(secret), false);
  }
});

test("parseGoalCandidatesResponse", () => {
  assert.equal(
    parseGoalCandidatesResponse({
      source: "mock",
      candidates: [{ id: "a", text: "t" }],
    }).ok,
    true,
  );
  assert.equal(
    parseGoalCandidatesResponse({ source: "mock", candidates: [] }).ok,
    true,
  );
  const bad: unknown[] = [
    null,
    { candidates: [] },
    { source: "ai", candidates: [] },
    { source: "mock" },
    { source: "mock", candidates: {} },
    { source: "mock", candidates: [{ id: "a" }] },
    { source: "mock", candidates: [{ id: "", text: "t" }] },
    { source: "mock", candidates: [{ id: "a", text: " " }] },
    { source: "mock", candidates: [{ id: 1, text: "t" }] },
    { source: "mock", candidates: ["t"] },
  ];
  for (const value of bad) {
    assert.equal(
      parseGoalCandidatesResponse(value).ok,
      false,
      JSON.stringify(value),
    );
  }
});

test("parseLessonPlanResponse accepts a complete plan", () => {
  assert.deepEqual(
    parseLessonPlanResponse({ source: "mock", plan: validPlan }),
    {
      ok: true,
      value: { source: "mock", plan: validPlan },
    },
  );
});

test("parseLessonPlanResponse rejects missing, mistyped and empty fields", () => {
  const variants: Record<string, unknown>[] = [
    { goal: undefined },
    { goal: "" },
    { goal: 1 },
    { introduction: undefined },
    { introduction: { activity: "", minutes: 5 } },
    { introduction: { activity: "a", minutes: 0 } },
    { development: { activity: "a", minutes: 1.5 } },
    { summary: { activity: "a", minutes: "10" } },
    { materials: [] },
    { materials: "ノート" },
    { materials: ["ノート", ""] },
    { understandingChecks: [1] },
    { understandingChecks: undefined },
    { reviewNotice: "" },
    { reviewNotice: undefined },
  ];
  for (const patch of variants) {
    const plan = { ...validPlan, ...patch };
    assert.equal(
      parseLessonPlanResponse({ source: "mock", plan }).ok,
      false,
      JSON.stringify(patch),
    );
  }
  assert.equal(
    parseLessonPlanResponse({ source: "ai", plan: validPlan }).ok,
    false,
  );
  assert.equal(parseLessonPlanResponse({ plan: validPlan }).ok, false);
  assert.equal(parseLessonPlanResponse({ source: "mock" }).ok, false);
});
