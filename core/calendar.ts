// Calendario: años → meses → días → ficha del día. Solo hechos ya guardados (cierres,
// producciones, pedidos, entregas y mensajes), contados por día de negocio. Nada se estima:
// un día sin datos es un día sin datos. La marca «La tienda no abrió», el horario semanal y las
// vacaciones los escribe la persona; los avisos del día salen de reglas visibles y solo avisan.
import type { State } from "./schema.js";
import { closeLineOf, undoneMovements, wasteLabelOf } from "./sales.js";
import {
  daySummary,
  movementDay,
  notOpenedOn,
  type DaySummary,
} from "./day.js";
import { localDate } from "./messages.js";
import { businessDay } from "./plan.js";

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
  /** Horario apuntado por la persona (null si no hay) y quién está de vacaciones. */
  hours: {
    closed: boolean;
    open: string | null;
    close: string | null;
    shifts: number;
  } | null;
  away: string[];
  /** Avisos de las reglas del día (solo en el mes). */
  alerts: number;
};
/** Aviso de una regla: solo avisa, no cambia nada. */
export type DayAlert = { date: string; text: string };
export type CalendarMonth = {
  month: string;
  days: CalendarDay[];
  alerts: DayAlert[];
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

const scheduleOn = (s: State, date: string) =>
  s.schedule.find((x) => x.date === date) ?? null;
const awayOn = (s: State, date: string) =>
  s.vacations.filter((v) => v.from <= date && date <= v.to);
const samePerson = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
const eur = (cents: number): string =>
  (cents / 100).toFixed(2).replace(".", ",") + " €";

function blank(date: string, s: State): CalendarDay {
  const mark = notOpenedOn(s, date);
  const plan = scheduleOn(s, date);
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
    hours: plan
      ? {
          closed: plan.closed,
          open: plan.open ?? null,
          close: plan.close ?? null,
          shifts: plan.shifts.length,
        }
      : null,
    away: awayOn(s, date).map((v) => v.person),
    alerts: 0,
  };
}

/** Primer día de negocio con una venta apuntada (viva): antes no se pide nada a los días. */
function firstSaleDay(s: State): string | null {
  const undone = undoneMovements(s);
  let first: string | null = null;
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const line = closeLineOf(m);
    if (line?.kind === "sale" && (!first || line.date < first))
      first = line.date;
  }
  return first;
}

/**
 * Auditoría de un día por reglas visibles. Solo avisa: nunca corrige nada.
 * today es el día de negocio de hoy; first, el primer día con ventas apuntadas.
 */
export function dayAlerts(
  s: State,
  date: string,
  changeHour: number,
  today: string,
  first: string | null,
): DayAlert[] {
  const out: string[] = [];
  const summary = daySummary(s, date, changeHour);
  const live = summary.live.totals;
  const mark = notOpenedOn(s, date);
  const plan = scheduleOn(s, date);
  const moved = !!(live.produced || live.sold || live.waste || live.gift);
  if (summary.drift)
    out.push(
      "El cierre confirmado ya no coincide con lo apuntado después: revisa el día o reábrelo.",
    );
  const shown =
    summary.closed && summary.close ? summary.close.snapshot.totals : live;
  if (
    summary.difference !== null &&
    shown.soldCents &&
    Math.abs(summary.difference) > shown.soldCents * 0.1
  )
    out.push(
      `La venta real se aparta más de un 10 % de la estimada (diferencia ${summary.difference < 0 ? "−" : "+"}${eur(Math.abs(summary.difference))}).`,
    );
  if (date < today && !summary.closed && moved)
    out.push("Día pasado con gelato apuntado y sin cierre confirmado.");
  if (
    date < today &&
    first !== null &&
    date >= first &&
    !moved &&
    !summary.closed &&
    !mark &&
    !plan?.closed
  )
    out.push("Día pasado sin ventas apuntadas ni marca «La tienda no abrió».");
  if (mark && moved)
    out.push(
      "Marcado «La tienda no abrió», pero tiene gelato hecho o mermado ese día.",
    );
  if (plan?.closed && live.sold)
    out.push("El horario decía cerrado y hay ventas apuntadas.");
  if (mark && plan?.shifts.length)
    out.push("Hay turnos un día que la tienda no abrió.");
  if (plan && !plan.closed && !plan.open && plan.shifts.length)
    out.push("Hay turnos pero falta el horario de apertura.");
  const away = awayOn(s, date);
  for (const t of plan?.shifts ?? [])
    if (away.some((v) => samePerson(v.person, t.person)))
      out.push(`${t.person} tiene turno y está de vacaciones.`);
  return out.map((text) => ({ date, text }));
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
  today = businessDay(new Date(), changeHour),
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
  const first = firstSaleDay(s);
  const alerts: DayAlert[] = [];
  for (const d of days) {
    const own = dayAlerts(s, d.date, changeHour, today, first);
    d.alerts = own.length;
    alerts.push(...own);
  }
  return { month, days, alerts, totals: totals(days) };
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
  /** Horario del día (null si no está apuntado) y vacaciones que lo tocan. */
  schedule: State["schedule"][number] | null;
  vacations: State["vacations"];
  /** Stock de cada producto al terminar el día, en su unidad. null si el día aún no ha llegado. */
  stock:
    { name: string; unit: string; quantity: number; gelato: boolean }[] | null;
  alerts: DayAlert[];
};

/** Lo que había de cada producto al terminar el día: el stock de ahora menos lo de días posteriores. */
function stockAt(
  s: State,
  date: string,
  changeHour: number,
): NonNullable<DayCard["stock"]> {
  const undone = undoneMovements(s);
  const later = new Map<string, number>();
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    if (movementDay(s, m, changeHour) > date)
      later.set(m.product, (later.get(m.product) ?? 0) + m.delta);
  }
  const finished = new Set(s.recipes.map((r) => r.product).filter(Boolean));
  return s.products
    .map((p) => ({
      name: p.name,
      unit: p.unit,
      quantity: kg(p.stock - (later.get(p.id) ?? 0)),
      gelato: finished.has(p.id),
    }))
    .sort(
      (a, b) =>
        Number(b.gelato) - Number(a.gelato) ||
        a.name.localeCompare(b.name, "es"),
    );
}

/** Ficha de un día: todo lo guardado de ese día de negocio. */
export function dayCard(
  s: State,
  date: string,
  changeHour = 5,
  today = businessDay(new Date(), changeHour),
): DayCard {
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
    schedule: scheduleOn(s, date),
    vacations: awayOn(s, date),
    stock: date > today ? null : stockAt(s, date, changeHour),
    alerts: dayAlerts(s, date, changeHour, today, firstSaleDay(s)),
  };
}
