import { LIMITS } from "../../../../lib/lesson/limits.ts";
import { mockLessonPlan } from "../../../../lib/lesson/mock.ts";
import {
  parseLessonPlanRequest,
  parseLessonPlanResponse,
} from "../../../../lib/lesson/schema.ts";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: HEADERS });
}

/** Fixed-template mock. Request bodies are validated and never logged or stored. */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > LIMITS.requestBodyMaxBytes) {
    return error(413, "リクエストが大きすぎます。");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return error(400, "リクエストを読み取れませんでした。");
  }
  if (new TextEncoder().encode(text).byteLength > LIMITS.requestBodyMaxBytes) {
    return error(413, "リクエストが大きすぎます。");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "リクエストの形式が正しくありません。");
  }
  const parsed = parseLessonPlanRequest(body);
  if (!parsed.ok) {
    return error(400, "授業条件または本時の目標の内容が正しくありません。");
  }
  const output = parseLessonPlanResponse({
    source: "mock",
    plan: mockLessonPlan(parsed.value.conditions, parsed.value.goal),
  });
  if (!output.ok) {
    return error(500, "授業案のたたき台を作成できませんでした。");
  }
  return Response.json(output.value, { status: 200, headers: HEADERS });
}
