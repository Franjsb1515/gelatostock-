// Ficha de producción diaria (Calendario), como la hoja «Producción gelato Artello» del usuario.
// Cada dato dice de dónde sale:
//   medido      → la pesada de la mañana que escribe la persona (state.weighings); no mueve stock.
//   confirmado  → producción aprobada, ventas, mermas, invitaciones y entradas o salidas apuntadas.
//   estimado    → lo calculado con su fórmula a la vista.
// Venta estimada de un sabor un día = pesada de esa mañana + producido − pesada de la mañana
// siguiente − merma − invitación + entradas y salidas a mano. Un conteo no entra: corrige el
// libro, no la cubeta. Si falta un dato, el resultado es null («No disponible») y se dice cuál.
import type { State } from "./schema.js";
import { closeLineOf, undoneMovements } from "./sales.js";
import { movementDay, productionDays } from "./day.js";
import { saleValueOn } from "./value.js";
import { addDays, kg } from "./util.js";

export type SheetFamily = "gelato" | "sorbetto";
export type SheetRow = {
  product: string;
  name: string;
  family: SheetFamily;
  /** Medido: pesada de la mañana de este día. */
  start: number | null;
  /** Stock de la app al empezar el día (lo que dice el libro), para compararlo con la pesada. */
  book: number;
  /** Confirmado: producción aprobada de este día. */
  produced: number;
  /** Medido: pesada de la mañana siguiente (lo que quedó al terminar este día). */
  end: number | null;
  /** Confirmado: merma, invitación y entradas o salidas a mano de este día. */
  waste: number;
  gift: number;
  moved: number;
  /** Hubo un conteo ese día: no entra en la cuenta y se avisa. */
  counted: boolean;
  /** Estimado. null si falta algún dato (ver missing). */
  sold: number | null;
  missing: string[];
  /** La cuenta da menos de cero: una pesada o un dato está mal. */
  impossible: boolean;
  /** Confirmado: venta apuntada en el cierre de ese día; null si no hay ninguna línea de venta. */
  registered: number | null;
  /** registered − sold, cuando están los dos. */
  difference: number | null;
  /** Sin pesadas, sin producción y sin nada apuntado: no cuenta en los totales. */
  noData: boolean;
  /** Valor de venta por kilo vigente ese día (céntimos) y facturaciones estimadas. */
  value: number | null;
  soldCents: number | null;
  referenceCents: number | null;
};
export type SheetTotals = {
  start: number | null;
  produced: number;
  end: number | null;
  waste: number;
  gift: number;
  moved: number;
  sold: number | null;
  registered: number | null;
  soldCents: number | null;
  referenceCents: number | null;
  /** Sabores que impiden el total (les falta un dato). */
  missing: string[];
  /** Ningún sabor de este grupo tiene datos ese día. */
  empty: boolean;
};
export type PeriodSummary = {
  from: string;
  to: string;
  produced: number;
  /** Suma de las ventas estimadas de los días con todos los datos. */
  sold: number;
  daysEstimated: number;
  /** Días con producción, con datos pero cero producción, y sin ningún dato. */
  daysProduced: number;
  daysZero: number;
  daysNoData: number;
  /** Días con algún dato cuya venta no se pudo estimar (falta una pesada). */
  daysMissing: number;
};
export type ProductionSheet = {
  date: string;
  today: string;
  rows: SheetRow[];
  totals: Record<SheetFamily | "all", SheetTotals>;
  /** Precio de referencia por kilo vigente ese día (céntimos); null si no hay. */
  referencePrice: number | null;
  /** Venta real de caja del cierre confirmado; null si no se escribió. */
  realSaleCents: number | null;
  closed: boolean;
  previous: PeriodSummary;
  week: PeriodSummary;
  /** Histórico desde el primer día con algún dato; null si no hay ninguno. */
  history: PeriodSummary | null;
};

type Acc = {
  produced: number;
  sold: number;
  waste: number;
  gift: number;
  moved: number;
  counted: boolean;
  sales: boolean;
};

/** Precio de referencia vigente un día: la entrada con el «desde» más alto que no pasa del día. */
export function referencePriceOn(s: State, date: string): number | null {
  let best: State["referencePrices"][number] | undefined;
  for (const v of s.referencePrices)
    if (v.from <= date && (!best || v.from >= best.from)) best = v;
  return best ? best.cents : null;
}

