// Calendario: años → meses → días → ficha del día. Solo hechos ya guardados (cierres,
// producciones, pedidos, entregas y mensajes), contados por día de negocio. Nada se estima:
// un día sin datos es un día sin datos. La marca «La tienda no abrió» la pone la persona.
import type { State } from "./schema.js";
import { closeLineOf, undoneMovements, wasteLabelOf } from "./sales.js";
import {
  daySummary,
  movementDay,
  notOpenedOn,
  type DaySummary,
} from "./day.js";
import { localDate } from "./messages.js";

export type CalendarDay = {
  date: string;
  /** Kilos de gelato del día de negocio (hechos de los movimientos vivos). */
  produced: number;
  sold: number;
  waste: number;
  gift: number;
  /** Cierre confirmado vigente (no reabierto). */
  confirmed: boolean;
  notOpened: { reason: string } | null;
  /** Pedidos creados ese día, entregas recibidas, pedidos con entrega prevista y mensajes. */
  orders: number;
  receipts: number;
  expected: number;
  messages: number;
};
export type CalendarMonth = {
  month: string;
  days: CalendarDay[];
  /** Sumas del mes: kilos de gelato y número de días. */
  totals: {
    produced: number;
    sold: number;
    waste: number;
    daysWithSales: number;
    confirmed: number;
    notOpened: number;
    orders: number;
    receipts: number;
    messages: number;
  };
};
export type CalendarYear = {
  year: number;
  months: (CalendarMonth["totals"] & { month: string })[];
};

const kg = (n: number): number => Math.round(n * 1000) / 1000;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const pad = (n: number): string => String(n).padStart(2, "0");
const daysIn = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();
/** Día de negocio de una hora guardada: antes de la hora de cambio todavía es «ayer». */
const dayOf = (at: string, changeHour: number): string =>
  localDate(new Date(Date.parse(at) - changeHour * 3_600_000));

function blank(date: string, s: State): CalendarDay {
  const mark = notOpenedOn(s, date);
  return {
    date,
    produced: 0,
    sold: 0,
    waste: 0,
    gift: 0,
    confirmed: s.days.some((d) => d.date === date && d.status === "closed"),
    notOpened: mark ? { reason: mark.reason } : null,
    orders: 0,
    receipts: 0,
    expected: 0,
    messages: 0,
  };
}

/** Todos los días entre from y to (incluidos), en una sola pasada por los registros. */
function collect(
  s: State,
  from: string,
  to: string,
  changeHour: number,
): Map<string, CalendarDay> {
  const out = new Map<string, CalendarDay>();
  const slot = (date: string): CalendarDay | undefined =>
    date < from || date > to
      ? undefined
      : (out.get(date) ?? out.set(date, blank(date, s)).get(date));
  const finished = new Set(
    s.recipes.map((r) => r.product).filter((id): id is string => !!id),
  );
  const undone = undoneMovements(s);
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const day = movementDay(s, m, changeHour);
    if (m.kind === "receipt") {
      const d = slot(day);
      if (d) d.receipts++;
      continue;
    }
    if (!finished.has(m.product)) continue;
    const d = slot(day);
    if (!d) continue;
    const line = closeLineOf(m);
    if (line?.kind === "sale") d.sold += -m.delta;
    else if (line?.kind === "waste") d.waste += -m.delta;
    else if (line?.kind === "gift") d.gift += -m.delta;
    else if (m.kind === "output") d.produced += m.delta;
  }
  for (const o of s.orders) {
    const d = slot(dayOf(o.at, changeHour));
    if (d) d.orders++;
    if (o.expected && !["received", "cancelled"].includes(o.status)) {
      const e = slot(o.expected);
      if (e) e.expected++;
    }
  }
  for (const m of s.messages) {
    const d = slot(dayOf(m.at, changeHour));
    if (d) d.messages++;
  }
  for (const d of out.values()) {
    d.produced = kg(d.produced);
    d.sold = kg(d.sold);
    d.waste = kg(d.waste);
    d.gift = kg(d.gift);
  }
  return out;
}

function totals(days: CalendarDay[]): CalendarMonth["totals"] {
  return {
    produced: kg(days.reduce((n, d) => n + d.produced, 0)),
    sold: kg(days.reduce((n, d) => n + d.sold, 0)),
    waste: kg(days.reduce((n, d) => n + d.waste, 0)),
    daysWithSales: days.filter((d) => d.sold > 0).length,
    confirmed: days.filter((d) => d.confirmed).length,
    notOpened: days.filter((d) => d.notOpened).length,
    orders: days.reduce((n, d) => n + d.orders, 0),
    receipts: days.reduce((n, d) => n + d.receipts, 0),
    messages: days.reduce((n, d) => n + d.messages, 0),
  };
}

