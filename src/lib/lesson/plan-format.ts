import { parsePhaseMinutes } from "./time-check.ts";
import {
  GRADE_LABEL,
  SUBJECT_LABEL,
  type EditablePlan,
  type LessonConditions,
  type LessonPlan,
  type PhaseKey,
  type TimeCheck,
} from "./types.ts";

export function toEditablePlan(plan: LessonPlan): EditablePlan {
  return {
    goal: plan.goal,
    introduction: {
      activity: plan.introduction.activity,
      minutes: String(plan.introduction.minutes),
    },
    development: {
      activity: plan.development.activity,
      minutes: String(plan.development.minutes),
    },
    summary: {
      activity: plan.summary.activity,
      minutes: String(plan.summary.minutes),
    },
    materials: plan.materials.join("\n"),
    understandingChecks: plan.understandingChecks.join("\n"),
    reviewNotice: plan.reviewNotice,
  };
}

/** Split multi-line text into trimmed, non-empty items. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export const PHASE_LABELS: Record<PhaseKey, string> = {
  introduction: "導入",
  development: "展開",
  summary: "まとめ",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** One-line description of the time check, plus a warning sentence when needed. */
export function describeTimeCheck(check: TimeCheck): string {
  if (check.status === "invalid") {
    const phases = check.invalidPhases.map((k) => PHASE_LABELS[k]).join("・");
    return `時間配分: 合計を計算できません（授業時間 ${check.durationMinutes}分）。※${phases}の分数が0〜999の整数ではありません。確認してください。`;
  }
  const base = `時間配分: 合計 ${check.total}分 / 授業時間 ${check.durationMinutes}分 / 差 ${signed(check.difference ?? 0)}分`;
  if (check.status === "under") {
    return `${base}。※合計が授業時間より短くなっています。確認してください。`;
  }
  if (check.status === "over") {
    return `${base}。※合計が授業時間を超えています。確認してください。`;
  }
  return base;
}

const BLANK = "（未記入）";

function orBlank(text: string): string {
  return text.trim() === "" ? BLANK : text;
}

function bullets(text: string): string[] {
  const items = splitLines(text);
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${BLANK}`];
}

/** Plain-text export using the teacher's current edited values verbatim. */
export function formatPlanForCopy(
  conditions: LessonConditions,
  plan: EditablePlan,
  check: TimeCheck,
): string {
  const phaseLine = (key: PhaseKey) => {
    const phase = plan[key];
    const minutes = phase.minutes.trim();
    const label =
      minutes === ""
        ? "分数未記入"
        : parsePhaseMinutes(minutes) !== null
          ? `${minutes}分`
          : minutes;
    return `【${PHASE_LABELS[key]}】（${label}）\n${orBlank(phase.activity)}`;
  };
  return [
    "授業案 たたき台（mock 出力・教員確認前）",
    "",
    `学年・教科: ${GRADE_LABEL} ${SUBJECT_LABEL}`,
    `単元: ${conditions.unitName}`,
    `本時: 全${conditions.totalLessons}時間中${conditions.lessonNumber}時間目`,
    `授業時間: ${conditions.durationMinutes}分`,
    "",
    "本時の目標:",
    orBlank(plan.goal),
    "",
    phaseLine("introduction"),
    "",
    phaseLine("development"),
    "",
    phaseLine("summary"),
    "",
    describeTimeCheck(check),
    "",
    "準備物:",
    ...bullets(plan.materials),
    "",
    "理解状況の確認方法:",
    ...bullets(plan.understandingChecks),
    "",
    "注意書き:",
    plan.reviewNotice,
    "",
    "※コピー先での保存・共有はこのアプリの管理外です。",
  ].join("\n");
}
