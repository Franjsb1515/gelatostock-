// Inventory helpers: price history alerts and guided counts by zone. Pure functions.
import type { State } from "./schema";

export const zoneLabels: Record<string, string> = {
  vitrina: "Vitrina",
  camara: "Cámara",
  congelador: "Congelador",
  almacen: "Almacén",
  obrador: "Obrador",
  barra: "Barra",
  otra: "Otra zona",
};
export type PriceAlert = {
  id: string;
  product: string;
  name: string;
  supplier: string;
  supplierName: string;
  at: string;
  from: number;
  to: number;
  pct: number;
};
// Price rises recorded in the last `days` days, newest first, one per product (the latest).
export function priceAlerts(s: State, days = 30): PriceAlert[] {
  const since = Date.now() - days * 86400000;
  const seen = new Set<string>();
  const out: PriceAlert[] = [];
  for (const e of [...s.prices].reverse()) {
    if (Date.parse(e.at) < since || seen.has(e.product)) continue;
    seen.add(e.product);
    if (e.to <= e.from || e.from === 0) continue;
    const p = s.products.find((x) => x.id === e.product);
    const sup = s.suppliers.find((x) => x.id === e.supplier);
    out.push({
      id: e.id,
      product: e.product,
      name: p?.name ?? "",
      supplier: e.supplier,
      supplierName: sup?.name ?? "",
      at: e.at,
      from: e.from,
      to: e.to,
      pct: Math.round(((e.to - e.from) / e.from) * 1000) / 10,
    });
  }
  return out;
}
export type ZoneStatus = {
  zone: string;
  label: string;
  products: number;
  lastCount: string | null;
  ageDays: number | null;
  due: boolean;
};
// Per zone: when it was last fully counted (the oldest "last count" among its products) and
// whether that is older than `days`. Products never counted make the zone due.
export function countStatus(s: State, days: number): ZoneStatus[] {
  const lastByProduct = new Map<string, string>();
  for (const m of s.movements)
    if (m.kind === "count" && !lastByProduct.has(m.product))
      lastByProduct.set(m.product, m.at);
  const zones = new Map<
    string,
    { products: number; oldest: string | null; never: boolean }
  >();
  for (const p of s.products) {
    const zone = p.zone ?? "almacen";
    const z = zones.get(zone) ?? { products: 0, oldest: null, never: false };
    z.products++;
    const last = lastByProduct.get(p.id);
    if (!last) z.never = true;
    else if (!z.oldest || last < z.oldest) z.oldest = last;
    zones.set(zone, z);
  }
  return Object.keys(zoneLabels)
    .filter((zone) => zones.has(zone))
    .map((zone) => {
      const z = zones.get(zone)!;
      const ageDays =
        z.never || !z.oldest
          ? null
          : Math.floor((Date.now() - Date.parse(z.oldest)) / 86400000);
      return {
        zone,
        label: zoneLabels[zone] ?? zone,
        products: z.products,
        lastCount: z.never ? null : z.oldest,
        ageDays,
        due: days > 0 && (z.never || (ageDays ?? 0) >= days),
      };
    });
}
