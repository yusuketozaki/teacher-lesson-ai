import { expect, test, type Page } from "@playwright/test";
import { formatPlanForCopy } from "../src/lib/lesson/plan-format.ts";
import { checkTimeAllocation } from "../src/lib/lesson/time-check.ts";
import type {
  EditablePlan,
  LessonConditions,
} from "../src/lib/lesson/types.ts";

// Synthetic conditions only.
const PERCENTAGE: LessonConditions = {
  unitSource: "catalog",
  unitId: "percentage",
  unitName: "割合",
  totalLessons: 8,
  lessonNumber: 3,
  durationMinutes: 45,
};

const GOALS_API = "**/api/mock/goal-candidates";
const PLAN_API = "**/api/mock/lesson-plan";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fillConditions(
  page: Page,
  opts: {
    unitId?: string;
    custom?: string;
    total?: string;
    lesson?: string;
    duration?: string;
  } = {},
) {
  if (opts.custom !== undefined) {
    await page.getByLabel("候補にない単元を追加").check();
    await page.getByLabel("単元名（候補にない単元）").fill(opts.custom);
  } else {
    await page
      .getByLabel("単元", { exact: true })
      .selectOption(opts.unitId ?? "percentage");
  }
  await page.getByLabel("単元の全時間数").fill(opts.total ?? "8");
  await page.getByLabel("本時（何時間目）").fill(opts.lesson ?? "3");
  await page.getByLabel("授業時間（分）").fill(opts.duration ?? "45");
}

const submitConditions = (page: Page) =>
  page.getByRole("button", { name: "この条件で目標候補を表示" }).click();

const candidateRadios = (page: Page) =>
  page.getByRole("group", { name: /目標候補/ }).getByRole("radio");

async function confirmFirstCandidate(page: Page) {
  await candidateRadios(page).first().check();
  await page.getByLabel("この目標を確認しました").check();
}

const generateButton = (page: Page) =>
  page.getByRole("button", { name: "授業案のたたき台を作成" });

async function reachPlan(page: Page) {
  await page.goto("/");
  await fillConditions(page);
  await submitConditions(page);
  await expect(candidateRadios(page)).toHaveCount(3);
  await confirmFirstCandidate(page);
  await generateButton(page).click();
  await expect(page.locator("#plan-goal")).toBeVisible();
}

async function setMinutes(page: Page, i: string, d: string, s: string) {
  await page.locator("#plan-introduction-minutes").fill(i);
  await page.locator("#plan-development-minutes").fill(d);
  await page.locator("#plan-summary-minutes").fill(s);
}

/** Builds the expected copy text from the values currently on screen. */
async function expectedCopy(page: Page, conditions = PERCENTAGE) {
  const v = (sel: string) => page.locator(sel).inputValue();
  const plan: EditablePlan = {
    goal: await v("#plan-goal"),
    introduction: {
      activity: await v("#plan-introduction-activity"),
      minutes: await v("#plan-introduction-minutes"),
    },
    development: {
      activity: await v("#plan-development-activity"),
      minutes: await v("#plan-development-minutes"),
    },
    summary: {
      activity: await v("#plan-summary-activity"),
      minutes: await v("#plan-summary-minutes"),
    },
    materials: await v("#plan-materials"),
    understandingChecks: await v("#plan-checks"),
    reviewNotice: (await page.locator(".review-notice").textContent()) ?? "",
  };
  const check = checkTimeAllocation(conditions.durationMinutes, {
    introduction: plan.introduction.minutes,
    development: plan.development.minutes,
    summary: plan.summary.minutes,
  });
  return formatPlanForCopy(conditions, plan, check);
}

