import assert from "node:assert/strict";
import test from "node:test";
import { LIMITS } from "../src/lib/lesson/limits.ts";
import {
  lessonPosition,
  mockGoalCandidates,
  mockLessonPlan,
} from "../src/lib/lesson/mock.ts";
import {
  parseGoalCandidatesResponse,
  parseLessonPlanResponse,
} from "../src/lib/lesson/schema.ts";
import type { LessonConditions } from "../src/lib/lesson/types.ts";

function cond(patch: Partial<LessonConditions> = {}): LessonConditions {
  return {
    unitSource: "custom",
    unitName: "試作単元",
    totalLessons: 8,
    lessonNumber: 4,
    durationMinutes: 45,
    ...patch,
  };
}

const positions: Array<[string, Partial<LessonConditions>]> = [
  ["single", { totalLessons: 1, lessonNumber: 1 }],
  ["first", { totalLessons: 8, lessonNumber: 1 }],
  ["middle", { totalLessons: 8, lessonNumber: 4 }],
  ["last", { totalLessons: 8, lessonNumber: 8 }],
];

test("lessonPosition classifies single / first / middle / last", () => {
  for (const [expected, patch] of positions) {
    assert.equal(lessonPosition(cond(patch)), expected);
  }
});

test("goal candidates: deterministic, fixed count, include unit name, vary by position", () => {
  const texts = new Set<string>();
  for (const [, patch] of positions) {
    const a = mockGoalCandidates(cond(patch));
    const b = mockGoalCandidates(cond(patch));
    assert.deepEqual(a, b);
    assert.equal(a.length, LIMITS.goalCandidateCount);
    assert.equal(new Set(a.map((g) => g.id)).size, a.length);
    for (const g of a) assert.ok(g.text.includes("試作単元"));
    texts.add(a[0].text);
    assert.equal(
      parseGoalCandidatesResponse({ source: "mock", candidates: a }).ok,
      true,
    );
  }
  assert.equal(texts.size, positions.length);
});

test("plan minutes sum to duration for every duration 5..120 and position", () => {
  for (let d = LIMITS.durationMinutesMin; d <= LIMITS.durationMinutesMax; d++) {
    for (const [, patch] of positions) {
      const plan = mockLessonPlan(
        cond({ ...patch, durationMinutes: d }),
        "目標",
      );
      const { introduction, development, summary } = plan;
      for (const phase of [introduction, development, summary]) {
        assert.ok(Number.isInteger(phase.minutes) && phase.minutes >= 1);
      }
      assert.equal(
        introduction.minutes + development.minutes + summary.minutes,
        d,
      );
    }
  }
});

test("plan uses the given goal, is deterministic and passes the response schema", () => {
  for (const [, patch] of positions) {
    const plan = mockLessonPlan(cond(patch), "試作の目標");
    assert.equal(plan.goal, "試作の目標");
    assert.deepEqual(plan, mockLessonPlan(cond(patch), "試作の目標"));
    assert.ok(plan.materials.length >= 2 && plan.materials.length <= 4);
    assert.ok(
      plan.understandingChecks.length >= 2 &&
        plan.understandingChecks.length <= 4,
    );
    assert.match(plan.reviewNotice, /mock/);
    assert.match(plan.reviewNotice, /AI/);
    assert.match(plan.reviewNotice, /確認/);
    assert.equal(parseLessonPlanResponse({ source: "mock", plan }).ok, true);
  }
  assert.deepEqual(
    [45, 5, 120].map((d) => {
      const p = mockLessonPlan(cond({ durationMinutes: d }), "g");
      return [p.introduction.minutes, p.development.minutes, p.summary.minutes];
    }),
    [
      [7, 29, 9],
      [1, 3, 1],
      [18, 78, 24],
    ],
  );
});
