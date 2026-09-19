// Resumen de un día de negocio: «cuánto debí vender». Todo sale del libro de movimientos.
// Por gelato: lo que había al empezar, lo producido, lo vendido, la merma, la invitación, los
// ajustes de inventario y lo que queda para mañana, con esta identidad siempre a la vista:
//   al empezar + producido − vendido − merma − invitación + ajustes = queda para mañana
// La venta estimada es DERIVADA: kilos vendidos × valor de venta por kilo vigente ese día. La venta
// real la escribe la persona (CONFIRMADA) y es opcional. Un ajuste de inventario se enseña como
// ajuste: nunca se convierte solo en merma ni en venta. Aquí no hay costes (informe aparte).
import type { State, Movement, DayClose, DaySnapshot } from "./schema.js";
import { closeLineOf, undoneMovements } from "./sales.js";
import { saleValueOn } from "./value.js";
import { localDate } from "./messages.js";

export type DaySummary = {
  date: string;
  /** Cálculo de ahora mismo con el libro de movimientos. */
  live: DaySnapshot;
  /** Registro del cierre, si el día se confirmó alguna vez (cerrado o reabierto). */
  close: DayClose | null;
  closed: boolean;
  /** Día cerrado cuyo cálculo de ahora ya no coincide con la instantánea guardada. */
  drift: boolean;
  /** DERIVADO: venta real − venta estimada de la instantánea (o del cálculo vivo). null si falta alguna. */
  difference: number | null;
};
const kg = (n: number): number => Math.round(n * 1000) / 1000;
const euros = (quantity: number, perKg: number | null): number | null =>
  perKg === null ? null : Math.round(quantity * perKg);
export const dayCloseId = (date: string): string => "day-" + date;

/** Día de negocio de un movimiento: el del cierre o la producción; si no, su hora menos el cambio de día. */
function movementDay(s: State, m: Movement, changeHour: number): string {
  const line = closeLineOf(m);
  if (line) return line.date;
  if (m.production) {
    const p = s.productions.find((x) => x.id === m.production);
    if (p) return p.date;
  }
  return localDate(new Date(Date.parse(m.at) - changeHour * 3_600_000));
}

/** Cálculo vivo de un día de negocio para los productos terminados (los que produce una receta). */
export function computeDay(
  s: State,
  date: string,
  changeHour = 5,
): DaySnapshot {
  const finished = new Set(
    s.recipes.map((r) => r.product).filter((id): id is string => !!id),
  );
  const undone = undoneMovements(s);
  type Acc = {
    produced: number;
    sold: number;
    waste: number;
    gift: number;
    adjust: number;
    after: number;
    touched: boolean;
  };
  const acc = new Map<string, Acc>();
  for (const id of finished)
    acc.set(id, {
      produced: 0,
      sold: 0,
      waste: 0,
      gift: 0,
      adjust: 0,
      after: 0,
      touched: false,
    });
  for (const m of s.movements) {
    const a = acc.get(m.product);
    // A compensated movement and its compensation add up to zero: neither counts anywhere.
    if (!a || undone.has(m.id) || m.reverses) continue;
    const day = movementDay(s, m, changeHour);
    if (day > date) {
      a.after += m.delta;
      continue;
    }
    if (day < date) continue;
    a.touched = true;
    const line = closeLineOf(m);
    if (line?.kind === "sale") a.sold += -m.delta;
    else if (line?.kind === "waste") a.waste += -m.delta;
    else if (line?.kind === "gift") a.gift += -m.delta;
    else if (m.kind === "output") a.produced += m.delta;
    else a.adjust += m.delta;
  }
  const rows: DaySnapshot["rows"] = [];
  for (const [id, a] of acc) {
    const p = s.products.find((x) => x.id === id);
    if (!p) continue;
    const remaining = kg(p.stock - a.after);
    const opening = kg(
      remaining - a.produced + a.sold + a.waste + a.gift - a.adjust,
    );
    if (!a.touched && !remaining && !opening) continue;
    const value = saleValueOn(s, id, date);
    rows.push({
      product: id,
      name: p.name,
      opening,
      produced: kg(a.produced),
      sold: kg(a.sold),
      waste: kg(a.waste),
      gift: kg(a.gift),
      adjust: kg(a.adjust),
      remaining,
      saleValue: value,
      soldCents: euros(a.sold, value),
      wasteCents: euros(a.waste, value),
      giftCents: euros(a.gift, value),
    });
  }
  rows.sort((x, y) => x.name.localeCompare(y.name, "es"));
  const sum = (pick: (r: DaySnapshot["rows"][number]) => number): number =>
    kg(rows.reduce((n, r) => n + pick(r), 0));
  // A gelato with kilos but without value makes the total «No disponible»: no partial sums.
  const money = (
    pick: (r: DaySnapshot["rows"][number]) => number | null,
  ): number | null => {
    let n = 0;
    for (const r of rows) {
      const v = pick(r);
      if (v === null) return null;
      n += v;
    }
    return n;
  };
  return {
    rows,
    totals: {
      opening: sum((r) => r.opening),
      produced: sum((r) => r.produced),
      sold: sum((r) => r.sold),
      waste: sum((r) => r.waste),
      gift: sum((r) => r.gift),
      adjust: sum((r) => r.adjust),
      remaining: sum((r) => r.remaining),
      soldCents: money((r) => (r.sold ? r.soldCents : 0)),
      wasteCents: money((r) => (r.waste ? r.wasteCents : 0)),
      giftCents: money((r) => (r.gift ? r.giftCents : 0)),
    },
  };
}
export const isDayClosed = (s: State, date: string): boolean =>
  s.days.some((d) => d.date === date && d.status === "closed");

export function daySummary(s: State, date: string, changeHour = 5): DaySummary {
  const live = computeDay(s, date, changeHour);
  const close = s.days.find((d) => d.date === date) ?? null;
  const closed = close?.status === "closed";
  const shown = closed && close ? close.snapshot : live;
  const real = closed ? (close?.realSaleCents ?? null) : null;
  return {
    date,
    live,
    close,
    closed,
    drift: closed && JSON.stringify(close?.snapshot) !== JSON.stringify(live),
    difference:
      real === null || shown.totals.soldCents === null
        ? null
        : real - shown.totals.soldCents,
  };
}
