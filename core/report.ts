// Weekly summary computed from the full state (movements, productions, orders, messages).
// Days are local calendar days; a week runs Monday to Sunday.
import type { State } from "./schema";
import { localDate } from "./messages";
import { closeLineOf } from "./sales";

export type WeeklyLine = {
  product: string;
  name: string;
  unit: string;
  quantity: number;
};
export type WeeklyReport = {
  start: string;
  end: string;
  days: {
    date: string;
    production: number;
    sales: number;
    waste: number;
    gift: number;
  }[];
  sales: WeeklyLine[];
  waste: WeeklyLine[];
  /** Invitación o consumo: sale del stock, pero no es merma ni venta. */
  gifts: WeeklyLine[];
  receipts: WeeklyLine[];
  production: { date: string; name: string; quantity: number }[];
  totals: {
    sales: number;
    waste: number;
    gifts: number;
    production: number;
    receipts: number;
    movements: number;
  };
  orders: { created: number; sent: number; received: number; spent: number };
  messages: { received: number; pending: number };
  lowStock: { name: string; stock: number; min: number; unit: string }[];
  priceChanges: { name: string; from: number; to: number; at: string }[];
};
export function weekStart(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return localDate(d);
}
const parts = (day: string): [number, number, number] => [
  Number(day.slice(0, 4)),
  Number(day.slice(5, 7)),
  Number(day.slice(8, 10)),
];
export function weekBounds(start: string): { start: string; end: string } {
  const [y, m, d] = parts(start);
  const first = new Date(y, m - 1, d);
  const last = new Date(y, m - 1, d + 6);
  return { start: localDate(first), end: localDate(last) };
}
export function weeklyReport(s: State, start: string): WeeklyReport {
  const { start: from, end: to } = weekBounds(start);
  const inWeek = (day: string) => day >= from && day <= to;
  const dayOf = (at: string) => localDate(new Date(at));
  const product = (id: string) => s.products.find((p) => p.id === id);
  const days: WeeklyReport["days"] = [];
  const [y, m, d] = parts(from);
  for (let i = 0; i < 7; i++) {
    days.push({
      date: localDate(new Date(y, m - 1, d + i)),
      production: 0,
      sales: 0,
      waste: 0,
      gift: 0,
    });
  }
  const dayRow = (day: string) => days.find((x) => x.date === day);
  const add = (lines: WeeklyLine[], id: string, qty: number) => {
    const p = product(id);
    if (!p) return;
    const line = lines.find((l) => l.product === id);
    if (line) line.quantity = Math.round((line.quantity + qty) * 1000) / 1000;
    else lines.push({ product: id, name: p.name, unit: p.unit, quantity: qty });
  };
  const sales: WeeklyLine[] = [],
    waste: WeeklyLine[] = [],
    gifts: WeeklyLine[] = [],
    receipts: WeeklyLine[] = [];
  let movements = 0;
  // A compensated movement (and its compensation) is not a sale, a waste or a receipt.
  const undone = new Set(s.movements.map((m) => m.reverses).filter(Boolean));
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    // A day close belongs to its business day, even if it was typed in the next morning.
    const close = closeLineOf(m);
    const day = close?.date ?? dayOf(m.at);
    if (!inWeek(day)) continue;
    movements++;
    const qty = Math.abs(m.delta);
    if (close?.kind === "sale") {
      add(sales, m.product, qty);
      const row = dayRow(day);
      if (row) row.sales += qty;
    } else if (close?.kind === "gift") {
      add(gifts, m.product, qty);
      const row = dayRow(day);
      if (row) row.gift += qty;
    } else if (m.kind === "waste") {
      add(waste, m.product, qty);
      const row = dayRow(day);
      if (row) row.waste += qty;
    } else if (m.kind === "receipt") add(receipts, m.product, qty);
  }
  const production = s.productions
    .filter((p) => p.status === "applied" && inWeek(p.date))
    .map((p) => ({
      date: p.date,
      name: p.name,
      quantity: p.output?.quantity ?? p.quantity,
    }));
  for (const p of production) {
    const row = dayRow(p.date);
    if (row) row.production += p.quantity;
  }
  const sum = (lines: { quantity: number }[]) =>
    Math.round(lines.reduce((n, l) => n + l.quantity, 0) * 1000) / 1000;
  const created = s.orders.filter((o) => inWeek(dayOf(o.at)));
  const orders = {
    created: created.length,
    sent: s.orders.filter((o) => o.dispatch && inWeek(dayOf(o.dispatch.at)))
      .length,
    received: s.orders.filter(
      (o) =>
        o.status === "received" &&
        s.movements.some(
          (m) =>
            m.order === o.id && m.kind === "receipt" && inWeek(dayOf(m.at)),
        ),
    ).length,
    spent: created.reduce(
      (n, o) => n + o.lines.reduce((t, l) => t + l.packs * l.price, 0),
      0,
    ),
  };
  const weekMessages = s.messages.filter((m) => inWeek(dayOf(m.at)));
  const messages = {
    received: weekMessages.length,
    pending: weekMessages.filter(
      (m) => m.interpretation?.needsReading && !m.reviewed,
    ).length,
  };
  const priceChanges = s.prices
    .filter((e) => inWeek(dayOf(e.at)))
    .map((e) => ({
      name: product(e.product)?.name ?? "",
      from: e.from,
      to: e.to,
      at: e.at,
    }));
  const lowStock = s.products
    .filter((p) => p.stock < p.min)
    .map((p) => ({ name: p.name, stock: p.stock, min: p.min, unit: p.unit }));
  for (const row of days) {
    row.production = Math.round(row.production * 1000) / 1000;
    row.sales = Math.round(row.sales * 1000) / 1000;
    row.waste = Math.round(row.waste * 1000) / 1000;
    row.gift = Math.round(row.gift * 1000) / 1000;
  }
  return {
    start: from,
    end: to,
    days,
    sales,
    waste,
    gifts,
    receipts,
    production,
    totals: {
      sales: sum(sales),
      waste: sum(waste),
      gifts: sum(gifts),
      production: sum(production),
      receipts: sum(receipts),
      movements,
    },
    orders,
    messages,
    lowStock,
    priceChanges,
  };
}
