// Technical balance of a recipe from the composition of its ingredients (per 100 g or 100 mL).
// Kilograms and litres count 1:1; units (eggs, cones) stay out of the mass. Pure arithmetic:
// the ranges are the usual artisan-gelato guidance, not a standard of any kind.
import type { Recipe, State } from "./schema";

export type BalanceKey = "sugars" | "fat" | "solids" | "msnf";
export const balanceLabels: Record<BalanceKey, string> = {
  sugars: "Azúcares",
  fat: "Grasa",
  solids: "Sólidos totales",
  msnf: "Sólidos lácteos no grasos",
};
export const balanceRanges: Record<
  string,
  Record<BalanceKey, [number, number]> | null
> = {
  crema: { sugars: [16, 22], fat: [4, 9], solids: [32, 42], msnf: [8, 11] },
  sorbete: { sugars: [26, 32], fat: [0, 3], solids: [30, 36], msnf: [0, 3] },
  postre: { sugars: [14, 24], fat: [3, 12], solids: [30, 45], msnf: [0, 12] },
  base: null,
  otro: null,
};
export type BalanceFlag = {
  key: BalanceKey;
  label: string;
  value: number;
  range: [number, number] | null;
  status: "ok" | "low" | "high" | "info" | "unknown";
};
export type RecipeBalance = {
  mass: number;
  covered: number;
  missing: string[];
  values: Record<BalanceKey, number>;
  flags: BalanceFlag[];
  complete: boolean;
};
const keys: BalanceKey[] = ["sugars", "fat", "solids", "msnf"];
export function recipeBalance(s: State, r: Recipe): RecipeBalance {
  let mass = 0,
    covered = 0;
  const totals: Record<BalanceKey, number> = {
    sugars: 0,
    fat: 0,
    solids: 0,
    msnf: 0,
  };
  const missing: string[] = [];
  for (const i of r.ingredients) {
    const p = s.products.find((x) => x.id === i.product);
    if (!p || p.unit === "ud") continue;
    mass += i.quantity;
    const c = p.composition;
    if (!c || keys.every((k) => c[k] === undefined)) {
      missing.push(p.name);
      continue;
    }
    covered += i.quantity;
    for (const k of keys) totals[k] += (i.quantity * (c[k] ?? 0)) / 100;
  }
  const pct = (n: number) => (mass ? Math.round((n / mass) * 1000) / 10 : 0);
  const values = {
    sugars: pct(totals.sugars),
    fat: pct(totals.fat),
    solids: pct(totals.solids),
    msnf: pct(totals.msnf),
  };
  const ranges = balanceRanges[r.family ?? "crema"] ?? null;
  const complete = mass > 0 && missing.length === 0;
  const flags: BalanceFlag[] = keys.map((key) => {
    const range = ranges ? ranges[key] : null;
    const value = values[key];
    const status: BalanceFlag["status"] = !complete
      ? "unknown"
      : !range
        ? "info"
        : value < range[0]
          ? "low"
          : value > range[1]
            ? "high"
            : "ok";
    return { key, label: balanceLabels[key], value, range, status };
  });
  return {
    mass: Math.round(mass * 1000) / 1000,
    covered: mass ? Math.round((covered / mass) * 100) : 0,
    missing,
    values,
    flags,
    complete,
  };
}
