import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionsKey,
  normalizeUnitName,
  validateConditions,
} from "../src/lib/lesson/conditions.ts";
import {
  CATALOG_NOTICE,
  UNIT_CATALOG,
  findCatalogUnit,
} from "../src/lib/lesson/catalog.ts";
import type { ConditionsFormInput } from "../src/lib/lesson/types.ts";

const base: ConditionsFormInput = {
  unitMode: "catalog",
  unitId: "volume",
  customUnitName: "",
  totalLessons: "10",
  lessonNumber: "3",
  durationMinutes: "45",
};

function v(patch: Partial<ConditionsFormInput>) {
  return validateConditions({ ...base, ...patch });
}

function errorsOf(patch: Partial<ConditionsFormInput>) {
  const result = v(patch);
  assert.equal(result.ok, false);
  return result.ok ? {} : result.errors;
}

test("catalog has unique ids, 16 units and a provisional notice", () => {
  assert.equal(UNIT_CATALOG.length, 16);
  assert.equal(new Set(UNIT_CATALOG.map((u) => u.id)).size, 16);
  for (const u of UNIT_CATALOG) assert.match(u.id, /^[a-z0-9-]+$/);
  assert.equal(findCatalogUnit("volume")?.name, "体積");
  assert.equal(findCatalogUnit("unknown"), undefined);
  assert.match(CATALOG_NOTICE, /#7/);
});

test("normalizeUnitName applies NFKC, trims and collapses spaces", () => {
  assert.equal(normalizeUnitName("　分数の　 しくみ \t"), "分数の しくみ");
  assert.equal(normalizeUnitName("ＡＢＣ１２"), "ABC12");
});

test("valid catalog conditions", () => {
  const result = v({});
  assert.deepEqual(result, {
    ok: true,
    conditions: {
      unitSource: "catalog",
      unitId: "volume",
      unitName: "体積",
      totalLessons: 10,
      lessonNumber: 3,
      durationMinutes: 45,
    },
  });
});

test("valid custom conditions are normalized and have no unitId", () => {
  const result = v({
    unitMode: "custom",
    unitId: "volume",
    customUnitName: "  試作の　単元  ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.conditions.unitName, "試作の 単元");
    assert.equal(result.conditions.unitSource, "custom");
    assert.equal("unitId" in result.conditions, false);
  }
});

test("unknown unitId is rejected", () => {
  assert.ok(errorsOf({ unitId: "unknown" }).unitId);
  assert.ok(errorsOf({ unitId: "" }).unitId);
});

test("custom name: empty, whitespace-only, too long, duplicate", () => {
  assert.ok(
    errorsOf({ unitMode: "custom", customUnitName: "" }).customUnitName,
  );
  assert.ok(
    errorsOf({ unitMode: "custom", customUnitName: " 　\t" }).customUnitName,
  );
  assert.ok(
    errorsOf({ unitMode: "custom", customUnitName: "あ".repeat(41) })
      .customUnitName,
  );
  assert.equal(
    v({ unitMode: "custom", customUnitName: "あ".repeat(40) }).ok,
    true,
  );
  const dup = errorsOf({
    unitMode: "custom",
    customUnitName: "　体積　",
  }).customUnitName;
  assert.match(dup ?? "", /一覧から選んで/);
  const dupParen = errorsOf({
    unitMode: "custom",
    customUnitName: "整数の性質(偶数と奇数、倍数と約数)",
  }).customUnitName;
  assert.match(dupParen ?? "", /一覧から選んで/);
});

test("totalLessons rejects empty, 0, negative, decimal, non-numeric, >30", () => {
  for (const value of ["", "0", "-1", "1.5", "abc", "1e1", "31", " "]) {
    assert.ok(errorsOf({ totalLessons: value }).totalLessons, value);
  }
  assert.equal(v({ totalLessons: "30", lessonNumber: "30" }).ok, true);
  assert.equal(v({ totalLessons: "1", lessonNumber: "1" }).ok, true);
});

test("full-width digits are accepted; other digit-like characters are not", () => {
  const result = v({ totalLessons: "１０", durationMinutes: "４５" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.conditions.durationMinutes, 45);
  const leadingZero = v({ lessonNumber: "０５" });
  assert.equal(leadingZero.ok, true);
  if (leadingZero.ok) assert.equal(leadingZero.conditions.lessonNumber, 5);
  for (const value of ["①", "²", "1²", "٣", "Ⅲ"]) {
    assert.ok(errorsOf({ lessonNumber: value }).lessonNumber, value);
  }
});

test("custom unit names with invisible characters are rejected", () => {
  for (const name of [
    "\u200b",
    "\u200b\u200b",
    "架空の\u200b単元",
    "架空の\u0007単元",
    "架空の\u202e単元",
    "\u3164",
    "架空\u3164単元",
  ]) {
    const errors = errorsOf({ unitMode: "custom", customUnitName: name });
    assert.ok(errors.customUnitName, JSON.stringify(name));
  }
  assert.equal(
    v({ unitMode: "custom", customUnitName: "架空の単元テスト" }).ok,
    true,
  );
});

test("lessonNumber must be within 1..totalLessons", () => {
  for (const value of ["", "0", "-2", "2.0", "x"]) {
    assert.ok(errorsOf({ lessonNumber: value }).lessonNumber, value);
  }
  const over = errorsOf({ totalLessons: "5", lessonNumber: "6" }).lessonNumber;
  assert.match(over ?? "", /5時間/);
  assert.equal(v({ totalLessons: "5", lessonNumber: "5" }).ok, true);
});

test("durationMinutes boundaries 5..120", () => {
  assert.equal(v({ durationMinutes: "5" }).ok, true);
  assert.equal(v({ durationMinutes: "120" }).ok, true);
  for (const value of ["4", "121", "", "0", "-45", "45.5", "abc"]) {
    assert.ok(errorsOf({ durationMinutes: value }).durationMinutes, value);
  }
});

test("errors are reported per field, one message each", () => {
  const errors = errorsOf({
    unitId: "nope",
    totalLessons: "0",
    lessonNumber: "",
    durationMinutes: "999",
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "durationMinutes",
    "lessonNumber",
    "totalLessons",
    "unitId",
  ]);
  for (const message of Object.values(errors)) {
    assert.equal(typeof message, "string");
    assert.ok((message ?? "").length > 0);
  }
});

test("conditionsKey is stable and changes with any field", () => {
  const a = v({});
  const b = v({});
  const c = v({ lessonNumber: "4" });
  assert.ok(a.ok && b.ok && c.ok);
  if (a.ok && b.ok && c.ok) {
    assert.equal(conditionsKey(a.conditions), conditionsKey(b.conditions));
    assert.notEqual(conditionsKey(a.conditions), conditionsKey(c.conditions));
  }
});
