"use client";

import type { Dispatch } from "react";
import { LIMITS } from "@/lib/lesson/limits";
import { formatPlanForCopy, PHASE_LABELS } from "@/lib/lesson/plan-format";
import { checkTimeAllocation, PHASE_KEYS } from "@/lib/lesson/time-check";
import type {
  EditablePlan,
  LessonConditions,
  PhaseKey,
} from "@/lib/lesson/types";
import {
  planBlockReason,
  type WorkflowAction,
  type WorkflowState,
} from "@/lib/lesson/workflow";
import { CopyPanel } from "./CopyPanel";
import { PrivacyHint } from "./SafetyNotices";
import { TimeSummary } from "./TimeSummary";

interface PlanStepProps {
  state: WorkflowState;
  dispatch: Dispatch<WorkflowAction>;
}

export function PlanStep({ state, dispatch }: PlanStepProps) {
  const { plan, conditions } = state;

  if (!conditions) {
    return <p className="placeholder">授業条件を確定すると表示されます。</p>;
  }

  if (plan.status === "idle") {
    const reason = planBlockReason(state);
    return (
      <div>
        <button
          type="button"
          className="primary"
          disabled={reason !== null}
          aria-describedby={reason ? "plan-block-reason" : undefined}
          onClick={() => dispatch({ type: "planRequested" })}
        >
          授業案のたたき台を作成
        </button>
        {reason && (
          <p className="hint" id="plan-block-reason">
            まだ作成できません：{reason}
          </p>
        )}
      </div>
    );
  }

  if (plan.status === "loading") {
    return (
      <div aria-busy="true">
        <button type="button" className="primary" disabled>
          作成中…
        </button>
        <p role="status" className="loading" id="plan-status" tabIndex={-1}>
          授業案のたたき台を作成しています…
        </p>
      </div>
    );
  }

  if (plan.status === "error" || !plan.editable) {
    return (
      <div className="error-box" role="alert">
        <p id="plan-status" tabIndex={-1}>
          <span aria-hidden="true">✕ </span>
          授業案を作成できませんでした。{plan.error?.message}
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: "planRequested" })}
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="draft-label" id="plan-status" tabIndex={-1}>
        <span className="badge">たたき台（mock・教員確認前）</span>
      </p>
      <p className="review-notice" role="note">
        {plan.editable.reviewNotice}
      </p>
      <div className="button-row">
        <button
          type="button"
          id="regenerate-plan"
          onClick={() => dispatch({ type: "regenerateRequested" })}
        >
          授業案を作り直す
        </button>
      </div>
      <PlanEditor
        conditions={conditions}
        editable={plan.editable}
        dispatch={dispatch}
        key={plan.requestId}
      />
    </div>
  );
}

function PlanEditor({
  conditions,
  editable,
  dispatch,
}: {
  conditions: LessonConditions;
  editable: EditablePlan;
  dispatch: Dispatch<WorkflowAction>;
}) {
  const check = checkTimeAllocation(conditions.durationMinutes, {
    introduction: editable.introduction.minutes,
    development: editable.development.minutes,
    summary: editable.summary.minutes,
  });
  const copyText = formatPlanForCopy(conditions, editable, check);
  const invalid = new Set<PhaseKey>(check.invalidPhases);

  return (
    <div className="plan-editor">
      <PrivacyHint id="privacy-plan" />

      <div className="field">
        <label htmlFor="plan-goal">本時の目標</label>
        <textarea
          id="plan-goal"
          rows={3}
          maxLength={LIMITS.goalMaxLength}
          value={editable.goal}
          aria-describedby="privacy-plan"
          onChange={(e) =>
            dispatch({
              type: "planTextChanged",
              field: "goal",
              value: e.target.value,
            })
          }
        />
      </div>

      {PHASE_KEYS.map((key) => (
        <fieldset className="phase" key={key}>
          <legend>
            <h3>{PHASE_LABELS[key]}</h3>
          </legend>
          <div className="field">
            <label htmlFor={`plan-${key}-activity`}>
              {PHASE_LABELS[key]}の活動
            </label>
            <textarea
              id={`plan-${key}-activity`}
              rows={4}
              maxLength={LIMITS.activityMaxLength}
              value={editable[key].activity}
              onChange={(e) =>
                dispatch({
                  type: "phaseChanged",
                  phase: key,
                  field: "activity",
                  value: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor={`plan-${key}-minutes`}>
              {PHASE_LABELS[key]}の時間（分）
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="short"
              id={`plan-${key}-minutes`}
              value={editable[key].minutes}
              autoComplete="off"
              aria-invalid={invalid.has(key) ? true : undefined}
              aria-describedby={
                invalid.has(key) ? `plan-${key}-minutes-error` : undefined
              }
              onChange={(e) =>
                dispatch({
                  type: "phaseChanged",
                  phase: key,
                  field: "minutes",
                  value: e.target.value,
                })
              }
            />
            {invalid.has(key) && (
              <p className="field-error" id={`plan-${key}-minutes-error`}>
                <span aria-hidden="true">✕ </span>
                0〜999の整数で入力してください。
              </p>
            )}
          </div>
        </fieldset>
      ))}

      <section className="subsection" aria-labelledby="time-heading">
        <h3 id="time-heading">時間配分の確認</h3>
        <TimeSummary check={check} />
      </section>

      <div className="field">
        <label htmlFor="plan-materials">準備物（1行に1つ）</label>
        <textarea
          id="plan-materials"
          rows={4}
          maxLength={LIMITS.listTextMaxLength}
          value={editable.materials}
          onChange={(e) =>
            dispatch({
              type: "planTextChanged",
              field: "materials",
              value: e.target.value,
            })
          }
        />
      </div>

      <div className="field">
        <label htmlFor="plan-checks">理解状況の確認方法（1行に1つ）</label>
        <textarea
          id="plan-checks"
          rows={4}
          maxLength={LIMITS.listTextMaxLength}
          value={editable.understandingChecks}
          onChange={(e) =>
            dispatch({
              type: "planTextChanged",
              field: "understandingChecks",
              value: e.target.value,
            })
          }
        />
      </div>

      <section className="subsection" aria-labelledby="copy-heading">
        <h3 id="copy-heading">コピーして持ち出す</h3>
        <CopyPanel text={copyText} />
      </section>
    </div>
  );
}