/** Un mes («2026-10»): una fila por día, también los que no tienen nada. */
export function calendarMonth(
  s: State,
  month: string,
  changeHour = 5,
): CalendarMonth {
  if (!monthPattern.test(month)) throw new Error("Mes inválido.");
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = daysIn(y, m);
  const from = `${month}-01`;
  const to = `${month}-${pad(last)}`;
  const found = collect(s, from, to, changeHour);
  const days: CalendarDay[] = [];
  for (let i = 1; i <= last; i++) {
    const date = `${month}-${pad(i)}`;
    days.push(found.get(date) ?? blank(date, s));
  }
  return { month, days, totals: totals(days) };
}

/** Un año: las sumas de cada uno de sus doce meses. */
export function calendarYear(
  s: State,
  year: number,
  changeHour = 5,
): CalendarYear {
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new Error("Año inválido.");
  const found = collect(s, `${year}-01-01`, `${year}-12-31`, changeHour);
  const months: CalendarYear["months"] = [];
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${pad(m)}`;
    const days: CalendarDay[] = [];
    for (let i = 1; i <= daysIn(year, m); i++) {
      const date = `${month}-${pad(i)}`;
      days.push(found.get(date) ?? blank(date, s));
    }
    months.push({ month, ...totals(days) });
  }
  return { year, months };
}

export type DayCard = {
  date: string;
  notOpened: { reason: string; at: string } | null;
  /** Resumen del día de negocio (core/day.ts): lo mismo que el cierre del día. */
  summary: DaySummary;
  /** Mermas del día por motivo, en su unidad: gelato del cierre e ingredientes de Inventario. */
  waste: { name: string; unit: string; quantity: number; reason: string }[];
  productions: {
    name: string;
    quantity: number;
    status: "proposed" | "applied" | "discarded";
  }[];
  orders: { number: string; supplier: string; status: string; sent: boolean }[];
  expected: {
    number: string;
    supplier: string;
    status: string;
    sent: boolean;
  }[];
  receipts: { name: string; unit: string; quantity: number }[];
  messages: { supplier: string; count: number }[];
};

/** Ficha de un día: todo lo guardado de ese día de negocio. */
export function dayCard(s: State, date: string, changeHour = 5): DayCard {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    localDate(new Date(date + "T12:00:00")) !== date
  )
    throw new Error("Día inválido.");
  const undone = undoneMovements(s);
  const product = (id: string) => s.products.find((p) => p.id === id);
  const supplier = (id: string) =>
    s.suppliers.find((x) => x.id === id)?.name ?? "Proveedor desconocido";
  const waste = new Map<string, DayCard["waste"][number]>();
  const receipts = new Map<string, DayCard["receipts"][number]>();
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    if (m.kind !== "waste" && m.kind !== "receipt") continue;
    if (movementDay(s, m, changeHour) !== date) continue;
    const p = product(m.product);
    if (!p) continue;
    if (m.kind === "receipt") {
      const r = receipts.get(p.id) ?? {
        name: p.name,
        unit: p.unit,
        quantity: 0,
      };
      r.quantity = kg(r.quantity + m.delta);
      receipts.set(p.id, r);
      continue;
    }
    const reason = wasteLabelOf(m);
    // Un texto antiguo de degustación es invitación, no merma.
    if (reason === null) continue;
    const key = p.id + "|" + reason;
    const w = waste.get(key) ?? {
      name: p.name,
      unit: p.unit,
      quantity: 0,
      reason,
    };
    w.quantity = kg(w.quantity - m.delta);
    waste.set(key, w);
  }
  const messages = new Map<string, number>();
  for (const m of s.messages)
    if (dayOf(m.at, changeHour) === date)
      messages.set(
        supplier(m.supplier),
        (messages.get(supplier(m.supplier)) ?? 0) + 1,
      );
  const mark = notOpenedOn(s, date);
  return {
    date,
    notOpened: mark ? { reason: mark.reason, at: mark.at } : null,
    summary: daySummary(s, date, changeHour),
    waste: [...waste.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    ),
    productions: s.productions
      .filter((p) => p.date === date)
      .map((p) => ({ name: p.name, quantity: p.quantity, status: p.status })),
    orders: s.orders
      .filter((o) => dayOf(o.at, changeHour) === date)
      .map((o) => ({
        number: o.number,
        supplier: supplier(o.supplier),
        status: o.status,
        sent: !!o.dispatch,
      })),
    expected: s.orders
      .filter((o) => o.expected === date)
      .map((o) => ({
        number: o.number,
        supplier: supplier(o.supplier),
        status: o.status,
        sent: !!o.dispatch,
      })),
    receipts: [...receipts.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    ),
    messages: [...messages.entries()]
      .map(([name, count]) => ({ supplier: name, count }))
      .sort(
        (a, b) =>
          b.count - a.count || a.supplier.localeCompare(b.supplier, "es"),
      ),
  };
}
