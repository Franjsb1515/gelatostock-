// Valor de venta y coste del gelato, en euros por kilo. Dos informes separados que nunca se mezclan:
//   VENTA  kilos × valor de venta por kilo vigente ese día (lo escribe la persona en la receta).
//   COSTE  kilos × coste por kilo (calculado con los precios de compra, o escrito a mano).
// Todo es CONFIRMADO (lo escribió la persona), DERIVADO (con su fórmula) o null = «No disponible».
// Un valor que cambia hoy no reescribe el pasado: el historial de valores lleva fecha de inicio y
// cada producción aprobada guarda una instantánea de su coste.
import type { State, Recipe, Production } from "./schema.js";
import { closeLineOf, undoneMovements, type CloseKind } from "./sales.js";

export type CostSource = "calculated" | "manual";
export type RecipeCostLine = {
  product: string;
  name: string;
  quantity: number;
  unit: string;
  /** Céntimos por unidad base (precio de la presentación / tamaño). null: sin precio de compra. */
  unitCents: number | null;
  cents: number | null;
};
export type RecipeCost = {
  lines: RecipeCostLine[];
  /** Ingredientes sin precio de compra: con alguno, el coste calculado es «No disponible». */
  missing: string[];
  /** DERIVADO: Σ(cantidad × precio / presentación) / rendimiento, en céntimos por kilo. */
  calculated: number | null;
  /** CONFIRMADO: lo escribió la persona. Si existe, manda sobre el calculado. */
  manual: number | null;
  perKg: number | null;
  source: CostSource | null;
};
const kg = (n: number): number => Math.round(n * 1000) / 1000;
const euros = (quantity: number, centsPerKg: number): number =>
  Math.round(quantity * centsPerKg);

/** Céntimos por unidad base de un producto comprado; null si su ficha no tiene precio. */
function unitCents(s: State, id: string): number | null {
  const p = s.products.find((x) => x.id === id);
  return p && p.price > 0 && p.pack > 0 ? p.price / p.pack : null;
}
function costOfLines(
  s: State,
  lines: { product: string; quantity: number }[],
): { lines: RecipeCostLine[]; missing: string[]; total: number | null } {
  const out = lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const p = s.products.find((x) => x.id === l.product);
      const unit = unitCents(s, l.product);
      return {
        product: l.product,
        name: p?.name ?? "Producto eliminado",
        quantity: l.quantity,
        unit: p?.unit ?? "",
        unitCents: unit === null ? null : Math.round(unit * 100) / 100,
        cents: unit === null ? null : Math.round(l.quantity * unit),
      };
    });
  const missing = out.filter((l) => l.cents === null).map((l) => l.name);
  return {
    lines: out,
    missing,
    total:
      missing.length || !out.length
        ? null
        : out.reduce((n, l) => n + (l.cents ?? 0), 0),
  };
}
/** Coste por kilo de una receta hoy: calculado con los precios de compra y, si existe, el escrito a mano. */
export function recipeCost(s: State, r: Recipe): RecipeCost {
  const c = costOfLines(s, r.ingredients);
  const calculated = c.total === null ? null : Math.round(c.total / r.yield);
  const manual = r.manualCost?.cents ?? null;
  const perKg = manual ?? calculated;
  return {
    lines: c.lines,
    missing: c.missing,
    calculated,
    manual,
    perKg,
    source:
      manual !== null ? "manual" : calculated !== null ? "calculated" : null,
  };
}
/** Instantánea del coste de una producción al aprobarla, con su consumo real. undefined: no disponible. */
export function productionCost(
  s: State,
  r: Recipe,
  p: Pick<Production, "lines" | "quantity" | "output">,
): Production["cost"] {
  const made = p.output?.quantity ?? p.quantity;
  if (r.manualCost)
    return { cents: euros(made, r.manualCost.cents), source: "manual" };
  const c = costOfLines(s, p.lines);
  return c.total === null
    ? undefined
    : { cents: c.total, source: "calculated" };
}
/** Valor de venta por kilo (céntimos) de un producto terminado vigente un día de negocio. */
export function saleValueOn(
  s: State,
  product: string,
  date: string,
): number | null {
  for (const r of s.recipes) {
    if (r.product !== product || !r.saleValues.length) continue;
    let best: Recipe["saleValues"][number] | undefined;
    for (const v of r.saleValues)
      if (v.from <= date && (!best || v.from >= best.from)) best = v;
    return best ? best.cents : null;
  }
  return null;
}
const liveProductions = (s: State): Production[] =>
  s.productions.filter((p) => p.status === "applied" && !p.voidedAt);
/**
 * Coste por kilo de un producto terminado un día: el de su última producción aprobada hasta ese
 * día (instantánea); si ninguna lo tiene, el coste actual de su receta.
 */
export function costPerKgOn(
  s: State,
  product: string,
  date: string,
): { cents: number; source: CostSource; from: "production" | "recipe" } | null {
  let best: Production | undefined;
  for (const p of liveProductions(s)) {
    if (p.output?.product !== product || !p.cost || !p.output.quantity)
      continue;
    if (p.date > date) continue;
    if (!best || p.date > best.date || (p.date === best.date && p.at > best.at))
      best = p;
  }
  if (best?.cost && best.output)
    return {
      cents: Math.round(best.cost.cents / best.output.quantity),
      source: best.cost.source,
      from: "production",
    };
  const r = s.recipes.find((x) => x.product === product);
  const c = r ? recipeCost(s, r) : null;
  return c && c.perKg !== null && c.source
    ? { cents: c.perKg, source: c.source, from: "recipe" }
    : null;
}

