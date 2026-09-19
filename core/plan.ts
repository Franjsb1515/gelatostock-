// «Qué producir hoy»: una regla explicable, sin predicción. Para cada gelato de una receta:
//   falta para el objetivo = objetivo − stock (nunca menos de 0)
// Al lado, como hecho y no como pronóstico, la venta media reciente:
//   venta media = kilos vendidos en los 14 días anteriores ÷ días con cierre en ese periodo
//   da para     = stock ÷ venta media
// Sin objetivo escrito o sin cierres en el periodo, el dato es null («No disponible»).
import type { State } from "./schema.js";
import { closeLineOf, undoneMovements } from "./sales.js";
import { computeDay, isDayClosed } from "./day.js";
import { localDate } from "./messages.js";

export const PLAN_WINDOW_DAYS = 14;
export type PlanRow = {
  product: string;
  name: string;
  recipe: string;
  stock: number;
  /** CONFIRMADO: kilos que la persona quiere tener. 0 = sin objetivo escrito. */
  target: number;
  /** DERIVADO: objetivo − stock, mínimo 0. null sin objetivo. */
  suggest: number | null;
  /** DERIVADO: kilos vendidos ÷ días con cierre, en los 14 días anteriores. null sin cierres. */
  avgSold: number | null;
  soldKg: number;
  /** DERIVADO: stock ÷ venta media, en días. null si no hay venta media o es 0. */
  coverDays: number | null;
};
export type ProductionPlan = {
  today: string;
  from: string;
  to: string;
  /** Días con algún cierre registrado dentro del periodo (el divisor de la media). */
  closeDays: number;
  rows: PlanRow[];
};
const kg = (n: number): number => Math.round(n * 1000) / 1000;
const shift = (date: string, days: number): string => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
};
/** Día de negocio de ahora mismo: antes de la hora de cambio todavía es «ayer». */
export const businessDay = (now: Date, changeHour = 5): string =>
  localDate(new Date(now.getTime() - changeHour * 3_600_000));

export function productionPlan(s: State, today: string): ProductionPlan {
  const from = shift(today, -PLAN_WINDOW_DAYS);
  const to = shift(today, -1);
  const undone = undoneMovements(s);
  const sold = new Map<string, number>();
  const days = new Set<string>();
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const line = closeLineOf(m);
    if (!line || line.date < from || line.date > to) continue;
    days.add(line.date);
    if (line.kind === "sale")
      sold.set(m.product, (sold.get(m.product) ?? 0) - m.delta);
  }
  const seen = new Set<string>();
  const rows: PlanRow[] = [];
  for (const r of s.recipes) {
    if (!r.product || seen.has(r.product)) continue;
    seen.add(r.product);
    const p = s.products.find((x) => x.id === r.product);
    if (!p) continue;
    const soldKg = kg(sold.get(p.id) ?? 0);
    const avg = days.size ? kg(soldKg / days.size) : null;
    rows.push({
      product: p.id,
      name: p.name,
      recipe: r.id,
      stock: p.stock,
      target: p.target,
      suggest: p.target > 0 ? kg(Math.max(0, p.target - p.stock)) : null,
      avgSold: avg,
      soldKg,
      coverDays: avg ? Math.round((p.stock / avg) * 10) / 10 : null,
    });
  }
  rows.sort(
    (a, b) =>
      (b.suggest ?? -1) - (a.suggest ?? -1) ||
      a.name.localeCompare(b.name, "es"),
  );
  return { today, from, to, closeDays: days.size, rows };
}

export type TodayBrief = {
  date: string;
  closed: boolean;
  totals: ReturnType<typeof computeDay>["totals"];
  /** Ayer tuvo producción o salidas y nadie confirmó su cierre. */
  yesterdayPending: string | null;
  /** Gelatos con objetivo escrito a los que les falta producto. */
  toProduce: { name: string; suggest: number }[];
  withoutGoal: number;
};
/** Indicadores del día para el Resumen de inicio: hechos del libro de movimientos, sin previsión. */
export function todayBrief(s: State, now: Date, changeHour = 5): TodayBrief {
  const date = businessDay(now, changeHour);
  const stored = s.days.find((d) => d.date === date);
  const closed = stored?.status === "closed";
  const live = computeDay(s, date, changeHour);
  const yesterday = shift(date, -1);
  const before = computeDay(s, yesterday, changeHour);
  const busy = before.rows.some(
    (r) => r.produced || r.sold || r.waste || r.gift,
  );
  const plan = productionPlan(s, date);
  return {
    date,
    closed,
    totals: closed && stored ? stored.snapshot.totals : live.totals,
    yesterdayPending: busy && !isDayClosed(s, yesterday) ? yesterday : null,
    toProduce: plan.rows
      .filter((r) => r.suggest)
      .map((r) => ({ name: r.name, suggest: r.suggest ?? 0 })),
    withoutGoal: plan.rows.filter((r) => r.suggest === null).length,
  };
}
