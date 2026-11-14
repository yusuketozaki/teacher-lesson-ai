/**
 * Pure runtime validators shared by the mock API routes and the client.
 * Error strings name fields only and never echo the received values.
 */
import { findCatalogUnit } from "./catalog.ts";
import {
  findCatalogUnitByName,
  hasInvisibleChars,
  normalizeUnitName,
  textLength,
} from "./conditions.ts";
import { LIMITS } from "./limits.ts";
import type {
  GoalCandidate,
  GoalCandidatesRequest,
  GoalCandidatesResponse,
  LessonConditions,
  LessonPhase,
  LessonPlan,
  LessonPlanRequest,
  LessonPlanResponse,
  ParseResult,
} from "./types.ts";

type Obj = Record<string, unknown>;

function isObject(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIntegerInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function fail<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

export function parseLessonConditions(
  v: unknown,
): ParseResult<LessonConditions> {
  if (!isObject(v)) return fail("conditions がオブジェクトではありません。");
  const { unitSource, unitId, unitName } = v;
  let conditions: LessonConditions;

  if (unitSource === "catalog") {
    if (typeof unitId !== "string")
      return fail("conditions.unitId が不正です。");
    const unit = findCatalogUnit(unitId);
    if (!unit) return fail("conditions.unitId が一覧にありません。");
    if (unitName !== unit.name) {
      return fail("conditions.unitName が unitId と一致しません。");
    }
    conditions = {
      unitSource,
      unitId: unit.id,
      unitName: unit.name,
      totalLessons: 0,
      lessonNumber: 0,
      durationMinutes: 0,
    };
  } else if (unitSource === "custom") {
    if (unitId !== undefined) {
      return fail("conditions.unitId は custom では指定できません。");
    }
    if (!isNonEmptyString(unitName)) {
      return fail("conditions.unitName が空です。");
    }
    if (
      normalizeUnitName(unitName) !== unitName ||
      hasInvisibleChars(unitName) ||
      textLength(unitName) > LIMITS.unitNameMaxLength ||
      findCatalogUnitByName(unitName)
    ) {
      return fail("conditions.unitName が不正です。");
    }
    conditions = {
      unitSource,
      unitName,
      totalLessons: 0,
      lessonNumber: 0,
      durationMinutes: 0,
    };
  } else {
    return fail("conditions.unitSource が不正です。");
  }

  if (!isIntegerInRange(v.totalLessons, 1, LIMITS.totalLessonsMax)) {
    return fail("conditions.totalLessons が範囲外です。");
  }
  if (!isIntegerInRange(v.lessonNumber, 1, v.totalLessons)) {
    return fail("conditions.lessonNumber が範囲外です。");
  }
  if (
    !isIntegerInRange(
      v.durationMinutes,
      LIMITS.durationMinutesMin,
      LIMITS.durationMinutesMax,
    )
  ) {
    return fail("conditions.durationMinutes が範囲外です。");
  }
  conditions.totalLessons = v.totalLessons;
  conditions.lessonNumber = v.lessonNumber;
  conditions.durationMinutes = v.durationMinutes;
  return { ok: true, value: conditions };
}

export function parseGoalCandidatesRequest(
  v: unknown,
): ParseResult<GoalCandidatesRequest> {
  if (!isObject(v)) return fail("リクエストがオブジェクトではありません。");
  const conditions = parseLessonConditions(v.conditions);
  if (!conditions.ok) return conditions;
  return { ok: true, value: { conditions: conditions.value } };
}

export function parseLessonPlanRequest(
  v: unknown,
): ParseResult<LessonPlanRequest> {
  if (!isObject(v)) return fail("リクエストがオブジェクトではありません。");
  const conditions = parseLessonConditions(v.conditions);
  if (!conditions.ok) return conditions;
  if (typeof v.goal !== "string") return fail("goal が文字列ではありません。");
  const goal = v.goal.trim();
  if (goal === "") return fail("goal が空です。");
  if (textLength(goal) > LIMITS.goalMaxLength) {
    return fail("goal が長すぎます。");
  }
  return { ok: true, value: { conditions: conditions.value, goal } };
}

export function parseGoalCandidatesResponse(
  v: unknown,
): ParseResult<GoalCandidatesResponse> {
  if (!isObject(v)) return fail("応答がオブジェクトではありません。");
  if (v.source !== "mock") return fail("source が不正です。");
  if (!Array.isArray(v.candidates))
    return fail("candidates が配列ではありません。");
  if (v.candidates.length > LIMITS.goalCandidateCount) {
    return fail("candidates の件数が多すぎます。");
  }
  const candidates: GoalCandidate[] = [];
  for (const item of v.candidates) {
    if (
      !isObject(item) ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.text)
    ) {
      return fail("candidates の要素が不正です。");
    }
    candidates.push({ id: item.id, text: item.text });
  }
  return { ok: true, value: { source: "mock", candidates } };
}

function parsePhase(v: unknown): LessonPhase | null {
  if (!isObject(v)) return null;
  if (!isNonEmptyString(v.activity) || !isPositiveInteger(v.minutes)) {
    return null;
  }
  return { activity: v.activity, minutes: v.minutes };
}

function parseStringList(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  if (!v.every(isNonEmptyString)) return null;
  return [...v];
}

export function parseLessonPlan(v: unknown): ParseResult<LessonPlan> {
  if (!isObject(v)) return fail("plan がオブジェクトではありません。");
  if (!isNonEmptyString(v.goal)) return fail("plan.goal が不正です。");
  const introduction = parsePhase(v.introduction);
  if (!introduction) return fail("plan.introduction が不正です。");
  const development = parsePhase(v.development);
  if (!development) return fail("plan.development が不正です。");
  const summary = parsePhase(v.summary);
  if (!summary) return fail("plan.summary が不正です。");
  const materials = parseStringList(v.materials);
  if (!materials) return fail("plan.materials が不正です。");
  const understandingChecks = parseStringList(v.understandingChecks);
  if (!understandingChecks)
    return fail("plan.understandingChecks が不正です。");
  if (!isNonEmptyString(v.reviewNotice)) {
    return fail("plan.reviewNotice が不正です。");
  }
  return {
    ok: true,
    value: {
      goal: v.goal,
      introduction,
      development,
      summary,
      materials,
      understandingChecks,
      reviewNotice: v.reviewNotice,
    },
  };
}

export function parseLessonPlanResponse(
  v: unknown,
): ParseResult<LessonPlanResponse> {
  if (!isObject(v)) return fail("応答がオブジェクトではありません。");
  if (v.source !== "mock") return fail("source が不正です。");
  const plan = parseLessonPlan(v.plan);
  if (!plan.ok) return plan;
  return { ok: true, value: { source: "mock", plan: plan.value } };
}