test.describe("normal flow", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("conditions → goal → plan → edit → time states → copy", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("MOCK", { exact: true })).toBeVisible();
    await expect(page.getByText("アプリ内には保存しません。")).toBeVisible();

    await fillConditions(page);
    await submitConditions(page);
    await expect(candidateRadios(page)).toHaveCount(3);
    await expect(page.getByText("mock 候補（教員確認前の案）")).toBeVisible();

    // Cannot generate before the goal is confirmed.
    await expect(generateButton(page)).toBeDisabled();
    await candidateRadios(page).nth(1).check();
    const goal = page.locator("#field-goal");
    await expect(goal).not.toHaveValue("");
    await expect(generateButton(page)).toBeDisabled();
    await expect(page.locator("#plan-block-reason")).toContainText(
      "この目標を確認しました",
    );

    await goal.fill("架空の編集済み目標：割合の意味を説明できる。");
    const confirm = page.getByLabel("この目標を確認しました");
    await confirm.check();
    // Editing after confirming unchecks the confirmation.
    await goal.press("End");
    await goal.pressSequentially("（修正）");
    await expect(confirm).not.toBeChecked();
    await confirm.check();
    await generateButton(page).click();

    await expect(page.locator("#plan-goal")).toHaveValue(
      "架空の編集済み目標：割合の意味を説明できる。（修正）",
    );
    await expect(page.getByText("たたき台（mock・教員確認前）")).toBeVisible();
    // Focus lands on the persistent status once the plan is ready.
    await expect(page.locator("#plan-status")).toBeFocused();
    await expect(page.locator(".review-notice")).not.toBeEmpty();

    const status = page.locator(".time-status");
    await setMinutes(page, "5", "30", "10");
    await expect(status).toContainText("一致");
    await setMinutes(page, "5", "25", "10");
    await expect(status).toContainText("不足（5分）");
    await expect(page.locator("#plan-development-minutes")).toHaveValue("25");
    await setMinutes(page, "10", "30", "10");
    await expect(status).toContainText("超過（5分）");
    for (const bad of ["", "-5", "abc"]) {
      await page.locator("#plan-summary-minutes").fill(bad);
      await expect(status).toContainText("数値として不正な欄あり（まとめ）");
      await expect(page.locator("#plan-summary-minutes")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      // Never auto-corrected.
      await expect(page.locator("#plan-summary-minutes")).toHaveValue(bad);
    }
    await page.locator("#plan-summary-minutes").fill("10");

    await page.locator("#plan-materials").fill("架空の準備物A\n架空の準備物B");
    await page
      .locator("#plan-introduction-activity")
      .fill("架空の導入活動（編集済み）");

    await page.getByRole("button", { name: "授業案をコピー" }).click();
    await expect(page.locator(".copy-status")).toHaveText(/コピーしました/);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(await expectedCopy(page));
    expect(clip).toContain("架空の導入活動（編集済み）");
    expect(clip).toContain("- 架空の準備物B");
    expect(clip).toContain("差 +5分");
  });

  test("custom unit and repeated copy reflects latest edits", async ({
    page,
  }) => {
    await page.goto("/");
    await fillConditions(page, {
      custom: "架空の単元テスト",
      total: "4",
      lesson: "4",
      duration: "40",
    });
    await submitConditions(page);
    await expect(candidateRadios(page).first()).toBeVisible();
    await confirmFirstCandidate(page);
    await generateButton(page).click();
    const conditions: LessonConditions = {
      unitSource: "custom",
      unitName: "架空の単元テスト",
      totalLessons: 4,
      lessonNumber: 4,
      durationMinutes: 40,
    };
    const copy = page.getByRole("button", { name: "授業案をコピー" });

    await copy.click();
    await expect(page.locator(".copy-status")).toHaveText(/コピーしました/);
    const first = await page.evaluate(() => navigator.clipboard.readText());
    expect(first).toBe(await expectedCopy(page, conditions));

    await page.locator("#plan-checks").fill("架空の確認方法（2回目）");
    await copy.click();
    await expect(page.locator(".copy-status")).toHaveText(/コピーしました/);
    const second = await page.evaluate(() => navigator.clipboard.readText());
    expect(second).toBe(await expectedCopy(page, conditions));
    expect(second).toContain("架空の確認方法（2回目）");
    expect(second).not.toBe(first);

    await page.locator("#plan-checks").fill("架空の確認方法（3回目）");
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("架空の確認方法（3回目）");
  });
});

