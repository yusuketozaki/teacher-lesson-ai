/**
 * Pure state machine for the mock lesson workflow (conditions → goals → plan).
 *
 * The reducer performs no I/O. Components start requests when a step enters
 * the "loading" status and report results back with the request id they were
 * started with. Results whose id no longer matches the current request are
 * ignored, so late responses for old conditions or goals never overwrite the
 * current state. All state lives in memory only.
 */

import type {
  ApiErrorKind,
  ApiResult,
  ConditionsField,
  ConditionsFormInput,
  EditablePlan,
  FieldErrors,
  GoalCandidate,
  GoalCandidatesResponse,
  LessonConditions,
  LessonPlanResponse,
  PhaseKey,
} from "./types.ts";
import { toEditablePlan } from "./plan-format.ts";

export type RequestStatus = "idle" | "loading" | "ready" | "error";

export interface RequestError {
  kind: ApiErrorKind;
  message: string;
}

export type DiscardKind = "conditions" | "goal" | "regenerate";

export interface GoalsState {
  status: RequestStatus;
  requestId: number;
  candidates: GoalCandidate[];
  error: RequestError | null;
}

export interface PlanState {
  status: RequestStatus;
  requestId: number;
  /** Goal text the current/last plan request was made with. */
  goal: string | null;
  editable: EditablePlan | null;
  /** True once the teacher changed any field of the generated plan. */
  edited: boolean;
  error: RequestError | null;
}

export interface WorkflowState {
  form: ConditionsFormInput;
  fieldErrors: FieldErrors;
  /** Confirmed conditions; null while the form is being edited. */
  conditions: LessonConditions | null;
  goals: GoalsState;
  selectedCandidateId: string | null;
  goalText: string;
  goalConfirmed: boolean;
  plan: PlanState;
  pendingDiscard: DiscardKind | null;
  lastRequestId: number;
}

export type PlanTextField = "goal" | "materials" | "understandingChecks";
export type PhaseField = "activity" | "minutes";

export type WorkflowAction =
  | { type: "formChanged"; field: ConditionsField; value: string }
  | { type: "conditionsInvalid"; errors: FieldErrors }
  | { type: "conditionsConfirmed"; conditions: LessonConditions }
  | { type: "changeConditionsRequested" }
  | { type: "goalsRequested" }
  | {
      type: "goalsResolved";
      requestId: number;
      result: ApiResult<GoalCandidatesResponse>;
    }
  | { type: "candidateSelected"; candidateId: string }
  | { type: "goalTextChanged"; value: string }
  | { type: "goalConfirmedChanged"; confirmed: boolean }
  | { type: "planRequested" }
  | {
      type: "planResolved";
      requestId: number;
      result: ApiResult<LessonPlanResponse>;
    }
  | { type: "changeGoalRequested" }
  | { type: "regenerateRequested" }
  | { type: "planTextChanged"; field: PlanTextField; value: string }
  | {
      type: "phaseChanged";
      phase: PhaseKey;
      field: PhaseField;
      value: string;
    }
  | { type: "discardConfirmed" }
  | { type: "discardCancelled" };

export const EMPTY_FORM: ConditionsFormInput = {
  unitMode: "catalog",
  unitId: "",
  customUnitName: "",
  totalLessons: "",
  lessonNumber: "",
  durationMinutes: "",
};

const IDLE_GOALS: GoalsState = {
  status: "idle",
  requestId: 0,
  candidates: [],
  error: null,
};

const IDLE_PLAN: PlanState = {
  status: "idle",
  requestId: 0,
  goal: null,
  editable: null,
  edited: false,
  error: null,
};

export const initialWorkflowState: WorkflowState = {
  form: EMPTY_FORM,
  fieldErrors: {},
  conditions: null,
  goals: IDLE_GOALS,
  selectedCandidateId: null,
  goalText: "",
  goalConfirmed: false,
  plan: IDLE_PLAN,
  pendingDiscard: null,
  lastRequestId: 0,
};

