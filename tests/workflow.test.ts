import assert from "node:assert/strict";
import test from "node:test";
import type { LessonConditions, LessonPlan } from "../src/lib/lesson/types.ts";
import {
  hasEnteredContent,
  initialWorkflowState,
  planBlockReason,
  workflowReducer,
  type WorkflowAction,
  type WorkflowState,
} from "../src/lib/lesson/workflow.ts";

// Synthetic fixtures only.
const conditionsA: LessonConditions = {
  unitSource: "catalog",
  unitId: "fixture-unit",
  unitName: "割合",
  totalLessons: 8,
  lessonNumber: 3,
  durationMinutes: 45,
};

const conditionsB: LessonConditions = {
  unitSource: "custom",
  unitName: "架空の単元テスト",
  totalLessons: 4,
  lessonNumber: 1,
  durationMinutes: 40,
};

const candidates = [
  { id: "c1", text: "架空の目標その1" },
  { id: "c2", text: "架空の目標その2" },
];

const planFixture: LessonPlan = {
  goal: "架空の目標その1",
  introduction: { activity: "架空の導入", minutes: 5 },
  development: { activity: "架空の展開", minutes: 30 },
  summary: { activity: "架空のまとめ", minutes: 10 },
  materials: ["架空の準備物"],
  understandingChecks: ["架空の確認方法"],
  reviewNotice: "架空の注意書き",
};

function run(state: WorkflowState, ...actions: WorkflowAction[]) {
  return actions.reduce(workflowReducer, state);
}

function confirmed(conditions = conditionsA) {
  return run(initialWorkflowState, { type: "conditionsConfirmed", conditions });
}

function withCandidates() {
  const s = confirmed();
  return run(s, {
    type: "goalsResolved",
    requestId: s.goals.requestId,
    result: { ok: true, data: { source: "mock", candidates } },
  });
}

function withPlanLoading() {
  return run(
    withCandidates(),
    { type: "candidateSelected", candidateId: "c1" },
    { type: "goalConfirmedChanged", confirmed: true },
    { type: "planRequested" },
  );
}

function withPlan() {
  const s = withPlanLoading();
  return run(s, {
    type: "planResolved",
    requestId: s.plan.requestId,
    result: { ok: true, data: { source: "mock", plan: planFixture } },
  });
}

test("initial state has no entered content", () => {
  assert.equal(hasEnteredContent(initialWorkflowState), false);
  const s = run(initialWorkflowState, {
    type: "formChanged",
    field: "totalLessons",
    value: "8",
  });
  assert.equal(hasEnteredContent(s), true);
});

test("form errors are stored and cleared per field", () => {
  const s = run(
    initialWorkflowState,
    {
      type: "conditionsInvalid",
      errors: { totalLessons: "e1", lessonNumber: "e2" },
    },
    { type: "formChanged", field: "totalLessons", value: "8" },
  );
  assert.deepEqual(s.fieldErrors, { lessonNumber: "e2" });
});

test("normal path: conditions → candidates → goal → plan → edit", () => {
  const s1 = confirmed();
  assert.equal(s1.goals.status, "loading");
  assert.deepEqual(s1.conditions, conditionsA);

  const s2 = withCandidates();
  assert.equal(s2.goals.status, "ready");
  assert.equal(s2.goals.candidates.length, 2);

  const s3 = run(s2, { type: "candidateSelected", candidateId: "c2" });
  assert.equal(s3.goalText, "架空の目標その2");
  assert.equal(s3.goalConfirmed, false);
  assert.notEqual(planBlockReason(s3), null);
  assert.equal(run(s3, { type: "planRequested" }).plan.status, "idle");

  const s4 = run(s3, { type: "goalConfirmedChanged", confirmed: true });
  assert.equal(planBlockReason(s4), null);
  const s5 = run(s4, { type: "planRequested" });
  assert.equal(s5.plan.status, "loading");
  assert.equal(s5.plan.goal, "架空の目標その2");

  const s6 = run(s5, {
    type: "planResolved",
    requestId: s5.plan.requestId,
    result: { ok: true, data: { source: "mock", plan: planFixture } },
  });
  assert.equal(s6.plan.status, "ready");
  assert.equal(s6.plan.edited, false);
  assert.equal(s6.plan.editable?.introduction.minutes, "5");

  const s7 = run(
    s6,
    {
      type: "phaseChanged",
      phase: "development",
      field: "minutes",
      value: "25",
    },
    { type: "planTextChanged", field: "materials", value: "A\nB" },
  );
  assert.equal(s7.plan.edited, true);
  assert.equal(s7.plan.editable?.development.minutes, "25");
  assert.equal(s7.plan.editable?.materials, "A\nB");
});