test.describe("condition validation", () => {
  async function errorOf(page: Page, field: string) {
    return page.locator(`#error-${field}`);
  }

  test("empty submit shows errors and focuses the first invalid field", async ({
    page,
  }) => {
    await page.goto("/");
    await submitConditions(page);
    const unit = page.getByLabel("単元", { exact: true });
    await expect(unit).toBeFocused();
    await expect(unit).toHaveAttribute("aria-invalid", "true");
    for (const field of [
      "unitId",
      "totalLessons",
      "lessonNumber",
      "durationMinutes",
    ]) {
      await expect(await errorOf(page, field)).toBeVisible();
    }
    await expect(page.getByLabel("単元の全時間数")).toHaveAttribute(
      "aria-describedby",
      /error-totalLessons/,
    );
    await expect(candidateRadios(page)).toHaveCount(0);
  });

  test("zero, negative, decimal and lesson > total are rejected", async ({
    page,
  }) => {
    await page.goto("/");
    await fillConditions(page, { total: "0", lesson: "-1", duration: "45.5" });
    await submitConditions(page);
    await expect(page.getByLabel("単元の全時間数")).toBeFocused();
    await expect(await errorOf(page, "totalLessons")).toBeVisible();
    await expect(await errorOf(page, "lessonNumber")).toBeVisible();
    await expect(await errorOf(page, "durationMinutes")).toBeVisible();

    await fillConditions(page, { total: "3", lesson: "5", duration: "45" });
    await submitConditions(page);
    await expect(page.getByLabel("本時（何時間目）")).toBeFocused();
    await expect(await errorOf(page, "lessonNumber")).toContainText(
      "全時間数（3時間）以下",
    );
    await expect(await errorOf(page, "totalLessons")).toHaveCount(0);
  });

  test("whitespace-only and duplicate custom unit names are rejected", async ({
    page,
  }) => {
    await page.goto("/");
    await fillConditions(page, { custom: "   " });
    await submitConditions(page);
    const name = page.getByLabel("単元名（候補にない単元）");
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(await errorOf(page, "customUnitName")).toContainText(
      "空白のみ",
    );
    await expect(page.getByText(/個人情報・児童の情報/).first()).toBeVisible();

    await name.fill("割合");
    await submitConditions(page);
    await expect(await errorOf(page, "customUnitName")).toContainText(
      "一覧にある単元",
    );

    await name.fill("\u200b");
    await submitConditions(page);
    await expect(await errorOf(page, "customUnitName")).toContainText(
      "表示されない文字",
    );
    await expect(candidateRadios(page)).toHaveCount(0);
  });

  test("circled and superscript digits are rejected", async ({ page }) => {
    await page.goto("/");
    await fillConditions(page, { total: "①", lesson: "²", duration: "４５" });
    await submitConditions(page);
    await expect(await errorOf(page, "totalLessons")).toBeVisible();
    await expect(await errorOf(page, "lessonNumber")).toBeVisible();
    await expect(await errorOf(page, "durationMinutes")).toHaveCount(0);
  });
});

