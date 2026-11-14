"use client";

import { useRef, type Dispatch, type FormEvent } from "react";
import { CATALOG_NOTICE, UNIT_CATALOG } from "@/lib/lesson/catalog";
import { validateConditions } from "@/lib/lesson/conditions";
import { LIMITS } from "@/lib/lesson/limits";
import {
  GRADE_LABEL,
  SUBJECT_LABEL,
  type ConditionsField,
} from "@/lib/lesson/types";
import type { WorkflowAction, WorkflowState } from "@/lib/lesson/workflow";
import { DiscardDialog } from "./DiscardDialog";
import { PrivacyHint } from "./SafetyNotices";

interface ConditionsStepProps {
  state: WorkflowState;
  dispatch: Dispatch<WorkflowAction>;
  focusLater: (id: string) => void;
}

export const fieldId = (field: ConditionsField) => `field-${field}`;
const errorId = (field: ConditionsField) => `error-${field}`;
const hintId = (field: ConditionsField) => `hint-${field}`;

const FIELD_ORDER: ConditionsField[] = [
  "unitMode",
  "unitId",
  "customUnitName",
  "totalLessons",
  "lessonNumber",
  "durationMinutes",
];

function describedBy(field: ConditionsField, hasError: boolean, extra = "") {
  return [hintId(field), hasError ? errorId(field) : "", extra]
    .filter(Boolean)
    .join(" ");
}

function FieldError({
  field,
  message,
}: {
  field: ConditionsField;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p className="field-error" id={errorId(field)}>
      <span aria-hidden="true">✕ </span>
      {message}
    </p>
  );
}

