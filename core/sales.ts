// Ventas y mermas de producto terminado: motivos de merma e historial de cierres de día.
// Todo sale de los movimientos registrados; un movimiento deshecho (compensado) no cuenta.
import type { State } from "./schema.js";

export const wasteReasons = [
  "expiry",
  "texture",
  "display",
  "accident",
  "tasting",
  "other",
] as const;
export type WasteReason = (typeof wasteReasons)[number];
export const wasteReasonLabels: Record<WasteReason, string> = {
  expiry: "Fin de vida útil",
  texture: "Textura o cristalización",
  display: "Vitrina o temperatura",
  accident: "Caída o rotura",
  tasting: "Degustación o invitación",
  other: "Otro motivo",
};
const unknownReason = "Sin motivo";
/** Texto del movimiento: «Merma del día AAAA-MM-DD · Motivo». El motivo es opcional. */
export const wasteReasonText = (date: string, reason?: WasteReason): string =>
  `Merma del día ${date}` + (reason ? ` · ${wasteReasonLabels[reason]}` : "");
const salePattern = /^Venta del día (\d{4}-\d{2}-\d{2})/;
const wastePattern = /^Merma del día (\d{4}-\d{2}-\d{2})(?: · (.+))?$/;

/** Una línea viva de un cierre: una venta o una merma, con su movimiento de origen. */
export type CloseLine = {
  id: string;
  product: string;
  name: string;
  kind: "sale" | "waste";
  quantity: number;
  reason: string;
};
export type DayClose = {
  date: string;
  lines: CloseLine[];
  sold: number;
  waste: number;
  /** DERIVADO: merma / (vendido + merma), en %. null si no hubo ni venta ni merma. */
  wastePct: number | null;
  products: number;
};
export type SalesHistory = {
  from: string;
  to: string;
  days: DayClose[];
  totals: { sold: number; waste: number; wastePct: number | null };
  byProduct: { product: string; name: string; sold: number; waste: number }[];
  byReason: { reason: string; waste: number }[];
};
const round = (n: number): number => Math.round(n * 1000) / 1000;
const pct = (waste: number, sold: number): number | null =>
  waste + sold > 0 ? Math.round((waste / (waste + sold)) * 1000) / 10 : null;
/** Identificadores de movimientos que fueron compensados después. */
export const undoneMovements = (s: State): Set<string> =>
  new Set(
    s.movements.map((m) => m.reverses).filter((id): id is string => !!id),
  );
/** Día de negocio y tipo de un movimiento de cierre; null si el movimiento no es de un cierre. */
export function closeLineOf(m: {
  kind: string;
  reason: string;
}): { date: string; kind: "sale" | "waste"; reason: string } | null {
  if (m.kind === "exit") {
    const date = salePattern.exec(m.reason)?.[1];
    return date ? { date, kind: "sale", reason: "" } : null;
  }
  if (m.kind === "waste") {
    const found = wastePattern.exec(m.reason);
    return found?.[1]
      ? { date: found[1], kind: "waste", reason: found[2] ?? unknownReason }
      : null;
  }
  return null;
}
/** Movimientos vivos del cierre de un día (para deshacerlo o para saber si ya se cerró). */
export function closeMovements(s: State, date: string): State["movements"] {
  const undone = undoneMovements(s);
  return s.movements.filter((m) => {
    if (undone.has(m.id) || m.reverses) return false;
    if (m.kind === "exit") return salePattern.exec(m.reason)?.[1] === date;
    if (m.kind === "waste") return wastePattern.exec(m.reason)?.[1] === date;
    return false;
  });
}
/** Historial de cierres entre dos días (incluidos), por día de negocio y no por hora de registro. */
export function salesHistory(s: State, from: string, to: string): SalesHistory {
  const undone = undoneMovements(s);
  const days = new Map<
    string,
    { sold: number; waste: number; products: Set<string>; lines: CloseLine[] }
  >();
  const nameOf = (id: string): string =>
    s.products.find((x) => x.id === id)?.name ?? "Producto eliminado";
  const products = new Map<string, { sold: number; waste: number }>();
  const reasons = new Map<string, number>();
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const sale = m.kind === "exit" ? salePattern.exec(m.reason) : null;
    const waste = m.kind === "waste" ? wastePattern.exec(m.reason) : null;
    const date = sale?.[1] ?? waste?.[1];
    if (!date || date < from || date > to) continue;
    const qty = Math.abs(m.delta);
    const day = days.get(date) ?? {
      sold: 0,
      waste: 0,
      products: new Set(),
      lines: [],
    };
    day.lines.push({
      id: m.id,
      product: m.product,
      name: nameOf(m.product),
      kind: sale ? "sale" : "waste",
      quantity: qty,
      reason: sale ? "" : (waste?.[2] ?? unknownReason),
    });
    days.set(date, day);
    day.products.add(m.product);
    const p = products.get(m.product) ?? { sold: 0, waste: 0 };
    products.set(m.product, p);
    if (sale) {
      day.sold += qty;
      p.sold += qty;
    } else {
      day.waste += qty;
      p.waste += qty;
      const reason = waste?.[2] ?? unknownReason;
      reasons.set(reason, (reasons.get(reason) ?? 0) + qty);
    }
  }
  const list: DayClose[] = [...days.entries()]
    .map(([date, d]) => ({
      date,
      lines: d.lines,
      sold: round(d.sold),
      waste: round(d.waste),
      wastePct: pct(d.waste, d.sold),
      products: d.products.size,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const sold = round(list.reduce((n, d) => n + d.sold, 0));
  const waste = round(list.reduce((n, d) => n + d.waste, 0));
  return {
    from,
    to,
    days: list,
    totals: { sold, waste, wastePct: pct(waste, sold) },
    byProduct: [...products.entries()]
      .map(([product, v]) => ({
        product,
        name:
          s.products.find((x) => x.id === product)?.name ??
          "Producto eliminado",
        sold: round(v.sold),
        waste: round(v.waste),
      }))
      .sort((a, b) => b.sold - a.sold || b.waste - a.waste),
    byReason: [...reasons.entries()]
      .map(([reason, w]) => ({ reason, waste: round(w) }))
      .sort((a, b) => b.waste - a.waste),
  };
}