test.describe("requests", () => {
  test("delayed responses show loading and double clicks send one request", async ({
    page,
  }) => {
    let goalCalls = 0;
    let planCalls = 0;
    await page.route(GOALS_API, async (route) => {
      goalCalls++;
      await sleep(800);
      await route.continue().catch(() => {});
    });
    await page.route(PLAN_API, async (route) => {
      planCalls++;
      await sleep(800);
      await route.continue().catch(() => {});
    });
    await page.goto("/");
    await fillConditions(page);
    await page
      .getByRole("button", { name: "この条件で目標候補を表示" })
      .dblclick();
    await expect(page.getByText("目標候補を取得しています…")).toBeVisible();
    await expect(page.locator(".candidates")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(candidateRadios(page)).toHaveCount(3);
    expect(goalCalls).toBe(1);

    await confirmFirstCandidate(page);
    await generateButton(page).dblclick();
    const busy = page.getByRole("button", { name: "作成中…" });
    await expect(busy).toBeDisabled();
    await expect(
      page.getByText("授業案のたたき台を作成しています…"),
    ).toBeVisible();
    await expect(page.locator("#plan-goal")).toBeVisible();
    expect(planCalls).toBe(1);
  });

  test("goal candidates 500 then retry succeeds", async ({ page }) => {
    let calls = 0;
    await page.route(GOALS_API, async (route) => {
      calls++;
      if (calls === 1) {
        await route.fulfill({ status: 500, json: { error: "x" } });
      } else {
        await route.continue();
      }
    });
    await page.goto("/");
    await fillConditions(page);
    await submitConditions(page);
    await expect(page.locator(".error-box[role=alert]")).toContainText(
      "目標候補を取得できませんでした",
    );
    // Manual entry stays possible during the error.
    await expect(page.locator("#field-goal")).toBeEditable();
    await page.getByRole("button", { name: "再試行" }).click();
    await expect(candidateRadios(page)).toHaveCount(3);
    expect(calls).toBe(2);
  });

  test("empty candidates allow manual goal entry and retry", async ({
    page,
  }) => {
    let calls = 0;
    await page.route(GOALS_API, (route) => {
      calls += 1;
      return route.fulfill({ json: { source: "mock", candidates: [] } });
    });
    await page.goto("/");
    await fillConditions(page);
    await submitConditions(page);
    await expect(
      page.getByText("候補がありません。目標を直接入力してください。"),
    ).toBeVisible();
    await page.locator("#field-goal").fill("手入力の架空の目標");
    await page.getByLabel("この目標を確認しました").check();
    await expect(generateButton(page)).toBeEnabled();

    await page.getByRole("button", { name: "再試行" }).click();
    await expect.poll(() => calls).toBe(2);
    await expect(
      page.getByText("候補がありません。目標を直接入力してください。"),
    ).toBeVisible();
    await expect(page.locator("#field-goal")).toHaveValue("手入力の架空の目標");
  });

  for (const [name, body] of [
    ["invalid JSON", "{not json"],
    ["schema-invalid", JSON.stringify({ source: "mock", plan: { goal: "" } })],
  ] as const) {
    test(`plan ${name} response shows an error and no plan`, async ({
      page,
    }) => {
      let calls = 0;
      await page.route(PLAN_API, async (route) => {
        calls++;
        if (calls === 1) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body,
          });
        } else {
          await route.continue();
        }
      });
      await page.goto("/");
      await fillConditions(page);
      await submitConditions(page);
      await confirmFirstCandidate(page);
      await generateButton(page).click();
      await expect(page.locator(".error-box[role=alert]")).toContainText(
        "授業案を作成できませんでした",
      );
      await expect(page.locator("#plan-goal")).toHaveCount(0);
      await expect(page.getByText("たたき台（mock・教員確認前）")).toHaveCount(
        0,
      );
      await page.getByRole("button", { name: "再試行" }).click();
      await expect(page.locator("#plan-goal")).toBeVisible();
    });
  }

  test("plan 500 then retry succeeds", async ({ page }) => {
    let calls = 0;
    await page.route(PLAN_API, async (route) => {
      calls++;
      if (calls === 1) await route.fulfill({ status: 500, json: {} });
      else await route.continue();
    });
    await page.goto("/");
    await fillConditions(page);
    await submitConditions(page);
    await confirmFirstCandidate(page);
    await generateButton(page).click();
    await expect(page.locator(".error-box[role=alert]")).toBeVisible();
    await expect(page.locator("#plan-status")).toBeFocused();
    await page.getByRole("button", { name: "再試行" }).click();
    await expect(page.locator("#plan-goal")).toBeVisible();
    // The retry button is gone; focus moves to the plan status, not <body>.
    await expect(page.locator("#plan-status")).toBeFocused();
  });

  test("a slow response for old conditions never appears", async ({ page }) => {
    let calls = 0;
    await page.route(GOALS_API, async (route) => {
      calls++;
      if (calls === 1) {
        await sleep(1500);
        await route
          .fulfill({
            json: {
              source: "mock",
              candidates: [{ id: "stale", text: "古い条件の架空候補" }],
            },
          })
          .catch(() => {});
      } else {
        await route.continue();
      }
    });
    await page.goto("/");
    await fillConditions(page);
    await submitConditions(page);
    await expect(page.getByText("目標候補を取得しています…")).toBeVisible();
    // Nothing to discard yet, so no confirmation is needed.
    await page.getByRole("button", { name: "条件を変更" }).click();
    await page.getByLabel("単元の全時間数").fill("6");
    await submitConditions(page);
    await expect(candidateRadios(page)).toHaveCount(3);
    await sleep(2000);
    await expect(page.getByText("古い条件の架空候補")).toHaveCount(0);
    await expect(page.getByText("全6時間中")).toBeVisible();
    await expect(candidateRadios(page)).toHaveCount(3);
  });

  test("a slow plan for an old goal never appears", async ({ page }) => {
    let calls = 0;
    await page.route(PLAN_API, async (route) => {
      calls++;
      if (calls === 1) {
        await sleep(1500);
        await route.continue().catch(() => {});
      } else {
        await route.continue();
      }
    });
    await page.goto("/");
    await fillConditions(page);
    await submitConditions(page);
    await confirmFirstCandidate(page);
    await generateButton(page).click();
    await expect(page.getByRole("button", { name: "作成中…" })).toBeVisible();
    await page.getByRole("button", { name: "目標を変更" }).click();
    await expect(page.locator("#field-goal")).toBeEditable();
    await sleep(2000);
    await expect(page.locator("#plan-goal")).toHaveCount(0);
    await expect(generateButton(page)).toBeVisible();
  });
});

