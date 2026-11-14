/**
 * Client for the same-origin mock API routes. No external services are called.
 * Functions never throw; every failure is mapped to an ApiErrorKind.
 */
import { LIMITS } from "./limits.ts";
import {
  parseGoalCandidatesResponse,
  parseLessonPlanResponse,
} from "./schema.ts";
import type {
  ApiErrorKind,
  ApiResult,
  GoalCandidatesResponse,
  LessonConditions,
  LessonPlanResponse,
  ParseResult,
} from "./types.ts";

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  timeout: "応答が時間内に返りませんでした。再試行してください。",
  network: "通信できませんでした。接続を確認して再試行してください。",
  server:
    "サーバーで処理できませんでした。入力内容を確認して再試行してください。",
  invalid_response:
    "応答の形式が正しくないため表示できません。再試行してください。",
  aborted: "リクエストを中止しました。",
};

export const GOAL_CANDIDATES_PATH = "/api/mock/goal-candidates";
export const LESSON_PLAN_PATH = "/api/mock/lesson-plan";

function failure<T>(kind: ApiErrorKind): ApiResult<T> {
  return { ok: false, kind, message: API_ERROR_MESSAGES[kind] };
}

async function postJson<T>(
  path: string,
  body: unknown,
  parse: (v: unknown) => ParseResult<T>,
  opts: RequestOptions = {},
): Promise<ApiResult<T>> {
  const callerSignal = opts.signal;
  if (callerSignal?.aborted) return failure("aborted");

  const fetchImpl: typeof fetch =
    opts.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const controller = new AbortController();
  let stopReason: "aborted" | "timeout" | null = null;
  const onCallerAbort = () => {
    stopReason ??= "aborted";
    controller.abort();
  };
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    stopReason ??= "timeout";
    controller.abort();
  }, opts.timeoutMs ?? LIMITS.requestTimeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      return failure(stopReason ?? "network");
    }
    if (stopReason) return failure(stopReason);
    if (!response.ok) return failure("server");

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return failure(stopReason ?? "invalid_response");
    }
    if (stopReason) return failure(stopReason);

    const parsed = parse(json);
    if (!parsed.ok) return failure("invalid_response");
    return { ok: true, data: parsed.value };
  } catch {
    return failure(stopReason ?? "network");
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

export function requestGoalCandidates(
  conditions: LessonConditions,
  opts?: RequestOptions,
): Promise<ApiResult<GoalCandidatesResponse>> {
  return postJson(
    GOAL_CANDIDATES_PATH,
    { conditions },
    parseGoalCandidatesResponse,
    opts,
  );
}

export function requestLessonPlan(
  conditions: LessonConditions,
  goal: string,
  opts?: RequestOptions,
): Promise<ApiResult<LessonPlanResponse>> {
  return postJson(
    LESSON_PLAN_PATH,
    { conditions, goal },
    parseLessonPlanResponse,
    opts,
  );
}
