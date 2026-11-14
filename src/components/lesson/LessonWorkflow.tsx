"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import {
  requestGoalCandidates,
  requestLessonPlan,
} from "@/lib/lesson/api-client";
import {
  hasEnteredContent,
  initialWorkflowState,
  workflowReducer,
} from "@/lib/lesson/workflow";
import { ConditionsStep } from "./ConditionsStep";
import { GoalStep } from "./GoalStep";
import { PlanStep } from "./PlanStep";

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
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="workflow">
      <section className="step" aria-labelledby="step-conditions-heading">
        <h2 id="step-conditions-heading" tabIndex={-1}>
          1. 授業条件
        </h2>
        <ConditionsStep
          state={state}
          dispatch={dispatch}
          focusLater={focusLater}
        />
      </section>
      <section className="step" aria-labelledby="step-goal-heading">
        <h2 id="step-goal-heading" tabIndex={-1}>
          2. 本時の目標
        </h2>
        <GoalStep state={state} dispatch={dispatch} focusLater={focusLater} />
      </section>
      <section className="step" aria-labelledby="step-plan-heading">
        <h2 id="step-plan-heading" tabIndex={-1}>
          3. 授業案のたたき台
        </h2>
        <PlanStep state={state} dispatch={dispatch} focusLater={focusLater} />
      </section>
    </div>
  );
}