type Kg = { produced: number; sold: number; waste: number; gift: number };
/** Importes en céntimos; null = «No disponible» (falta el valor o el coste de algún gelato). */
type Cents = {
  produced: number | null;
  sold: number | null;
  waste: number | null;
  gift: number | null;
};
export type ValueRow = {
  product: string;
  name: string;
  kg: Kg;
  /** Informe de VENTA: kilos × valor por kilo vigente cada día. */
  sale: Cents;
  /** Informe de COSTE: kilos × coste por kilo. */
  cost: Cents;
  /** Valor y coste por kilo al final del periodo, para leer la fórmula. */
  saleValue: number | null;
  costPerKg: number | null;
  costSource: CostSource | null;
};
export type ValueReport = {
  from: string;
  to: string;
  rows: ValueRow[];
  kg: Kg;
  sale: Cents;
  cost: Cents;
  /** Gelatos con kilos en el periodo a los que les falta el valor de venta o el coste. */
  missingValue: string[];
  missingCost: string[];
};
const field = { sale: "sold", waste: "waste", gift: "gift" } as const;
const keys = ["produced", "sold", "waste", "gift"] as const;

/** Producción, venta, merma e invitación entre dos días de negocio: en kilos, en venta y en coste. */
export function valueReport(s: State, from: string, to: string): ValueReport {
  type Acc = { kg: Kg; sale: Cents; cost: Cents };
  const rows = new Map<string, Acc>();
  const row = (id: string): Acc => {
    let r = rows.get(id);
    if (!r) {
      r = {
        kg: { produced: 0, sold: 0, waste: 0, gift: 0 },
        sale: { produced: 0, sold: 0, waste: 0, gift: 0 },
        cost: { produced: 0, sold: 0, waste: 0, gift: 0 },
      };
      rows.set(id, r);
    }
    return r;
  };
  // A missing value poisons the sum: a partial total would look like a real one.
  const add = (
    t: Cents,
    k: keyof Cents,
    quantity: number,
    perKg: number | null,
  ): void => {
    const now = t[k];
    t[k] = now === null || perKg === null ? null : now + euros(quantity, perKg);
  };
  const entry = (
    product: string,
    k: keyof Kg,
    quantity: number,
    date: string,
    ownCost?: number,
  ): void => {
    const r = row(product);
    r.kg[k] += quantity;
    add(r.sale, k, quantity, saleValueOn(s, product, date));
    if (ownCost !== undefined)
      r.cost[k] = r.cost[k] === null ? null : r.cost[k] + ownCost;
    else add(r.cost, k, quantity, costPerKgOn(s, product, date)?.cents ?? null);
  };
  for (const p of liveProductions(s)) {
    if (!p.output?.quantity || p.date < from || p.date > to) continue;
    if (p.cost)
      entry(
        p.output.product,
        "produced",
        p.output.quantity,
        p.date,
        p.cost.cents,
      );
    else {
      // Approved before costs existed: today's recipe cost, or not available.
      entry(p.output.product, "produced", p.output.quantity, p.date);
    }
  }
  const undone = undoneMovements(s);
  for (const m of s.movements) {
    if (undone.has(m.id) || m.reverses) continue;
    const line = closeLineOf(m);
    if (!line || line.date < from || line.date > to) continue;
    const kind: CloseKind = line.kind;
    entry(m.product, field[kind], Math.abs(m.delta), line.date);
  }
  const list: ValueRow[] = [...rows.entries()]
    .map(([product, r]) => {
      const c = costPerKgOn(s, product, to);
      return {
        product,
        name:
          s.products.find((x) => x.id === product)?.name ??
          "Producto eliminado",
        kg: {
          produced: kg(r.kg.produced),
          sold: kg(r.kg.sold),
          waste: kg(r.kg.waste),
          gift: kg(r.kg.gift),
        },
        sale: r.sale,
        cost: r.cost,
        saleValue: saleValueOn(s, product, to),
        costPerKg: c?.cents ?? null,
        costSource: c?.source ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const total = (pick: (r: ValueRow) => Cents): Cents => {
    const t: Cents = { produced: 0, sold: 0, waste: 0, gift: 0 };
    for (const r of list)
      for (const k of keys) {
        const now = t[k];
        const v = pick(r)[k];
        t[k] = now === null || v === null ? null : now + v;
      }
    return t;
  };
  const lacks = (pick: (r: ValueRow) => Cents): string[] =>
    list
      .filter((r) => keys.some((k) => pick(r)[k] === null))
      .map((r) => r.name);
  return {
    from,
    to,
    rows: list,
    kg: {
      produced: kg(list.reduce((n, r) => n + r.kg.produced, 0)),
      sold: kg(list.reduce((n, r) => n + r.kg.sold, 0)),
      waste: kg(list.reduce((n, r) => n + r.kg.waste, 0)),
      gift: kg(list.reduce((n, r) => n + r.kg.gift, 0)),
    },
    sale: total((r) => r.sale),
    cost: total((r) => r.cost),
    missingValue: lacks((r) => r.sale),
    missingCost: lacks((r) => r.cost),
  };
}
