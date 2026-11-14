"use client";

import { PHASE_LABELS } from "@/lib/lesson/plan-format";
import type { TimeCheck } from "@/lib/lesson/types";

function statusText(check: TimeCheck): { icon: string; text: string } {
  switch (check.status) {
    case "match":
      return { icon: "✓", text: "一致：合計が授業時間と同じです。" };
    case "under":
      return {
        icon: "▲",
        text: `不足（${-(check.difference ?? 0)}分）：合計が授業時間より短くなっています。`,
      };
    case "over":
      return {
        icon: "▲",
        text: `超過（${check.difference ?? 0}分）：合計が授業時間を超えています。`,
      };
    case "invalid":
      return {
        icon: "✕",
        text: `数値として不正な欄あり（${check.invalidPhases
          .map((key) => PHASE_LABELS[key])
          .join("・")}）：分は0〜999の整数で入力してください。`,
      };
  }
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

/** Live comparison of phase minutes with the lesson duration. Never auto-corrects. */
export function TimeSummary({ check }: { check: TimeCheck }) {
  const { icon, text } = statusText(check);
  return (
    <div className={`time-summary status-${check.status}`}>
      <dl className="time-figures">
        <div>
          <dt>合計</dt>
          <dd>
            {check.total === null ? "計算できません" : `${check.total}分`}
          </dd>
        </div>
        <div>
          <dt>授業時間</dt>
          <dd>{check.durationMinutes}分</dd>
        </div>
        <div>
          <dt>差</dt>
          <dd>
            {check.difference === null ? "—" : `${signed(check.difference)}分`}
          </dd>
        </div>
      </dl>
      <p
        className="time-status"
        role="status"
        aria-live="polite"
        data-status={check.status}
      >
        <span aria-hidden="true" className="status-icon">
          {icon}
        </span>{" "}
        {text}
      </p>
      <p className="hint">
        自動では修正しません。時間配分と内容を確認してください。
      </p>
    </div>
  );
}
