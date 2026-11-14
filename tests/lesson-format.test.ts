import assert from "node:assert/strict";
import test from "node:test";
import { copyText } from "../src/lib/lesson/clipboard.ts";
import { mockLessonPlan } from "../src/lib/lesson/mock.ts";
import {
  formatPlanForCopy,
  splitLines,
  toEditablePlan,
} from "../src/lib/lesson/plan-format.ts";
import { checkTimeAllocation } from "../src/lib/lesson/time-check.ts";
import type { LessonConditions } from "../src/lib/lesson/types.ts";

const conditions: LessonConditions = {
  unitSource: "catalog",
  unitId: "volume",
  unitName: "体積",
  totalLessons: 8,
  lessonNumber: 3,
  durationMinutes: 45,
};

function check(introduction: string, development: string, summary: string) {
  return checkTimeAllocation(45, { introduction, development, summary });
}

test("time check: match, under, over", () => {
  assert.deepEqual(check("5", "30", "10"), {
    status: "match",
    total: 45,
    durationMinutes: 45,
    difference: 0,
    invalidPhases: [],
  });
  const under = check("5", "25", "10");
  assert.equal(under.status, "under");
  assert.equal(under.difference, -5);
  const over = check("10", "30", "10");
  assert.equal(over.status, "over");
  assert.equal(over.total, 50);
  assert.equal(over.difference, 5);
});

test("time check: invalid phase values", () => {
  for (const bad of ["", "-5", "1.5", "abc", "1000", " "]) {
    const result = check(bad, "30", "10");
    assert.equal(result.status, "invalid", bad);
    assert.equal(result.total, null);
    assert.equal(result.difference, null);
    assert.deepEqual(result.invalidPhases, ["introduction"]);
  }
  assert.deepEqual(check("x", "30", "").invalidPhases, [
    "introduction",
    "summary",
  ]);
  assert.equal(check("0", "35", "10").status, "match");
  assert.equal(check(" ５ ", "30", "10").status, "match");
});

test("toEditablePlan and splitLines", () => {
  const plan = mockLessonPlan(conditions, "目標");
  const editable = toEditablePlan(plan);
  assert.equal(
    editable.introduction.minutes,
    String(plan.introduction.minutes),
  );
  assert.equal(editable.materials, plan.materials.join("\n"));
  assert.deepEqual(splitLines(editable.materials), plan.materials);
  assert.deepEqual(splitLines("  a \n\n b\r\n  \n"), ["a", "b"]);
});

test("formatPlanForCopy uses current edited values and warns on mismatch", () => {
  const editable = toEditablePlan(mockLessonPlan(conditions, "元の目標"));
  editable.goal = "編集した目標";
  editable.introduction = { activity: "編集した導入", minutes: "10" };
  editable.development.minutes = "30";
  editable.summary.minutes = "10";
  editable.materials = "編集した準備物\n\n二つ目";
  editable.understandingChecks = "編集した確認方法";
  const text = formatPlanForCopy(conditions, editable, check("10", "30", "10"));
  assert.match(text, /たたき台（mock 出力・教員確認前）/);
  assert.match(text, /小学5年 算数/);
  assert.match(text, /単元: 体積/);
  assert.match(text, /全8時間中3時間目/);
  assert.match(text, /授業時間: 45分/);
  assert.match(text, /編集した目標/);
  assert.doesNotMatch(text, /元の目標/);
  assert.match(text, /【導入】（10分）\n編集した導入/);
  assert.match(text, /- 編集した準備物\n- 二つ目/);
  assert.match(text, /- 編集した確認方法/);
  assert.match(text, /合計 50分 \/ 授業時間 45分 \/ 差 \+5分/);
  assert.match(text, /超えています/);
  assert.match(text, /注意書き:\n.*mock/);
  assert.match(text, /コピー先での保存・共有はこのアプリの管理外/);
});

test("formatPlanForCopy shows raw invalid minutes and a warning", () => {
  const editable = toEditablePlan(mockLessonPlan(conditions, "目標"));
  editable.development.minutes = "abc";
  const text = formatPlanForCopy(
    conditions,
    editable,
    check(editable.introduction.minutes, "abc", editable.summary.minutes),
  );
  assert.match(text, /【展開】（abc）/);
  assert.match(text, /合計を計算できません/);
  assert.match(text, /展開/);
});

test("formatPlanForCopy has no warning when time matches", () => {
  const editable = toEditablePlan(mockLessonPlan(conditions, "目標"));
  const c = check(
    editable.introduction.minutes,
    editable.development.minutes,
    editable.summary.minutes,
  );
  assert.equal(c.status, "match");
  const text = formatPlanForCopy(conditions, editable, c);
  assert.match(text, /差 0分/);
  assert.doesNotMatch(text, /※合計/);
});

test("copyText: success, rejection and missing clipboard", async () => {
  let copied = "";
  assert.equal(
    await copyText("本文", {
      writeText: async (t) => {
        copied = t;
      },
    }),
    "copied",
  );
  assert.equal(copied, "本文");
  assert.equal(
    await copyText("本文", {
      writeText: () => Promise.reject(new Error("denied")),
    }),
    "failed",
  );
  assert.equal(
    await copyText("本文", {
      writeText: () => {
        throw new Error("sync");
      },
    }),
    "failed",
  );
  assert.equal(await copyText("本文", undefined), "failed");
});