test.describe("discard confirmations", () => {
  test("condition change: Escape/cancel keeps edits, discard resets", async ({
    page,
  }) => {
    await reachPlan(page);
    await page.locator("#plan-goal").fill("架空の編集内容");
    const change = page.getByRole("button", { name: "条件を変更" });
    await change.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      "条件を変更すると、目標候補・入力した目標・授業案（編集内容を含む）を破棄します。",
    );
    await expect(
      dialog.getByRole("button", { name: "キャンセル" }),
    ).toBeFocused();
    // The rest of the workflow is inert while the dialog is open.
    await expect(page.locator(".workflow")).toHaveAttribute("inert", "");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.locator("#plan-goal")).not.toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(change).toBeFocused();
    await expect(page.locator("#plan-goal")).toHaveValue("架空の編集内容");

    await change.click();
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.locator("#plan-goal")).toHaveValue("架空の編集内容");

    await change.click();
    await dialog.getByRole("button", { name: "破棄して条件を変更" }).click();
    await expect(page.locator("#plan-goal")).toHaveCount(0);
    await expect(candidateRadios(page)).toHaveCount(0);
    // The form keeps the previous inputs for editing.
    await expect(page.getByLabel("単元の全時間数")).toHaveValue("8");
    await expect(page.getByLabel("単元", { exact: true })).toHaveValue(
      "percentage",
    );
  });

  test("goal change after a plan asks before discarding", async ({ page }) => {
    await reachPlan(page);
    await page.getByRole("button", { name: "目標を変更" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("授業案（編集内容を含む）を破棄します");
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.locator("#plan-goal")).toBeVisible();
    await page.getByRole("button", { name: "目標を変更" }).click();
    await dialog.getByRole("button", { name: "破棄して目標を変更" }).click();
    await expect(page.locator("#plan-goal")).toHaveCount(0);
    await expect(page.locator("#field-goal")).toBeEditable();
    await expect(page.getByLabel("この目標を確認しました")).not.toBeChecked();
  });

  test("regenerate with edits asks; cancel keeps edits", async ({ page }) => {
    await reachPlan(page);
    const original = await page.locator("#plan-goal").inputValue();
    await page.locator("#plan-goal").fill("架空の編集内容");
    await page.getByRole("button", { name: "授業案を作り直す" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.locator("#plan-goal")).toHaveValue("架空の編集内容");

    await page.getByRole("button", { name: "授業案を作り直す" }).click();
    await dialog
      .getByRole("button", { name: "編集内容を破棄して作り直す" })
      .click();
    await expect(page.locator("#plan-goal")).toHaveValue(original);
  });

  test("candidate over an edited goal asks; arrow keys never overwrite silently", async ({
    page,
  }) => {
    await page.goto("/");
    await fillConditions(page);
    await submitConditions(page);
    const radios = candidateRadios(page);
    await expect(radios).toHaveCount(3);
    const goal = page.locator("#field-goal");

    // Without own edits, switching candidates needs no confirmation.
    await radios.nth(0).check();
    const first = await goal.inputValue();
    await radios.nth(0).press("ArrowDown");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(radios.nth(1)).toBeChecked();
    await expect(goal).not.toHaveValue(first);

    await goal.fill("架空の書き換えた目標");
    await radios.nth(1).focus();
    await page.keyboard.press("ArrowDown");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("置き換えると、その内容を破棄します");
    await expect(goal).toHaveValue("架空の書き換えた目標");
    await dialog.getByRole("button", { name: "入力した目標を保持" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(goal).toHaveValue("架空の書き換えた目標");
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();

    await radios.nth(2).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(goal).toHaveValue("架空の書き換えた目標");

    await radios.nth(2).click();
    await dialog
      .getByRole("button", { name: "破棄して候補に置き換える" })
      .click();
    await expect(radios.nth(2)).toBeChecked();
    await expect(radios.nth(2)).toBeFocused();
    await expect(goal).not.toHaveValue("架空の書き換えた目標");
    await expect(goal).not.toHaveValue("");
  });

  test("regenerate without edits does not ask", async ({ page }) => {
    await reachPlan(page);
    await page.getByRole("button", { name: "授業案を作り直す" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.locator("#plan-goal")).toBeVisible();
  });
});

test.describe("copy failure", () => {
  const variants = {
    "writeText rejects": () => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: () => Promise.reject(new Error("synthetic denial")),
      });
    },
    "clipboard undefined": () => {
      Object.defineProperty(Navigator.prototype, "clipboard", {
        configurable: true,
        get: () => undefined,
      });
    },
  };

  for (const [name, script] of Object.entries(variants)) {
    test(`${name}: fallback textarea holds the full text`, async ({ page }) => {
      await page.addInitScript(script);
      await reachPlan(page);
      await page.locator("#plan-materials").fill("架空の準備物（失敗時）");
      await page.getByRole("button", { name: "授業案をコピー" }).click();
      await expect(page.locator(".copy-status")).toHaveText(
        /自動コピーできませんでした。下の欄を選択して手動でコピーしてください。/,
      );
      const fallback = page.getByLabel("手動コピー用のテキスト");
      await expect(fallback).toHaveAttribute("readonly", "");
      await expect(fallback).toHaveValue(await expectedCopy(page));
      await expect(fallback).toBeFocused();
      const selected = await fallback.evaluate(
        (el: HTMLTextAreaElement) =>
          el.selectionStart === 0 && el.selectionEnd === el.value.length,
      );
      expect(selected).toBe(true);
      await page.getByRole("button", { name: "全選択" }).click();
      await expect(fallback).toBeFocused();
    });
  }
});

test("reload resets state and nothing is kept in browser storage", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await reachPlan(page);
  const marker = "架空の保存確認用テキスト";
  await page.locator("#plan-goal").fill(marker);

  const storage = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
  }));
  expect(storage.local).not.toContain(marker);
  expect(storage.local).not.toContain("割合");
  expect(storage.session).not.toContain(marker);
  expect(storage.session).not.toContain("割合");
  expect(storage.cookie).toBe("");

  await page.reload();
  await expect(page.getByLabel("単元の全時間数")).toHaveValue("");
  await expect(page.getByLabel("単元", { exact: true })).toHaveValue("");
  await expect(page.locator("#plan-goal")).toHaveCount(0);
  await expect(page.getByText(marker)).toHaveCount(0);
  const after = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookie: document.cookie,
  }));
  expect(after).toEqual({ local: 0, session: 0, cookie: "" });
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
  expect(databases).toEqual([]);
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const overflow = (page: Page) =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );

  test("conditions step with errors has no horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await submitConditions(page);
    await expect(page.locator("#error-unitId")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByLabel("候補にない単元を追加").check();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("plan view has no horizontal scroll", async ({ page }) => {
    await reachPlan(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