/** Una sola pasada por los movimientos: día → sabor → lo confirmado. */
function ledger(
  s: State,
  gelatos: Set<string>,
  changeHour: number,
): Map<string, Map<string, Acc>> {
  const out = new Map<string, Map<string, Acc>>();
  const undone = undoneMovements(s);
  const days = productionDays(s);
  for (const m of s.movements) {
    if (!gelatos.has(m.product) || undone.has(m.id) || m.reverses) continue;
    const day = movementDay(s, m, changeHour, days);
    const byProduct = out.get(day) ?? out.set(day, new Map()).get(day)!;
    const a =
      byProduct.get(m.product) ??
      byProduct
        .set(m.product, {
          produced: 0,
          sold: 0,
          waste: 0,
          gift: 0,
          moved: 0,
          counted: false,
          sales: false,
        })
        .get(m.product)!;
    const line = closeLineOf(m);
    if (line?.kind === "sale") {
      a.sold += -m.delta;
      a.sales = true;
    } else if (line?.kind === "waste" || m.kind === "waste")
      a.waste += -m.delta;
    else if (line?.kind === "gift") a.gift += -m.delta;
    else if (m.kind === "output") a.produced += m.delta;
    // El conteo que iguala el stock a la pesada no se avisa: es el punto de partida.
    else if (m.kind === "count")
      a.counted ||= !m.reason.startsWith("Pesada de la mañana");
    else a.moved += m.delta;
  }
  return out;
}

const familyOf = (f: string | undefined): SheetFamily =>
  f === "sorbete" ? "sorbetto" : "gelato";
const fmt = (d: string) => d.split("-").reverse().join("/");

