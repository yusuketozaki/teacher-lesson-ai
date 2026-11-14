"use client";

import { useRef, type Dispatch } from "react";
import { LIMITS } from "@/lib/lesson/limits";
import {
  isGoalLocked,
  type WorkflowAction,
  type WorkflowState,
} from "@/lib/lesson/workflow";
import { DiscardDialog } from "./DiscardDialog";
import { PrivacyHint } from "./SafetyNotices";

interface GoalStepProps {
  state: WorkflowState;
  dispatch: Dispatch<WorkflowAction>;
  focusLater: (id: string) => void;
}

export function GoalStep({ state, dispatch, focusLater }: GoalStepProps) {
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const { goals } = state;

  if (!state.conditions) {
    return <p className="placeholder">授業条件を確定すると表示されます。</p>;
  }

  if (isGoalLocked(state)) {
    return (
      <div>
        <p className="label-text">授業案の作成に使った目標（確認済み）</p>
        <p className="locked-goal">{state.plan.goal}</p>
        <button
          type="button"
          ref={changeButtonRef}
          onClick={() => {
            dispatch({ type: "changeGoalRequested" });
            if (!state.plan.editable) focusLater("field-goal");
          }}
        >
          目標を変更
        </button>
        {state.pendingDiscard === "goal" && (
          <DiscardDialog
            title="目標を変更しますか？"
            message="目標を変更すると、授業案（編集内容を含む）を破棄します。"
            confirmLabel="破棄して目標を変更"
            onConfirm={() => {
              dispatch({ type: "discardConfirmed" });
              focusLater("field-goal");
            }}
            onCancel={() => {
              dispatch({ type: "discardCancelled" });
              changeButtonRef.current?.focus();
            }}
          />
        )}
      </div>
    );
  }

  const goalEmpty = state.goalText.trim() === "";

  return (
    <div>
      <div className="candidates" aria-busy={goals.status === "loading"}>
        {goals.status === "loading" && (
          <p role="status" className="loading">
            目標候補を取得しています…
          </p>
        )}
        {goals.status === "error" && goals.error && (
          <div className="error-box" role="alert">
            <p>
              <span aria-hidden="true">✕ </span>目標候補を取得できませんでした。
              {goals.error.message}
            </p>
            <button
              type="button"
              onClick={() => dispatch({ type: "goalsRequested" })}
            >
              再試行
            </button>
          </div>
        )}
        {goals.status === "ready" && goals.candidates.length === 0 && (
          <p role="status">候補がありません。目標を直接入力してください。</p>
        )}
        {goals.status === "ready" && goals.candidates.length > 0 && (
          <fieldset>
            <legend>
              目標候補 <span className="tag">mock 候補（教員確認前の案）</span>
            </legend>
            {goals.candidates.map((candidate) => (
              <label className="choice candidate" key={candidate.id}>
                <input
                  type="radio"
                  name="goalCandidate"
                  value={candidate.id}
                  checked={state.selectedCandidateId === candidate.id}
                  onChange={() =>
                    dispatch({
                      type: "candidateSelected",
                      candidateId: candidate.id,
                    })
                  }
                />
                <span>{candidate.text}</span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <div className="field">
        <label htmlFor="field-goal">本時の目標</label>
        <p className="hint" id="hint-goal">
          候補を選ぶとここに入ります。直接入力・修正もできます（
          {LIMITS.goalMaxLength}文字以内・上限は暫定）。
        </p>
        <PrivacyHint id="privacy-goal" />
        <textarea
          id="field-goal"
          rows={3}
          value={state.goalText}
          maxLength={LIMITS.goalMaxLength}
          aria-describedby="hint-goal privacy-goal"
          onChange={(e) =>
            dispatch({ type: "goalTextChanged", value: e.target.value })
          }
        />
      </div>

      <div className="field">
        <label className="choice">
          <input
            type="checkbox"
            id="field-goal-confirmed"
            checked={state.goalConfirmed}
            disabled={goalEmpty}
            aria-describedby="hint-goal-confirmed"
            onChange={(e) =>
              dispatch({
                type: "goalConfirmedChanged",
                confirmed: e.target.checked,
              })
            }
          />
          この目標を確認しました
        </label>
        <p className="hint" id="hint-goal-confirmed">
          {goalEmpty
            ? "目標を入力すると確認できます。"
            : "目標を書き換えると、確認のチェックは外れます。"}
        </p>
      </div>
    </div>
  );
}