test("goal edit after confirming unconfirms; empty goal cannot be confirmed", () => {
  const s = run(
    withCandidates(),
    { type: "goalTextChanged", value: "手入力の架空目標" },
    { type: "goalConfirmedChanged", confirmed: true },
  );
  assert.equal(s.goalConfirmed, true);
  const edited = run(s, {
    type: "goalTextChanged",
    value: "手入力の架空目標2",
  });
  assert.equal(edited.goalConfirmed, false);

  const blank = run(
    withCandidates(),
    { type: "goalTextChanged", value: "   " },
    { type: "goalConfirmedChanged", confirmed: true },
  );
  assert.equal(blank.goalConfirmed, false);
  assert.equal(planBlockReason(blank), "本時の目標を入力してください。");
});

test("empty candidates still allow manual goal entry", () => {
  const s = confirmed();
  const s2 = run(
    s,
    {
      type: "goalsResolved",
      requestId: s.goals.requestId,
      result: { ok: true, data: { source: "mock", candidates: [] } },
    },
    { type: "goalTextChanged", value: "手入力の架空目標" },
    { type: "goalConfirmedChanged", confirmed: true },
  );
  assert.equal(s2.goals.status, "ready");
  assert.deepEqual(s2.goals.candidates, []);
  assert.equal(planBlockReason(s2), null);

  // Retrying keeps the manually entered goal and starts a new request.
  const retried = workflowReducer(s2, { type: "goalsRequested" });
  assert.equal(retried.goals.status, "loading");
  assert.notEqual(retried.goals.requestId, s.goals.requestId);
  assert.equal(retried.goalText, "手入力の架空目標");
});

test("an over-long goal blocks the plan request", () => {
  const s = run(
    confirmed(),
    { type: "goalTextChanged", value: "あ".repeat(201) },
    { type: "goalConfirmedChanged", confirmed: true },
  );
  assert.match(planBlockReason(s) ?? "", /200文字以内/);
  assert.equal(
    workflowReducer(s, { type: "planRequested" }).plan.status,
    "idle",
  );
  const ok = run(
    s,
    { type: "goalTextChanged", value: ` ${"あ".repeat(200)} ` },
    { type: "goalConfirmedChanged", confirmed: true },
  );
  assert.equal(planBlockReason(ok), null);
});

test("goal request failure then retry succeeds", () => {
  const s = confirmed();
  const failed = run(s, {
    type: "goalsResolved",
    requestId: s.goals.requestId,
    result: { ok: false, kind: "server", message: "失敗" },
  });
  assert.equal(failed.goals.status, "error");
  assert.equal(failed.goals.error?.kind, "server");

  const retry = run(failed, { type: "goalsRequested" });
  assert.equal(retry.goals.status, "loading");
  assert.notEqual(retry.goals.requestId, s.goals.requestId);
  // A duplicate request while loading is ignored.
  assert.equal(run(retry, { type: "goalsRequested" }), retry);

  const ok = run(retry, {
    type: "goalsResolved",
    requestId: retry.goals.requestId,
    result: { ok: true, data: { source: "mock", candidates } },
  });
  assert.equal(ok.goals.status, "ready");
});

test("plan failure then retry; invalid response never becomes a plan", () => {
  const s = withPlanLoading();
  const failed = run(s, {
    type: "planResolved",
    requestId: s.plan.requestId,
    result: { ok: false, kind: "invalid_response", message: "不正" },
  });
  assert.equal(failed.plan.status, "error");
  assert.equal(failed.plan.editable, null);

  const retry = run(failed, { type: "planRequested" });
  assert.equal(retry.plan.status, "loading");
  assert.equal(run(retry, { type: "planRequested" }), retry);
  const ok = run(retry, {
    type: "planResolved",
    requestId: retry.plan.requestId,
    result: { ok: true, data: { source: "mock", plan: planFixture } },
  });
  assert.equal(ok.plan.status, "ready");
});