export function productionSheet(
  s: State,
  date: string,
  today: string,
  changeHour = 5,
): ProductionSheet {
  const flavours: { product: string; name: string; family: SheetFamily }[] = [];
  for (const r of s.recipes) {
    if (!r.product || flavours.some((f) => f.product === r.product)) continue;
    const p = s.products.find((x) => x.id === r.product);
    if (p)
      flavours.push({
        product: p.id,
        name: p.name,
        family: familyOf(r.family),
      });
  }
  const gelatos = new Set(flavours.map((f) => f.product));
  const book = ledger(s, gelatos, changeHour);
  const weighed = new Map<string, number>();
  for (const w of s.weighings) weighed.set(w.date + "|" + w.product, w.kg);
  const weight = (d: string, p: string) => weighed.get(d + "|" + p) ?? null;
  const reference = (d: string) => referencePriceOn(s, d);

  // Lo que dice la app al empezar el día pedido: el stock de ahora menos lo de ese día en adelante.
  const bookStart = new Map<string, number>();
  {
    const undone = undoneMovements(s);
    const days = productionDays(s);
    for (const f of flavours)
      bookStart.set(
        f.product,
        s.products.find((p) => p.id === f.product)?.stock ?? 0,
      );
    for (const m of s.movements) {
      if (!gelatos.has(m.product) || undone.has(m.id) || m.reverses) continue;
      const day = movementDay(s, m, changeHour, days);
      // Un conteo de ese mismo día (igualar a la pesada) corrige el punto de partida: cuenta como «al empezar».
      if (day > date || (day === date && m.kind !== "count"))
        bookStart.set(m.product, (bookStart.get(m.product) ?? 0) - m.delta);
    }
  }
  const rowsOf = (d: string): SheetRow[] =>
    flavours.map((f) => {
      const a = book.get(d)?.get(f.product);
      const start = weight(d, f.product);
      const next = addDays(d, 1);
      const end = next > today ? null : weight(next, f.product);
      const produced = kg(a?.produced ?? 0);
      const waste = kg(a?.waste ?? 0);
      const gift = kg(a?.gift ?? 0);
      const moved = kg(a?.moved ?? 0);
      const missing: string[] = [];
      if (start === null) missing.push(`pesada de la mañana del ${fmt(d)}`);
      if (end === null)
        missing.push(
          next > today
            ? `pesada de la mañana del ${fmt(next)} (aún no ha llegado)`
            : `pesada de la mañana del ${fmt(next)}`,
        );
      const sold =
        start === null || end === null
          ? null
          : kg(start + produced - end - waste - gift + moved);
      const registered = a?.sales ? kg(a.sold) : null;
      const noData = start === null && end === null && !a;
      const value = saleValueOn(s, f.product, d);
      const ref = reference(d);
      return {
        ...f,
        start,
        produced,
        end,
        waste,
        gift,
        moved,
        counted: !!a?.counted,
        book: d === date ? kg(bookStart.get(f.product) ?? 0) : 0,
        sold,
        missing: noData ? [] : missing,
        impossible: sold !== null && sold < 0,
        registered,
        difference:
          registered !== null && sold !== null ? kg(registered - sold) : null,
        noData,
        value,
        soldCents:
          sold === null || value === null ? null : Math.round(sold * value),
        referenceCents:
          sold === null || ref === null ? null : Math.round(sold * ref),
      };
    });

  const total = (rows: SheetRow[], d: string): SheetTotals => {
    const used = rows.filter((r) => !r.noData);
    const sum = (pick: (r: SheetRow) => number) =>
      kg(used.reduce((n, r) => n + pick(r), 0));
    const all = <T>(pick: (r: SheetRow) => T | null): T[] | null => {
      const out: T[] = [];
      for (const r of used) {
        const v = pick(r);
        if (v === null) return null;
        out.push(v);
      }
      return out;
    };
    const starts = all((r) => r.start);
    const ends = all((r) => r.end);
    const solds = all((r) => r.sold);
    const money = all((r) => r.soldCents);
    const regs = used.filter((r) => r.registered !== null);
    const ref = reference(d);
    const soldTotal = solds ? kg(solds.reduce((n, v) => n + v, 0)) : null;
    return {
      start: starts ? kg(starts.reduce((n, v) => n + v, 0)) : null,
      produced: sum((r) => r.produced),
      end: ends ? kg(ends.reduce((n, v) => n + v, 0)) : null,
      waste: sum((r) => r.waste),
      gift: sum((r) => r.gift),
      moved: sum((r) => r.moved),
      sold: soldTotal,
      registered: regs.length
        ? kg(regs.reduce((n, r) => n + (r.registered ?? 0), 0))
        : null,
      soldCents: money ? money.reduce((n, v) => n + v, 0) : null,
      referenceCents:
        soldTotal === null || ref === null ? null : Math.round(soldTotal * ref),
      missing: used.filter((r) => r.sold === null).map((r) => r.name),
      empty: !used.length,
    };
  };

  // Resumen de un periodo, día a día. Un día cuenta como «con datos» si tiene pesada, producción
  // o algo apuntado de algún sabor.
  const period = (from: string, to: string): PeriodSummary => {
    const out: PeriodSummary = {
      from,
      to,
      produced: 0,
      sold: 0,
      daysEstimated: 0,
      daysProduced: 0,
      daysZero: 0,
      daysNoData: 0,
      daysMissing: 0,
    };
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const rows = rowsOf(d);
      const produced = kg(rows.reduce((n, r) => n + r.produced, 0));
      const hasData =
        book.has(d) || flavours.some((f) => weight(d, f.product) !== null);
      out.produced = kg(out.produced + produced);
      if (!hasData) out.daysNoData++;
      else if (produced > 0) out.daysProduced++;
      else out.daysZero++;
      if (!hasData) continue;
      const t = total(rows, d);
      if (t.sold === null) out.daysMissing++;
      else {
        out.sold = kg(out.sold + t.sold);
        out.daysEstimated++;
      }
    }
    return out;
  };

  const rows = rowsOf(date);
  const monday = addDays(
    date,
    -((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7),
  );
  const sunday = addDays(monday, 6);
  let first: string | null = null;
  for (const d of book.keys()) if (!first || d < first) first = d;
  for (const w of s.weighings)
    if (gelatos.has(w.product) && (!first || w.date < first)) first = w.date;
  const close = s.days.find((x) => x.date === date);
  return {
    date,
    today,
    rows,
    totals: {
      gelato: total(
        rows.filter((r) => r.family === "gelato"),
        date,
      ),
      sorbetto: total(
        rows.filter((r) => r.family === "sorbetto"),
        date,
      ),
      all: total(rows, date),
    },
    referencePrice: reference(date),
    realSaleCents:
      close?.status === "closed" ? (close.realSaleCents ?? null) : null,
    closed: close?.status === "closed",
    previous: period(addDays(date, -1), addDays(date, -1)),
    // Lunes a domingo; lo que aún no ha llegado no cuenta.
    week: period(monday, sunday < today ? sunday : today),
    history:
      first && first <= date
        ? period(first, date < today ? date : today)
        : null,
  };
}