export function ConditionsStep({
  state,
  dispatch,
  focusLater,
}: ConditionsStepProps) {
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const { form, fieldErrors: errors, conditions } = state;

  function change(field: ConditionsField, value: string) {
    dispatch({ type: "formChanged", field, value });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateConditions(form);
    if (result.ok) {
      dispatch({ type: "conditionsConfirmed", conditions: result.conditions });
      focusLater("step-goal-heading");
      return;
    }
    dispatch({ type: "conditionsInvalid", errors: result.errors });
    const first = FIELD_ORDER.find((field) => result.errors[field]);
    if (first) {
      const target =
        first === "unitMode" ? "field-unitMode-catalog" : fieldId(first);
      document.getElementById(target)?.focus();
    }
  }

  function requestChange() {
    dispatch({ type: "changeConditionsRequested" });
    if (state.goals.status !== "ready" && state.goalText === "") {
      focusLater("field-unitMode-catalog");
    }
  }

  if (conditions) {
    return (
      <div>
        <dl className="summary-list">
          <div>
            <dt>学年・教科</dt>
            <dd>
              {GRADE_LABEL} {SUBJECT_LABEL}
            </dd>
          </div>
          <div>
            <dt>単元</dt>
            <dd>
              {conditions.unitName}
              {conditions.unitSource === "custom" ? "（候補にない単元）" : ""}
            </dd>
          </div>
          <div>
            <dt>本時</dt>
            <dd>
              全{conditions.totalLessons}時間中 {conditions.lessonNumber}
              時間目
            </dd>
          </div>
          <div>
            <dt>授業時間</dt>
            <dd>{conditions.durationMinutes}分</dd>
          </div>
        </dl>
        <button type="button" ref={changeButtonRef} onClick={requestChange}>
          条件を変更
        </button>
        {state.pendingDiscard === "conditions" && (
          <DiscardDialog
            title="条件を変更しますか？"
            message="条件を変更すると、目標候補・確認済みの目標・授業案（編集内容を含む）を破棄します。"
            confirmLabel="破棄して条件を変更"
            onConfirm={() => {
              dispatch({ type: "discardConfirmed" });
              focusLater("field-unitMode-catalog");
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

  return (
    <form noValidate onSubmit={handleSubmit}>
      <dl className="summary-list fixed">
        <div>
          <dt>学年</dt>
          <dd>{GRADE_LABEL}（固定）</dd>
        </div>
        <div>
          <dt>教科</dt>
          <dd>{SUBJECT_LABEL}（固定）</dd>
        </div>
      </dl>

      <fieldset
        className="field"
        aria-describedby={errors.unitMode ? errorId("unitMode") : undefined}
      >
        <legend>単元の指定方法</legend>
        <label className="choice">
          <input
            type="radio"
            name="unitMode"
            id="field-unitMode-catalog"
            value="catalog"
            checked={form.unitMode === "catalog"}
            onChange={() => change("unitMode", "catalog")}
          />
          候補から選ぶ
        </label>
        <label className="choice">
          <input
            type="radio"
            name="unitMode"
            id="field-unitMode-custom"
            value="custom"
            checked={form.unitMode === "custom"}
            onChange={() => change("unitMode", "custom")}
          />
          候補にない単元を追加
        </label>
        <FieldError field="unitMode" message={errors.unitMode} />
      </fieldset>

      {form.unitMode === "catalog" ? (
        <div className="field">
          <label htmlFor={fieldId("unitId")}>単元</label>
          <p className="hint" id={hintId("unitId")}>
            {CATALOG_NOTICE}
          </p>
          <select
            id={fieldId("unitId")}
            value={form.unitId}
            onChange={(e) => change("unitId", e.target.value)}
            aria-invalid={errors.unitId ? true : undefined}
            aria-describedby={describedBy("unitId", !!errors.unitId)}
          >
            <option value="">選択してください</option>
            {UNIT_CATALOG.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          <FieldError field="unitId" message={errors.unitId} />
        </div>
      ) : (
        <div className="field">
          <label htmlFor={fieldId("customUnitName")}>
            単元名（候補にない単元）
          </label>
          <p className="hint" id={hintId("customUnitName")}>
            {LIMITS.unitNameMaxLength}
            文字以内（暫定の上限）。一覧にある単元名は、一覧から選んでください。
          </p>
          <PrivacyHint id="privacy-customUnitName" />
          <input
            type="text"
            id={fieldId("customUnitName")}
            value={form.customUnitName}
            maxLength={LIMITS.unitNameMaxLength}
            autoComplete="off"
            onChange={(e) => change("customUnitName", e.target.value)}
            aria-invalid={errors.customUnitName ? true : undefined}
            aria-describedby={describedBy(
              "customUnitName",
              !!errors.customUnitName,
              "privacy-customUnitName",
            )}
          />
          <FieldError field="customUnitName" message={errors.customUnitName} />
        </div>
      )}

      <div className="field-grid">
        <NumberField
          field="totalLessons"
          label="単元の全時間数"
          hint={`1〜${LIMITS.totalLessonsMax}の整数（上限は暫定）`}
          value={form.totalLessons}
          error={errors.totalLessons}
          onChange={change}
        />
        <NumberField
          field="lessonNumber"
          label="本時（何時間目）"
          hint="1以上、全時間数以下の整数"
          value={form.lessonNumber}
          error={errors.lessonNumber}
          onChange={change}
        />
        <NumberField
          field="durationMinutes"
          label="授業時間（分）"
          hint={`${LIMITS.durationMinutesMin}〜${LIMITS.durationMinutesMax}分の整数（範囲は暫定）`}
          value={form.durationMinutes}
          error={errors.durationMinutes}
          onChange={change}
        />
      </div>

      <button type="submit" className="primary">
        この条件で目標候補を表示
      </button>
    </form>
  );
}

function NumberField({
  field,
  label,
  hint,
  value,
  error,
  onChange,
}: {
  field: ConditionsField;
  label: string;
  hint: string;
  value: string;
  error?: string;
  onChange: (field: ConditionsField, value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={fieldId(field)}>{label}</label>
      <p className="hint" id={hintId(field)}>
        {hint}
      </p>
      <input
        type="text"
        inputMode="numeric"
        id={fieldId(field)}
        className="short"
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(field, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field, !!error)}
      />
      <FieldError field={field} message={error} />
    </div>
  );
}
