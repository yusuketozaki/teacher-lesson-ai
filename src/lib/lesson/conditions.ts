import { UNIT_CATALOG, findCatalogUnit } from "./catalog.ts";
import { LIMITS } from "./limits.ts";
import type {
  ConditionsFormInput,
  FieldErrors,
  LessonConditions,
} from "./types.ts";

/** NFKC-normalize, trim and collapse internal whitespace runs to one space. */
export function normalizeUnitName(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** Number of user-perceived code points (surrogate pairs count once). */
export function textLength(text: string): number {
  return Array.from(text).length;
}

/**
 * Map full-width digits ０-９ to ASCII. Other digit-like characters (①, ², …)
 * are left as they are so that they are rejected, unlike with NFKC.
 */
export function toAsciiDigits(text: string): string {
  return text.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  );
}

/**
 * Parse a non-negative integer typed as text. Only ASCII and full-width
 * digits are accepted. Signs, decimals, exponents, circled or superscript
 * digits and other characters are rejected. Returns null when not accepted.
 */
export function parseIntegerText(raw: string, maxDigits = 6): number | null {
  const text = toAsciiDigits(raw).trim();
  if (!/^[0-9]+$/.test(text) || text.length > maxDigits) return null;
  return Number(text);
}

/**
 * Control, format (zero-width etc.) and Hangul filler characters, which are
 * invisible or can make a unit name look different from what is stored.
 */
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}\u115F\u1160\u3164\uFFA0]/u;

export function hasInvisibleChars(text: string): boolean {
  return INVISIBLE_CHARS.test(text);
}

/** Returns the catalog unit whose normalized name equals the given name. */
export function findCatalogUnitByName(name: string) {
  const normalized = normalizeUnitName(name);
  return UNIT_CATALOG.find(
    (unit) => normalizeUnitName(unit.name) === normalized,
  );
}

export type ConditionsValidation =
  | { ok: true; conditions: LessonConditions }
  | { ok: false; errors: FieldErrors };

export function validateConditions(
  input: ConditionsFormInput,
): ConditionsValidation {
  const errors: FieldErrors = {};
  let unitName = "";
  let unitId: string | undefined;

  if (input.unitMode === "catalog") {
    const unit = findCatalogUnit(input.unitId);
    if (!unit) {
      errors.unitId = "単元を一覧から選んでください。";
    } else {
      unitName = unit.name;
      unitId = unit.id;
    }
  } else if (input.unitMode === "custom") {
    const name = normalizeUnitName(input.customUnitName);
    const duplicate = name === "" ? undefined : findCatalogUnitByName(name);
    if (name === "") {
      errors.customUnitName = "単元名を入力してください（空白のみは不可）。";
    } else if (
      hasInvisibleChars(input.customUnitName) ||
      hasInvisibleChars(name)
    ) {
      errors.customUnitName =
        "単元名に制御文字や幅のない文字など、表示されない文字は使えません。";
    } else if (textLength(name) > LIMITS.unitNameMaxLength) {
      errors.customUnitName = `単元名は${LIMITS.unitNameMaxLength}文字以内で入力してください。`;
    } else if (duplicate) {
      errors.customUnitName = `「${duplicate.name}」は一覧にある単元です。一覧から選んでください。`;
    } else {
      unitName = name;
    }
  } else {
    errors.unitMode = "単元の指定方法を選んでください。";
  }

  const totalLessons = parseIntegerText(input.totalLessons);
  const totalValid =
    totalLessons !== null &&
    totalLessons >= 1 &&
    totalLessons <= LIMITS.totalLessonsMax;
  if (!totalValid) {
    errors.totalLessons = `単元の全時間数は1から${LIMITS.totalLessonsMax}までの整数で入力してください。`;
  }

  const lessonNumber = parseIntegerText(input.lessonNumber);
  if (lessonNumber === null || lessonNumber < 1) {
    errors.lessonNumber = "本時が何時間目かを1以上の整数で入力してください。";
  } else if (totalValid && lessonNumber > (totalLessons as number)) {
    errors.lessonNumber = `本時は全時間数（${totalLessons}時間）以下で入力してください。`;
  } else if (!totalValid && lessonNumber > LIMITS.totalLessonsMax) {
    errors.lessonNumber = `本時は${LIMITS.totalLessonsMax}以下の整数で入力してください。`;
  }

  const durationMinutes = parseIntegerText(input.durationMinutes);
  if (
    durationMinutes === null ||
    durationMinutes < LIMITS.durationMinutesMin ||
    durationMinutes > LIMITS.durationMinutesMax
  ) {
    errors.durationMinutes = `授業時間は${LIMITS.durationMinutesMin}分から${LIMITS.durationMinutesMax}分までの整数で入力してください。`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const conditions: LessonConditions = {
    unitSource: input.unitMode,
    unitName,
    totalLessons: totalLessons as number,
    lessonNumber: lessonNumber as number,
    durationMinutes: durationMinutes as number,
  };
  if (unitId !== undefined) conditions.unitId = unitId;
  return { ok: true, conditions };
}

/** Stable key used to detect that results were generated for other conditions. */
export function conditionsKey(c: LessonConditions): string {
  return JSON.stringify([
    c.unitSource,
    c.unitId ?? null,
    c.unitName,
    c.totalLessons,
    c.lessonNumber,
    c.durationMinutes,
  ]);
}
