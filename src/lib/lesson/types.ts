/**
 * Shared contract for the mock lesson-plan MVP (Issue #6).
 * All generated content is produced by a fixed mock template, not by an AI model.
 */

export const GRADE_LABEL = "小学5年";
export const SUBJECT_LABEL = "算数";

/** Raw form values. Numbers stay as strings until validated. */
export interface ConditionsFormInput {
  unitMode: "catalog" | "custom";
  unitId: string;
  customUnitName: string;
  totalLessons: string;
  lessonNumber: string;
  durationMinutes: string;
}

export type ConditionsField = keyof ConditionsFormInput;
export type FieldErrors = Partial<Record<ConditionsField, string>>;

/** Validated lesson conditions. Grade and subject are fixed for this prototype. */
export interface LessonConditions {
  unitSource: "catalog" | "custom";
  /** Present only when unitSource is "catalog". */
  unitId?: string;
  unitName: string;
  totalLessons: number;
  lessonNumber: number;
  durationMinutes: number;
}

export interface CatalogUnit {
  id: string;
  name: string;
}

export interface GoalCandidate {
  id: string;
  text: string;
}

export interface LessonPhase {
  activity: string;
  minutes: number;
}

export interface LessonPlan {
  goal: string;
  introduction: LessonPhase;
  development: LessonPhase;
  summary: LessonPhase;
  materials: string[];
  understandingChecks: string[];
  reviewNotice: string;
}

export type PhaseKey = "introduction" | "development" | "summary";

/** Plan as edited by the teacher. Minutes stay as strings so invalid input can be reported. */
export interface EditablePhase {
  activity: string;
  minutes: string;
}

export interface EditablePlan {
  goal: string;
  introduction: EditablePhase;
  development: EditablePhase;
  summary: EditablePhase;
  /** One item per line. */
  materials: string;
  /** One item per line. */
  understandingChecks: string;
  reviewNotice: string;
}

/** Every response states its source; only "mock" exists until Issue #9 is decided. */
export type ContentSource = "mock";

export interface GoalCandidatesResponse {
  source: ContentSource;
  candidates: GoalCandidate[];
}

export interface LessonPlanResponse {
  source: ContentSource;
  plan: LessonPlan;
}

export interface GoalCandidatesRequest {
  conditions: LessonConditions;
}

export interface LessonPlanRequest {
  conditions: LessonConditions;
  goal: string;
}

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

export type ApiErrorKind =
  "timeout" | "network" | "server" | "invalid_response" | "aborted";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; kind: ApiErrorKind; message: string };

export type TimeCheckStatus = "match" | "under" | "over" | "invalid";

export interface TimeCheck {
  status: TimeCheckStatus;
  /** Sum of valid phase minutes; null when any phase is invalid. */
  total: number | null;
  durationMinutes: number;
  /** total - durationMinutes; null when invalid. */
  difference: number | null;
  invalidPhases: PhaseKey[];
}

export type CopyOutcome = "copied" | "failed";
