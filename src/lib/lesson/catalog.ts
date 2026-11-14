import type { CatalogUnit } from "./types.ts";

/**
 * Provisional 小学5年 算数 unit candidates for the prototype only.
 * Source, rights, completeness, order and lesson allocation are unconfirmed (Issue #7).
 * No standard lesson counts are provided on purpose.
 */
export const UNIT_CATALOG: readonly CatalogUnit[] = [
  { id: "integers-decimals", name: "整数と小数のしくみ" },
  { id: "volume", name: "体積" },
  { id: "proportion", name: "比例" },
  { id: "decimal-multiplication", name: "小数のかけ算" },
  { id: "decimal-division", name: "小数のわり算" },
  { id: "congruent-figures", name: "合同な図形" },
  { id: "angles-of-figures", name: "図形の角" },
  {
    id: "properties-of-integers",
    name: "整数の性質（偶数と奇数、倍数と約数）",
  },
  {
    id: "fractions-decimals-integers",
    name: "分数と小数、整数の関係",
  },
  {
    id: "fraction-addition-subtraction",
    name: "分数のたし算とひき算",
  },
  { id: "average", name: "平均" },
  { id: "per-unit-quantity", name: "単位量あたりの大きさ" },
  { id: "percentage", name: "割合" },
  { id: "band-and-pie-graphs", name: "帯グラフと円グラフ" },
  { id: "regular-polygons-circles", name: "正多角形と円" },
  { id: "prisms-cylinders", name: "角柱と円柱" },
];

export const CATALOG_NOTICE =
  "単元の一覧は試作用の仮候補です。出典・権利・網羅性・順序・配当時間は未確認です（#7）。教科書や地域によって単元名や構成は異なります。";

export function findCatalogUnit(id: string): CatalogUnit | undefined {
  return UNIT_CATALOG.find((unit) => unit.id === id);
}