/** The confirmed goal text, trimmed; empty when not usable. */
export function usableGoal(state: WorkflowState): string {
  return state.goalConfirmed ? state.goalText.trim() : "";
}

/** Why the plan cannot be generated yet, or null when it can. */
export function planBlockReason(state: WorkflowState): string | null {
  if (!state.conditions) return "授業条件を確定してください。";
  if (state.goalText.trim() === "") return "本時の目標を入力してください。";
  if (!state.goalConfirmed)
    return "「この目標を確認しました」にチェックしてください。";
  return null;
}

/** True when the goal step is locked because a plan request was made. */
export function isGoalLocked(state: WorkflowState): boolean {
  return state.plan.status !== "idle";
}

/** Anything the teacher would lose on reload. Used for the leave warning. */
export function hasEnteredContent(state: WorkflowState): boolean {
  const formTouched = (
    Object.keys(EMPTY_FORM) as (keyof ConditionsFormInput)[]
  ).some((key) => state.form[key] !== EMPTY_FORM[key]);
  return (
    formTouched ||
    state.conditions !== null ||
    state.goalText !== "" ||
    state.plan.editable !== null
  );
}

function hasGoalStepContent(state: WorkflowState): boolean {
  return (
    state.goals.status === "ready" ||
    state.goalText !== "" ||
    state.plan.editable !== null
  );
}

function startGoals(state: WorkflowState): WorkflowState {
  const requestId = state.lastRequestId + 1;
  return {
    ...state,
    lastRequestId: requestId,
    goals: { status: "loading", requestId, candidates: [], error: null },
  };
}

function startPlan(state: WorkflowState, goal: string): WorkflowState {
  const requestId = state.lastRequestId + 1;
  return {
    ...state,
    lastRequestId: requestId,
    plan: { ...IDLE_PLAN, status: "loading", requestId, goal },
  };
}

/** Bumps the id counter so any in-flight response becomes stale. */
function invalidateRequests(state: WorkflowState): WorkflowState {
  return { ...state, lastRequestId: state.lastRequestId + 1 };
}

function resetDownstreamOfConditions(state: WorkflowState): WorkflowState {
  return invalidateRequests({
    ...state,
    conditions: null,
    goals: IDLE_GOALS,
    selectedCandidateId: null,
    goalText: "",
    goalConfirmed: false,
    plan: IDLE_PLAN,
    pendingDiscard: null,
  });
}

function resetPlan(state: WorkflowState): WorkflowState {
  return invalidateRequests({
    ...state,
    plan: IDLE_PLAN,
    goalConfirmed: false,
    pendingDiscard: null,
  });
}

function updateEditable(
  state: WorkflowState,
  update: (plan: EditablePlan) => EditablePlan,
): WorkflowState {
  if (state.plan.status !== "ready" || !state.plan.editable) return state;
  return {
    ...state,
    plan: {
      ...state.plan,
      editable: update(state.plan.editable),
      edited: true,
    },
  };
}

