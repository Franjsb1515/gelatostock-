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
export const priceSourceLabels: Record<string, string> = {
  edit: "escrito a mano",
  document: "de un documento",
  message: "de un mensaje",
};
export type CatalogLine = {
  product: string;
  name: string;
  unit: string;
  pack: number;
  price: number;
  // The usual supplier of the product, or one of the others where he also buys it.
  usual: boolean;
  // When that price was written down. Null when nothing records it: then it is "No disponible",
  // never guessed from the day the product was created.
  since: string | null;
  source: "edit" | "document" | "message" | null;
  ref: string | null;
  refLabel: string | null;
};
// What he buys from one supplier, at what price and since when, with where each price comes
// from. Only what is written down: no average, no estimate, no price taken from another supplier.
export function supplierCatalog(s: State, supplier: string): CatalogLine[] {
  const origin = (product: string, price: number) => {
    const last = [...s.prices]
      .reverse()
      .find((e) => e.product === product && e.supplier === supplier);
    if (!last || last.to !== price)
      return { since: null, source: null, ref: null, refLabel: null };
    const ref = last.ref ?? null;
    let refLabel: string | null = null;
    if (ref && last.source === "document")
      refLabel = s.photos.find((p) => p.id === ref)?.name ?? null;
    if (ref && last.source === "message") {
      const m = s.messages.find((x) => x.id === ref);
      refLabel = m ? `mensaje del ${m.at.slice(0, 10)}` : null;
    }
    return { since: last.at, source: last.source, ref, refLabel };
  };
  const out: CatalogLine[] = [];
  for (const p of s.products) {
    if (p.supplier === supplier)
      out.push({
        product: p.id,
        name: p.name,
        unit: p.unit,
        pack: p.pack,
        price: p.price,
        usual: true,
        ...origin(p.id, p.price),
      });
    const alt = p.alternates.find((x) => x.supplier === supplier);
    if (alt)
      out.push({
        product: p.id,
        name: p.name,
        unit: p.unit,
        pack: alt.pack,
        price: alt.price,
        usual: false,
        since: null,
        source: "edit",
        ref: null,
        refLabel: null,
      });
  }
  return out.sort(
    (a, b) =>
      Number(b.usual) - Number(a.usual) || a.name.localeCompare(b.name, "es"),
  );
}
export function supplierCatalogs(s: State): Record<string, CatalogLine[]> {
  const out: Record<string, CatalogLine[]> = {};
  for (const sup of s.suppliers) out[sup.id] = supplierCatalog(s, sup.id);
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