test("stale goal response after a condition change is ignored", () => {
  const loading = confirmed();
  const oldId = loading.goals.requestId;
  // No downstream content yet, so the change happens without confirmation.
  const editing = run(loading, { type: "changeConditionsRequested" });
  assert.equal(editing.conditions, null);
  assert.equal(editing.pendingDiscard, null);

  const next = run(editing, {
    type: "conditionsConfirmed",
    conditions: conditionsB,
  });
  const late = run(next, {
    type: "goalsResolved",
    requestId: oldId,
    result: { ok: true, data: { source: "mock", candidates } },
  });
  assert.equal(late, next);
  assert.equal(late.goals.status, "loading");
  assert.deepEqual(late.conditions, conditionsB);
});

test("stale plan response after goal change is ignored", () => {
  const loading = withPlanLoading();
  const oldId = loading.plan.requestId;
  const changed = run(loading, { type: "changeGoalRequested" });
  assert.equal(changed.plan.status, "idle");
  assert.equal(changed.pendingDiscard, null);
  const late = run(changed, {
    type: "planResolved",
    requestId: oldId,
    result: { ok: true, data: { source: "mock", plan: planFixture } },
  });
  assert.equal(late, changed);
  assert.equal(late.plan.editable, null);
});

test("aborted results do not change state", () => {
  const s = confirmed();
  const after = run(s, {
    type: "goalsResolved",
    requestId: s.goals.requestId,
    result: { ok: false, kind: "aborted", message: "中断" },
  });
  assert.equal(after, s);
});

test("condition change with downstream content asks; cancel keeps everything", () => {
  const s = withPlan();
  const asking = run(s, { type: "changeConditionsRequested" });
  assert.equal(asking.pendingDiscard, "conditions");
  assert.deepEqual(asking.conditions, conditionsA);

  const cancelled = run(asking, { type: "discardCancelled" });
  assert.equal(cancelled.pendingDiscard, null);
  assert.deepEqual(cancelled.plan, s.plan);
  assert.equal(cancelled.goalText, s.goalText);
});

test("condition change discard clears goals, goal and plan but keeps the form", () => {
  const s = run(
    initialWorkflowState,
    { type: "formChanged", field: "totalLessons", value: "8" },
    { type: "conditionsConfirmed", conditions: conditionsA },
  );
  const withData = run(
    s,
    {
      type: "goalsResolved",
      requestId: s.goals.requestId,
      result: { ok: true, data: { source: "mock", candidates } },
    },
    { type: "goalTextChanged", value: "手入力の架空目標" },
  );
  const discarded = run(
    withData,
    { type: "changeConditionsRequested" },
    { type: "discardConfirmed" },
  );
  assert.equal(discarded.conditions, null);
  assert.equal(discarded.goals.status, "idle");
  assert.equal(discarded.goalText, "");
  assert.equal(discarded.plan.editable, null);
  assert.equal(discarded.form.totalLessons, "8");
  assert.equal(discarded.pendingDiscard, null);
});

test("goal change after a plan asks before discarding the plan", () => {
  const s = withPlan();
  assert.equal(
    run(s, { type: "goalTextChanged", value: "x" }).goalText,
    s.goalText,
  );
  const asking = run(s, { type: "changeGoalRequested" });
  assert.equal(asking.pendingDiscard, "goal");
  assert.equal(run(asking, { type: "discardCancelled" }).plan.status, "ready");

  const discarded = run(asking, { type: "discardConfirmed" });
  assert.equal(discarded.plan.status, "idle");
  assert.equal(discarded.plan.editable, null);
  assert.equal(discarded.goalText, s.goalText);
  assert.equal(discarded.goalConfirmed, false);
});

