"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import {
  requestGoalCandidates,
  requestLessonPlan,
} from "@/lib/lesson/api-client";
import {
  hasEnteredContent,
  initialWorkflowState,
  workflowReducer,
  type DiscardKind,
  type RequestStatus,
  type WorkflowAction,
  type WorkflowState,
} from "@/lib/lesson/workflow";
import { ConditionsStep } from "./ConditionsStep";
import { DiscardDialog } from "./DiscardDialog";
import { candidateInputId, GoalStep } from "./GoalStep";
import { PlanStep } from "./PlanStep";

interface DialogConfig {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Element that opened the dialog; focus returns here on cancel. */
  triggerId: string;
  /** Where focus goes after discarding. */
  afterConfirmId: string;
}

function dialogConfig(kind: DiscardKind, state: WorkflowState): DialogConfig {
  switch (kind) {
    case "conditions":
      return {
        title: "条件を変更しますか？",
        message:
          "条件を変更すると、目標候補・入力した目標・授業案（編集内容を含む）を破棄します。",
        confirmLabel: "破棄して条件を変更",
        triggerId: "change-conditions",
        afterConfirmId: "field-unitMode-catalog",
      };
    case "goal":
      return {
        title: "目標を変更しますか？",
        message: "目標を変更すると、授業案（編集内容を含む）を破棄します。",
        confirmLabel: "破棄して目標を変更",
        triggerId: "change-goal",
        afterConfirmId: "field-goal",
      };
    case "regenerate":
      return {
        title: "授業案を作り直しますか？",
        message: "作り直すと、授業案に加えた編集内容を破棄します。",
        confirmLabel: "編集内容を破棄して作り直す",
        triggerId: "regenerate-plan",
        afterConfirmId: "step-plan-heading",
      };
    case "candidate": {
      const fallback = state.goals.candidates[0]?.id ?? "";
      return {
        title: "入力した目標を候補で置き換えますか？",
        message:
          "本時の目標の欄には、候補から書き換えた（または直接入力した）内容があります。置き換えると、その内容を破棄します。",
        confirmLabel: "破棄して候補に置き換える",
        cancelLabel: "入力した目標を保持",
        triggerId: candidateInputId(state.selectedCandidateId ?? fallback),
        afterConfirmId: candidateInputId(state.pendingCandidateId ?? fallback),
      };
    }
  }
}

/** Moves focus to a persistent element when a request settles. */
function useFocusOnSettle(
  status: RequestStatus,
  targetId: string,
  scopeId: string,
) {
  const previous = useRef(status);
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (was !== "loading" || (status !== "ready" && status !== "error")) return;
    // Only when focus was lost or is still inside this step.
    const active = document.activeElement;
    const scope = document.getElementById(scopeId);
    if (
      !active ||
      active === document.body ||
      (scope !== null && scope.contains(active))
    ) {
      document.getElementById(targetId)?.focus();
    }
  }, [status, targetId, scopeId]);
}

/**
 * Whole conditions → goal → plan flow. State lives only in React memory;
 * nothing is written to browser storage.
 */
export function LessonWorkflow() {
  const [state, dispatch] = useReducer(workflowReducer, initialWorkflowState);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const focusLater = useCallback((id: string) => setFocusTarget(id), []);

  useEffect(() => {
    if (!focusTarget) return;
    document.getElementById(focusTarget)?.focus();
    setFocusTarget(null);
  }, [focusTarget, state]);

  useFocusOnSettle(state.goals.status, "step-goal-heading", "step-goal");
  useFocusOnSettle(state.plan.status, "plan-status", "step-plan");

  const { conditions } = state;

  // Goal candidates: one request per request id; cleanup aborts stale ones.
  const goalsRequestId =
    state.goals.status === "loading" ? state.goals.requestId : null;
  useEffect(() => {
    if (goalsRequestId === null || !conditions) return;
    const controller = new AbortController();
    void requestGoalCandidates(conditions, {
      signal: controller.signal,
    }).then((result) =>
      dispatch({ type: "goalsResolved", requestId: goalsRequestId, result }),
    );
    return () => controller.abort();
  }, [goalsRequestId, conditions]);

  const planRequestId =
    state.plan.status === "loading" ? state.plan.requestId : null;
  const planGoal = state.plan.goal;
  useEffect(() => {
    if (planRequestId === null || !conditions || !planGoal) return;
    const controller = new AbortController();
    void requestLessonPlan(conditions, planGoal, {
      signal: controller.signal,
    }).then((result) =>
      dispatch({ type: "planResolved", requestId: planRequestId, result }),
    );
    return () => controller.abort();
  }, [planRequestId, conditions, planGoal]);

  // Ask the browser for its leave warning; browsers may not show it.
  const dirty = hasEnteredContent(state);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only react to returnValue.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const confirming = state.pendingDiscard !== null;

  return (
    <>
      <div className="workflow" inert={confirming}>
        <section
          className="step"
          id="step-conditions"
          aria-labelledby="step-conditions-heading"
        >
          <h2 id="step-conditions-heading" tabIndex={-1}>
            1. 授業条件
          </h2>
          <ConditionsStep
            state={state}
            dispatch={dispatch}
            focusLater={focusLater}
          />
        </section>
        <section
          className="step"
          id="step-goal"
          aria-labelledby="step-goal-heading"
        >
          <h2 id="step-goal-heading" tabIndex={-1}>
            2. 本時の目標
          </h2>
          <GoalStep state={state} dispatch={dispatch} focusLater={focusLater} />
        </section>
        <section
          className="step"
          id="step-plan"
          aria-labelledby="step-plan-heading"
        >
          <h2 id="step-plan-heading" tabIndex={-1}>
            3. 授業案のたたき台
          </h2>
          <PlanStep state={state} dispatch={dispatch} />
        </section>
      </div>
      {state.pendingDiscard && (
        <PendingDialog
          kind={state.pendingDiscard}
          state={state}
          dispatch={dispatch}
          focusLater={focusLater}
        />
      )}
    </>
  );
}

function PendingDialog({
  kind,
  state,
  dispatch,
  focusLater,
}: {
  kind: DiscardKind;
  state: WorkflowState;
  dispatch: Dispatch<WorkflowAction>;
  focusLater: (id: string) => void;
}) {
  const config = dialogConfig(kind, state);
  return (
    <DiscardDialog
      key={kind}
      title={config.title}
      message={config.message}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      onConfirm={() => {
        dispatch({ type: "discardConfirmed" });
        focusLater(config.afterConfirmId);
      }}
      onCancel={() => {
        dispatch({ type: "discardCancelled" });
        focusLater(config.triggerId);
      }}
    />
  );
}
