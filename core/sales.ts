// Ventas, mermas e invitaciones de producto terminado: categorías, motivos e historial de cierres.
// Todo sale de los movimientos registrados; un movimiento deshecho (compensado) no cuenta.
// Tres salidas distintas que nunca se mezclan:
//   venta                 «Venta del día AAAA-MM-DD»                 (movimiento exit)
//   merma                 «Merma del día AAAA-MM-DD · Motivo»        (movimiento waste)
//   invitación o consumo  «Invitación o consumo del día AAAA-MM-DD»  (movimiento exit)
// La merma es producto que se perdió; la invitación o el consumo del equipo es producto que se
// aprovechó sin cobrarlo. El porcentaje de merma se calcula solo con merma.
import type { State } from "./schema.js";

export const wasteReasons = [
  "expiry",
  "texture",
  "display",
  "accident",
  "other",
] as const;
export type WasteReason = (typeof wasteReasons)[number];
export const wasteReasonLabels: Record<WasteReason, string> = {
  expiry: "Fin de vida útil",
  texture: "Textura o cristalización",
  display: "Vitrina o temperatura",
  accident: "Caída o rotura",
  other: "Otro motivo",
};
export const giftLabel = "Invitación o consumo";
// Until 0.28.0 tastings were stored as a waste reason. Movements are never rewritten: readers
// simply recognise that old text and count it where it belongs.
const legacyGiftReason = "Degustación o invitación";
const unknownReason = "Sin motivo";
/** Texto del movimiento: «Merma del día AAAA-MM-DD · Motivo». El motivo es opcional. */
export const wasteReasonText = (date: string, reason?: WasteReason): string =>
  `Merma del día ${date}` + (reason ? ` · ${wasteReasonLabels[reason]}` : "");
export const giftText = (date: string): string =>
  `${giftLabel} del día ${date}`;
/**
 * Texto de una merma registrada en Inventario (un ingrediente, no el cierre del día):
 * «Merma · Motivo» y, si la persona lo escribe, « · detalle». Los motivos son los mismos
 * que los del cierre a propósito, para poder comparar las dos mermas.
 * Nunca empieza por «Merma del día», así que closeLineOf no lo confunde con un cierre.
 */
export const stockWasteText = (reason: WasteReason, detail?: string): string =>
  `Merma · ${wasteReasonLabels[reason]}` +
  (detail?.trim() ? ` · ${detail.trim()}` : "");
const stockWastePattern = /^Merma · ([^·]+?)\s*(?: · |$)/;
const labelOfReason = new Map<string, WasteReason>(
  (Object.entries(wasteReasonLabels) as [WasteReason, string][]).map(
    ([key, label]) => [label, key],
  ),
);
/**
 * Motivo de cualquier merma viva, venga del cierre del día o de Inventario, como etiqueta.
 * «Sin motivo» cuando el movimiento no lo dice (las mermas anteriores a esta versión, que
 * llevan el texto que escribió la persona). null si el movimiento no es una merma.
 */
export function wasteLabelOf(m: {
  kind: string;
  reason: string;
}): string | null {
  if (m.kind !== "waste") return null;
  const close = closeLineOf(m);
  // Un texto antiguo de degustación se lee como invitación, y eso no es merma.
  if (close) return close.kind === "waste" ? close.reason : null;
  const found = stockWastePattern.exec(m.reason)?.[1]?.trim();
  return (found && labelOfReason.has(found) ? found : null) ?? unknownReason;
}
const salePattern = /^Venta del día (\d{4}-\d{2}-\d{2})/;
const giftPattern = /^Invitación o consumo del día (\d{4}-\d{2}-\d{2})/;
// Motivo y, tras otro « · », el detalle opcional de una merma de gelato apuntada en Inventario.
const wastePattern =
  /^Merma del día (\d{4}-\d{2}-\d{2})(?: · ([^·]+?))?(?: · (.+))?$/;

export type CloseKind = "sale" | "waste" | "gift";
/** Una línea viva de un cierre, con su movimiento de origen. */
export type CloseLine = {
  id: string;
  product: string;
  name: string;
  kind: CloseKind;
  quantity: number;
  reason: string;
};
export type DayClose = {
  date: string;
  lines: CloseLine[];
  sold: number;
  waste: number;
  gift: number;
  /** DERIVADO: merma / (vendido + merma + invitación), en %. null si no salió nada. */
  wastePct: number | null;
  products: number;
};
export type SalesHistory = {
  from: string;
  to: string;
  days: DayClose[];
  totals: {
    sold: number;
    waste: number;
    gift: number;
    wastePct: number | null;
  };
  byProduct: {
    product: string;
    name: string;
    sold: number;
    waste: number;
    gift: number;
  }[];
  byReason: { reason: string; waste: number }[];
};
const round = (n: number): number => Math.round(n * 1000) / 1000;
const pct = (waste: number, out: number): number | null =>
  out > 0 ? Math.round((waste / out) * 1000) / 10 : null;
/** Identificadores de movimientos que fueron compensados después. */
export const undoneMovements = (s: State): Set<string> =>
  new Set(
    s.movements.map((m) => m.reverses).filter((id): id is string => !!id),
  );