test("regenerate without edits starts a new request immediately", () => {
  const s = withPlan();
  const regen = run(s, { type: "regenerateRequested" });
  assert.equal(regen.pendingDiscard, null);
  assert.equal(regen.plan.status, "loading");
  assert.notEqual(regen.plan.requestId, s.plan.requestId);
});

test("regenerate with edits asks; cancel keeps edits; confirm regenerates", () => {
  const edited = run(withPlan(), {
    type: "planTextChanged",
    field: "goal",
    value: "編集した架空目標",
  });
  const asking = run(edited, { type: "regenerateRequested" });
  assert.equal(asking.pendingDiscard, "regenerate");
  assert.equal(asking.plan.status, "ready");
  // Edits are blocked from triggering a second request while asking.
  assert.equal(run(asking, { type: "regenerateRequested" }), asking);

  const cancelled = run(asking, { type: "discardCancelled" });
  assert.equal(cancelled.plan.editable?.goal, "編集した架空目標");
  assert.equal(cancelled.plan.edited, true);

  const confirmedRegen = run(asking, { type: "discardConfirmed" });
  assert.equal(confirmedRegen.plan.status, "loading");
  assert.equal(confirmedRegen.plan.editable, null);
  assert.equal(confirmedRegen.plan.goal, "架空の目標その1");
});

test("form is read-only while conditions are confirmed", () => {
  const s = confirmed();
  assert.equal(
    run(s, { type: "formChanged", field: "totalLessons", value: "9" }),
    s,
  );
});

test("switching candidates without own edits does not ask", () => {
  const s = run(
    withCandidates(),
    { type: "candidateSelected", candidateId: "c1" },
    { type: "candidateSelected", candidateId: "c2" },
  );
  assert.equal(s.pendingDiscard, null);
  assert.equal(s.selectedCandidateId, "c2");
  assert.equal(s.goalText, candidates[1].text);
});

test("picking a candidate over edited goal text asks; keep or discard", () => {
  const edited = run(
    withCandidates(),
    { type: "candidateSelected", candidateId: "c1" },
    { type: "goalTextChanged", value: "架空の書き換えた目標" },
  );
  const asking = run(edited, { type: "candidateSelected", candidateId: "c2" });
  assert.equal(asking.pendingDiscard, "candidate");
  assert.equal(asking.pendingCandidateId, "c2");
  assert.equal(asking.goalText, "架空の書き換えた目標");
  assert.equal(asking.selectedCandidateId, "c1");

  // Other changes are blocked while the confirmation is open.
  assert.equal(
    run(asking, { type: "goalTextChanged", value: "別の文" }),
    asking,
  );
  assert.equal(
    run(asking, { type: "candidateSelected", candidateId: "c3" }),
    asking,
  );

  const kept = run(asking, { type: "discardCancelled" });
  assert.equal(kept.pendingDiscard, null);
  assert.equal(kept.pendingCandidateId, null);
  assert.equal(kept.goalText, "架空の書き換えた目標");
  assert.equal(kept.selectedCandidateId, "c1");

  const replaced = run(asking, { type: "discardConfirmed" });
  assert.equal(replaced.pendingDiscard, null);
  assert.equal(replaced.goalText, candidates[1].text);
  assert.equal(replaced.selectedCandidateId, "c2");
  assert.equal(replaced.goalConfirmed, false);
});

test("manually typed goal with no selection also asks before a candidate", () => {
  const asking = run(
    withCandidates(),
    { type: "goalTextChanged", value: "架空の手入力目標" },
    { type: "candidateSelected", candidateId: "c1" },
  );
  assert.equal(asking.pendingDiscard, "candidate");
  assert.equal(asking.goalText, "架空の手入力目標");
});

test("plan edits are blocked while a discard confirmation is open", () => {
  const edited = run(withPlan(), {
    type: "planTextChanged",
    field: "materials",
    value: "架空の準備物",
  });
  const asking = run(edited, { type: "regenerateRequested" });
  assert.equal(asking.pendingDiscard, "regenerate");
  const blocked = run(
    asking,
    { type: "planTextChanged", field: "materials", value: "変更" },
    { type: "phaseChanged", phase: "summary", field: "minutes", value: "1" },
  );
  assert.equal(blocked, asking);
});
