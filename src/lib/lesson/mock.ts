/**
 * Fixed-template mock generator. This is NOT an AI model and does not check
 * mathematical correctness, textbooks or the course of study.
 */
import { LIMITS } from "./limits.ts";
import type { GoalCandidate, LessonConditions, LessonPlan } from "./types.ts";

export type LessonPosition = "single" | "first" | "middle" | "last";

export function lessonPosition(c: LessonConditions): LessonPosition {
  if (c.totalLessons === 1) return "single";
  if (c.lessonNumber === 1) return "first";
  if (c.lessonNumber === c.totalLessons) return "last";
  return "middle";
}

const GOAL_TEMPLATES: Record<LessonPosition, readonly string[]> = {
  single: [
    "{unit}について、問題の解き方を考え、自分の言葉で説明できる。",
    "{unit}について、図や式を使って考え、その考えを友達に伝えることができる。",
    "{unit}について学んだことを振り返り、大切だと考えたことをまとめることができる。",
  ],
  first: [
    "{unit}について、これまでに学んだことと比べながら、新しく学ぶことを自分の言葉で説明できる。",
    "{unit}について、考えてみたい問いを見つけ、学習の見通しをもつことができる。",
    "{unit}について、具体的な場面をもとに基本的な考え方を説明できる。",
  ],
  middle: [
    "{unit}について、前の時間に学んだことを使って問題の解き方を考え、説明できる。",
    "{unit}について、図や式を使って考え、その考えを友達に伝えることができる。",
    "{unit}について、いくつかの解き方を比べ、共通点やちがいを説明できる。",
  ],
  last: [
    "{unit}で学んだことを振り返り、大切だと考えたことを自分の言葉でまとめることができる。",
    "{unit}について、学んだことを使って問題に取り組み、解き方を説明できる。",
    "{unit}の学習を通して、できるようになったことと、まだ確かめたいことを整理できる。",
  ],
};

export function mockGoalCandidates(c: LessonConditions): GoalCandidate[] {
  const position = lessonPosition(c);
  return GOAL_TEMPLATES[position]
    .slice(0, LIMITS.goalCandidateCount)
    .map((template, index) => ({
      id: `mock-${position}-${index + 1}`,
      text: template.replace("{unit}", c.unitName),
    }));
}

/** Split a lesson into introduction / development / summary minutes. Sum always equals durationMinutes. */
export function mockPhaseMinutes(durationMinutes: number) {
  const introduction = Math.max(1, Math.round(durationMinutes * 0.15));
  const summary = Math.max(1, Math.round(durationMinutes * 0.2));
  const development = durationMinutes - introduction - summary;
  return { introduction, development, summary };
}

const ACTIVITIES: Record<
  LessonPosition,
  { introduction: string; development: string; summary: string }
> = {
  single: {
    introduction:
      "{unit}に関わる身近な場面を示し、本時で考える問いを確認する。",
    development:
      "一人で考える時間をとったあと、考えを伝え合い、解き方を比べる。教員が考えのちがいを取り上げて整理する。",
    summary: "本時で分かったことを自分の言葉でまとめ、確かめの問題に取り組む。",
  },
  first: {
    introduction:
      "これまでに学んだことを振り返り、{unit}の学習で考えたい問いを確認する。",
    development:
      "具体的な場面をもとに一人で考え、考えを伝え合う。新しく学ぶことと、これまでの学習とのちがいを整理する。",
    summary: "本時で分かったことと、次の時間に考えたいことをノートにまとめる。",
  },
  middle: {
    introduction: "前の時間の学習を振り返り、本時の問いを確認する。",
    development:
      "{unit}の問題に一人で取り組み、図や式を使って考えを説明し合う。いくつかの解き方を比べて整理する。",
    summary: "本時で分かったことをまとめ、確かめの問題に取り組む。",
  },
  last: {
    introduction:
      "{unit}でこれまでに学んだことを振り返り、本時で取り組むことを確認する。",
    development:
      "学んだことを使って問題に取り組み、解き方を説明し合う。つまずきやすい点を全体で確かめる。",
    summary:
      "単元を通して分かったことと、まだ確かめたいことを振り返ってまとめる。",
  },
};

const MATERIALS: Record<LessonPosition, readonly string[]> = {
  single: ["問題を示す掲示物", "ノート", "確かめの問題を印刷したもの"],
  first: ["導入で使う場面の掲示物", "ノート", "学習の見通しを書く用紙"],
  middle: ["問題を示す掲示物", "ノート", "考えを説明するための図をかく用紙"],
  last: ["振り返り用のワークシート", "ノート", "練習問題を印刷したもの"],
};

const UNDERSTANDING_CHECKS: Record<LessonPosition, readonly string[]> = {
  single: [
    "ノートに書かれた考え方や式を見る",
    "確かめの問題の取り組みを見る",
    "まとめの記述を見る",
  ],
  first: [
    "これまでの学習とのちがいをどう説明しているかを聞く",
    "ノートに書かれた考え方を見る",
    "振り返りの記述を見る",
  ],
  middle: [
    "図や式を使った説明を聞く",
    "ノートに書かれた考え方や式を見る",
    "確かめの問題の取り組みを見る",
  ],
  last: [
    "練習問題の取り組みを見る",
    "振り返りの記述を見る",
    "解き方の説明を聞く",
  ],
};

export const MOCK_REVIEW_NOTICE =
  "これは固定テンプレートによる mock のたたき台です。AI による生成ではなく、教科書や学習指導要領との照合も行っていません。使用前に、教員が算数の内容の正確さ、本時の目標と活動の対応、時間配分、学級や児童の実態に合うかを確認・修正してください。";

export function mockLessonPlan(c: LessonConditions, goal: string): LessonPlan {
  const position = lessonPosition(c);
  const minutes = mockPhaseMinutes(c.durationMinutes);
  const activity = ACTIVITIES[position];
  const fill = (text: string) => text.replace("{unit}", c.unitName);
  return {
    goal,
    introduction: {
      activity: fill(activity.introduction),
      minutes: minutes.introduction,
    },
    development: {
      activity: fill(activity.development),
      minutes: minutes.development,
    },
    summary: { activity: fill(activity.summary), minutes: minutes.summary },
    materials: [...MATERIALS[position]],
    understandingChecks: [...UNDERSTANDING_CHECKS[position]],
    reviewNotice: MOCK_REVIEW_NOTICE,
  };
}