/** Día de negocio y categoría de un movimiento de cierre; null si no es de un cierre. */
export function closeLineOf(m: {
  kind: string;
  reason: string;
}): { date: string; kind: CloseKind; reason: string } | null {
  if (m.kind === "exit") {
    const sale = salePattern.exec(m.reason)?.[1];
    if (sale) return { date: sale, kind: "sale", reason: "" };
    const gift = giftPattern.exec(m.reason)?.[1];
    return gift ? { date: gift, kind: "gift", reason: "" } : null;
  }
  if (m.kind === "waste") {
    const found = wastePattern.exec(m.reason);
    if (!found?.[1]) return null;
    return found[2] === legacyGiftReason
      ? { date: found[1], kind: "gift", reason: "" }
      : { date: found[1], kind: "waste", reason: found[2] ?? unknownReason };
  }
  return null;
}
/** Movimientos vivos del cierre de un día (para deshacerlo o para saber si ya se cerró). */
export function closeMovements(s: State, date: string): State["movements"] {
  const undone = undoneMovements(s);
  return s.movements.filter(
    (m) => !undone.has(m.id) && !m.reverses && closeLineOf(m)?.date === date,
  );
}
/** Historial de cierres entre dos días (incluidos), por día de negocio y no por hora de registro. */
export function salesHistory(s: State, from: string, to: string): SalesHistory {
  const undone = undoneMovements(s);
  type Sum = { sold: number; waste: number; gift: number };
  const days = new Map<
    string,
    Sum & { products: Set<string>; lines: CloseLine[] }
  >();
  const products = new Map<string, Sum>();
  const reasons = new Map<string, number>();
  const nameOf = (id: string): string =>
    s.products.find((x) => x.id === id)?.name ?? "Producto eliminado";
  const field = { sale: "sold", waste: "waste", gift: "gift" } as const;
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const line = closeLineOf(m);
    if (!line || line.date < from || line.date > to) continue;
    const qty = Math.abs(m.delta);
    const day = days.get(line.date) ?? {
      sold: 0,
      waste: 0,
      gift: 0,
      products: new Set<string>(),
      lines: [],
    };
    days.set(line.date, day);
    day.products.add(m.product);
    day.lines.push({
      id: m.id,
      product: m.product,
      name: nameOf(m.product),
      kind: line.kind,
      quantity: qty,
      reason: line.reason,
    });
    const p = products.get(m.product) ?? { sold: 0, waste: 0, gift: 0 };
    products.set(m.product, p);
    day[field[line.kind]] += qty;
    p[field[line.kind]] += qty;
    if (line.kind === "waste")
      reasons.set(line.reason, (reasons.get(line.reason) ?? 0) + qty);
  }
  const list: DayClose[] = [...days.entries()]
    .map(([date, d]) => ({
      date,
      lines: d.lines,
      sold: round(d.sold),
      waste: round(d.waste),
      gift: round(d.gift),
      wastePct: pct(d.waste, d.sold + d.waste + d.gift),
      products: d.products.size,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = (k: keyof Sum): number =>
    round(list.reduce((n, d) => n + d[k], 0));
  const sold = total("sold");
  const waste = total("waste");
  const gift = total("gift");
  return {
    from,
    to,
    days: list,
    totals: { sold, waste, gift, wastePct: pct(waste, sold + waste + gift) },
    byProduct: [...products.entries()]
      .map(([product, v]) => ({
        product,
        name: nameOf(product),
        sold: round(v.sold),
        waste: round(v.waste),
        gift: round(v.gift),
      }))
      .sort((a, b) => b.sold - a.sold || b.waste - a.waste),
    byReason: [...reasons.entries()]
      .map(([reason, w]) => ({ reason, waste: round(w) }))
      .sort((a, b) => b.waste - a.waste),
  };
}

/**
 * Objetivo de merma de un producto, comprobado sobre los últimos días.
 * Dos hechos con su fórmula a la vista, nunca una previsión:
 *   merma  = lo que se apuntó como merma en esos días (cierre del día e Inventario).
 *   salió  = todo lo que salió del producto en esos días (ventas, consumo, mermas e
 *            invitaciones). Los conteos no cuentan: un ajuste de inventario no es una salida.
 *   pct    = merma ÷ salió × 100; null si no salió nada.
 * Un movimiento compensado, y su compensación, no cuentan.
 */
export type WasteGoalStatus = {
  product: string;
  name: string;
  unit: string;
  mode: "quantity" | "pct";
  goal: number;
  days: number;
  waste: number;
  out: number;
  pct: number | null;
  over: boolean;
};
export function wasteGoals(
  s: State,
  days = 7,
  today = new Date(),
): WasteGoalStatus[] {
  const from = new Date(today.getTime() - (days - 1) * 86400000);
  const fromDay = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const undone = undoneMovements(s);
  const sums = new Map<string, { waste: number; out: number }>();
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const at = new Date(m.at);
    const day =
      closeLineOf(m)?.date ??
      `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    if (day < fromDay) continue;
    if (m.delta >= 0 || m.kind === "count") continue;
    const row = sums.get(m.product) ?? { waste: 0, out: 0 };
    sums.set(m.product, row);
    row.out += Math.abs(m.delta);
    if (m.kind === "waste") row.waste += Math.abs(m.delta);
  }
  return s.products
    .filter((p) => p.wasteGoal)
    .map((p) => {
      const goal = p.wasteGoal!;
      const row = sums.get(p.id) ?? { waste: 0, out: 0 };
      const waste = round(row.waste);
      const out = round(row.out);
      const share = pct(waste, out);
      return {
        product: p.id,
        name: p.name,
        unit: p.unit,
        mode: goal.mode,
        goal: goal.value,
        days,
        waste,
        out,
        pct: share,
        over:
          goal.mode === "quantity"
            ? waste > goal.value
            : share !== null && share > goal.value,
      };
    })
    .sort((a, b) => Number(b.over) - Number(a.over) || b.waste - a.waste);
}