export function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction,
): WorkflowState {
  switch (action.type) {
    case "formChanged": {
      if (state.conditions) return state;
      const fieldErrors = { ...state.fieldErrors };
      delete fieldErrors[action.field];
      if (action.field === "unitMode") {
        delete fieldErrors.unitId;
        delete fieldErrors.customUnitName;
      }
      const value =
        action.field === "unitMode"
          ? action.value === "custom"
            ? "custom"
            : "catalog"
          : action.value;
      return {
        ...state,
        form: { ...state.form, [action.field]: value },
        fieldErrors,
      };
    }

    case "conditionsInvalid":
      if (state.conditions) return state;
      return { ...state, fieldErrors: action.errors };

    case "conditionsConfirmed":
      if (state.conditions) return state;
      return startGoals({
        ...state,
        conditions: action.conditions,
        fieldErrors: {},
        selectedCandidateId: null,
        goalText: "",
        goalConfirmed: false,
        plan: IDLE_PLAN,
      });

    case "changeConditionsRequested":
      if (!state.conditions || state.pendingDiscard) return state;
      if (hasGoalStepContent(state)) {
        return { ...state, pendingDiscard: "conditions" };
      }
      return resetDownstreamOfConditions(state);

    case "goalsRequested":
      if (!state.conditions || state.goals.status === "loading") return state;
      if (isGoalLocked(state)) return state;
      return startGoals(state);

    case "goalsResolved": {
      const { goals } = state;
      if (goals.status !== "loading" || action.requestId !== goals.requestId)
        return state;
      if (!action.result.ok) {
        if (action.result.kind === "aborted") return state;
        return {
          ...state,
          goals: {
            ...goals,
            status: "error",
            error: { kind: action.result.kind, message: action.result.message },
          },
        };
      }
      return {
        ...state,
        goals: {
          ...goals,
          status: "ready",
          candidates: action.result.data.candidates,
          error: null,
        },
      };
    }

    case "candidateSelected": {
      if (isGoalLocked(state)) return state;
      const candidate = state.goals.candidates.find(
        (c) => c.id === action.candidateId,
      );
      if (!candidate) return state;
      return {
        ...state,
        selectedCandidateId: candidate.id,
        goalText: candidate.text,
        goalConfirmed: false,
      };
    }

    case "goalTextChanged":
      if (isGoalLocked(state) || !state.conditions) return state;
      return { ...state, goalText: action.value, goalConfirmed: false };

    case "goalConfirmedChanged":
      if (isGoalLocked(state)) return state;
      if (action.confirmed && state.goalText.trim() === "") return state;
      return { ...state, goalConfirmed: action.confirmed };

    case "planRequested": {
      if (state.plan.status === "loading" || state.pendingDiscard) return state;
      if (planBlockReason(state) !== null) return state;
      // A ready plan is only replaced through "regenerateRequested".
      if (state.plan.status === "ready") return state;
      return startPlan(state, state.plan.goal ?? state.goalText.trim());
    }

    case "planResolved": {
      const { plan } = state;
      if (plan.status !== "loading" || action.requestId !== plan.requestId)
        return state;
      if (!action.result.ok) {
        if (action.result.kind === "aborted") return state;
        return {
          ...state,
          plan: {
            ...plan,
            status: "error",
            error: { kind: action.result.kind, message: action.result.message },
          },
        };
      }
      return {
        ...state,
        plan: {
          ...plan,
          status: "ready",
          editable: toEditablePlan(action.result.data.plan),
          edited: false,
          error: null,
        },
      };
    }

    case "changeGoalRequested":
      if (!isGoalLocked(state) || state.pendingDiscard) return state;
      if (state.plan.editable) return { ...state, pendingDiscard: "goal" };
      return resetPlan(state);

    case "regenerateRequested":
      if (state.plan.status !== "ready" || state.pendingDiscard) return state;
      if (state.plan.edited) return { ...state, pendingDiscard: "regenerate" };
      return startPlan(state, state.plan.goal ?? state.goalText.trim());

    case "planTextChanged":
      return updateEditable(state, (plan) => ({
        ...plan,
        [action.field]: action.value,
      }));

    case "phaseChanged":
      return updateEditable(state, (plan) => ({
        ...plan,
        [action.phase]: { ...plan[action.phase], [action.field]: action.value },
      }));

    case "discardConfirmed":
      switch (state.pendingDiscard) {
        case "conditions":
          return resetDownstreamOfConditions(state);
        case "goal":
          return resetPlan(state);
        case "regenerate":
          return startPlan(
            { ...state, pendingDiscard: null },
            state.plan.goal ?? state.goalText.trim(),
          );
        default:
          return state;
      }

    case "discardCancelled":
      if (!state.pendingDiscard) return state;
      return { ...state, pendingDiscard: null };

    default:
      return state;
  }
}
