// Lista de precios por proveedor leída de un PDF de la persona (una fila por ingrediente y
// proveedor: nombre, a quién se compra y lo que cuesta por litro, kilo o unidad). Solo reglas
// sobre la posición de cada texto: cada dato va a la columna en la que está escrito, así que un
// importe nunca se toma por un proveedor. Lo que la lista no trae queda sin valor (nunca 0) y lo
// que no se entiende se enseña aparte. La comparación solo ordena lo que la lista dice: no sabe
// nada de marcas, formatos ni calidades.
import { fold } from "./util";
import type { PdfItem } from "./comptable";
import type { State } from "./schema";

export type PriceRow = {
  name: string;
  /** A quién se compra, tal cual lo escribe la lista. null: la lista no lo dice. */
  supplier: string | null;
  /** Céntimos por litro, kilo o unidad. null: la lista no trae precio. */
  cents: number | null;
  page: number;
  /** Número de fila dentro de su página, contando desde la primera bajo la cabecera. */
  line: number;
  issues: string[];
};
export type PriceReading = {
  rows: PriceRow[];
  /** Lo que se vio y no se importa, con su motivo. */
  skipped: { page: number; text: string; reason: string }[];
  reason: string;
};

/** Nombre para comparar: sin tildes, en minúsculas y sin signos («22-24 %» = «22-24%»). */
export const priceKey = (name: string): string =>
  fold(name)
    .replace(/[^a-z0-9]+/g, " ")
    .trim() || fold(name).trim();

/** Elaboraciones de la casa: tienen coste, pero no son un proveedor al que comprar. */
export const isHouse = (supplier: string | null | undefined): boolean =>
  /^(produccion|elaboracion) propia$/.test(priceKey(supplier ?? ""));

const moneyLike = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:€|eur)?$/i;
/** «3.874,00 €» → 387400. null si no es un importe. */
export function readCents(text: string): number | null {
  const m = moneyLike.exec(text.replace(/\s+/g, " ").trim());
  if (!m || !m[1]) return null;
  const whole = Number(m[1].replace(/\./g, ""));
  const cents = Number((m[2] ?? "").padEnd(2, "0"));
  const value = whole * 100 + cents;
  return Number.isSafeInteger(value) && value <= 100_000_000 ? value : null;
}

/** Agrupa los textos de una página en filas (misma altura, con un margen pequeño). */
function rowsOf(items: PdfItem[]): { y: number; cells: PdfItem[] }[] {
  const rows: { y: number; cells: PdfItem[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const s = it.s.trim();
    if (!s) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 2);
    if (row) row.cells.push({ ...it, s });
    else rows.push({ y: it.y, cells: [{ ...it, s }] });
  }
  for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
  return rows;
}
const joined = (cells: PdfItem[]) =>
  cells
    .map((c) => c.s)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/** Lee la lista de todas las páginas. Si no encuentra la cabecera, no propone nada y lo dice. */
export function parsePriceList(pages: PdfItem[][]): PriceReading {
  const out: PriceReading = { rows: [], skipped: [], reason: "" };
  const seen = new Set<string>();
  let found = false;
  pages.forEach((items, index) => {
    const page = index + 1;
    const rows = rowsOf(items);
    let supplierX = 0,
      costX = 0;
    const head = rows.findIndex((r) => {
      const name = r.cells.find((c) => /^ingredientes?$/.test(fold(c.s)));
      const sup = r.cells.find((c) => /^proveedor(es)?$/.test(fold(c.s)));
      const cost = r.cells.find((c) =>
        /^(costo|coste|costes|precio|precios)\b/.test(fold(c.s)),
      );
      if (!name || !sup || !cost || !(name.x < sup.x && sup.x < cost.x))
        return false;
      supplierX = sup.x;
      costX = cost.x;
      return true;
    });
    if (head < 0) {
      if (rows.length)
        out.skipped.push({
          page,
          text: `Página ${page}`,
          reason:
            "No tiene la cabecera de la lista (ingrediente, proveedor y coste): no se lee.",
        });
      return;
    }
    found = true;
    // Un texto es del proveedor desde un poco antes de su cabecera (los nombres van centrados
    // bajo ella) y es un importe desde la cabecera del coste.
    const supplierFrom = supplierX - Math.min(30, (costX - supplierX) / 3);
    const costFrom = costX - 10;
    let line = 0;
    for (const r of rows.slice(head + 1)) {
      line++;
      const name = joined(r.cells.filter((c) => c.x < supplierFrom));
      const supplier = joined(
        r.cells.filter((c) => c.x >= supplierFrom && c.x < costFrom),
      );
      const cost = joined(r.cells.filter((c) => c.x >= costFrom));
      const text = [name, supplier, cost].filter(Boolean).join(" | ");
      const skip = (reason: string) => out.skipped.push({ page, text, reason });
      if (!name) {
        skip("Fila sin nombre de ingrediente.");
        continue;
      }
      if (
        !supplier &&
        !cost &&
        /^(pag(ina)?\.?\s*)?\d+(\s*(de|\/)\s*\d+)?$/.test(fold(name))
      ) {
        skip("Número de página: no es un ingrediente.");
        continue;
      }
      if (name.length > 100 || supplier.length > 100) {
        skip("Texto demasiado largo para ser un nombre.");
        continue;
      }
      if (readCents(name) !== null) {
        skip("Un importe donde va el nombre del ingrediente.");
        continue;
      }
      if (supplier && readCents(supplier) !== null && /[,€]/.test(supplier)) {
        skip("Un importe fuera de la columna del coste.");
        continue;
      }
      const cents = cost ? readCents(cost) : null;
      if (cost && cents === null) {
        skip("El coste de la fila no se entiende.");
        continue;
      }
      const key = priceKey(name) + "|" + priceKey(supplier);
      if (seen.has(key)) {
        skip("Repetida con el mismo proveedor: se conserva la primera.");
        continue;
      }
      seen.add(key);
      out.rows.push({
        name,
        supplier: supplier || null,
        cents,
        page,
        line,
        issues:
          cents === 0 ? ["La lista pone 0,00 €: comprueba ese precio."] : [],
      });
    }
  });
  if (!found)
    out.reason =
      "No se ha encontrado una lista de precios: hace falta una cabecera con «INGREDIENTE», «PROVEEDOR» y una columna de coste o precio.";
  else if (!out.rows.length)
    out.reason = "La lista se reconoce, pero no trae ninguna fila que leer.";
  return out;
}

/** Recuento para la vista previa: solo cuenta lo leído. */
export function priceReadingSummary(reading: PriceReading) {
  const suppliers = new Set(
    reading.rows
      .filter((r) => r.supplier && !isHouse(r.supplier))
      .map((r) => priceKey(r.supplier ?? "")),
  );
  return {
    rows: reading.rows.length,
    suppliers: suppliers.size,
    house: reading.rows.filter((r) => isHouse(r.supplier)).length,
    noPrice: reading.rows.filter((r) => r.cents === null).length,
    noSupplier: reading.rows.filter((r) => !r.supplier).length,
    doubtful: reading.rows.filter((r) => r.issues.length).length,
    skipped: reading.skipped.length,
  };
}

type Stored = State["priceList"][number];
export type PriceGroupRow = {
  id: string;
  name: string;
  supplier: string | null;
  cents: number | null;
  source: string;
  page: number;
  line: number;
  issues: string[];
  /** Entra en la comparación: tiene proveedor y un precio mayor que 0. */
  compared: boolean;
  cheapest: boolean;
};
export type PriceGroup = {
  key: string;
  name: string;
  /** Nombres distintos que la persona juntó a mano (vacío si el grupo es de un solo nombre). */
  joined: string[];
  star: boolean;
  rows: PriceGroupRow[];
  /** Proveedores distintos con precio. */
  suppliers: number;
  cheapest: PriceGroupRow | null;
  /** El siguiente más barato de otro proveedor, y cuánto más cuesta (sobre el más barato). */
  next: { supplier: string; cents: number; pct: number } | null;
  /** Diferencia entre el más caro y el más barato: en céntimos y en % sobre el más caro. */
  saving: { cents: number; pct: number; dearest: number } | null;
};
export type PriceComparison = {
  groups: PriceGroup[];
  /** Elaboraciones de la casa, con su coste: no compiten con ningún proveedor. */
  house: PriceGroupRow[];
  totals: {
    rows: number;
    suppliers: number;
    groups: number;
    comparable: number;
    stars: number;
    sources: string[];
  };
};
const pct1 = (n: number) => Math.round(n * 10) / 10;

/** Las claves de nombre que la persona juntó con esta (incluida ella). */
export function linkedKeys(s: State, key: string): string[] {
  return s.priceLinks.find((set) => set.includes(key)) ?? [key];
}

/**
 * Compara la lista guardada. Dos filas son el mismo ingrediente solo si su nombre es igual sin
 * tildes, mayúsculas ni signos, o si la persona las juntó a mano. Orden: primero los que ella
 * marcó con estrella, luego donde más diferencia hay entre proveedores y luego por nombre.
 */
export function priceGroups(s: State): PriceComparison {
  const view = (r: Stored): PriceGroupRow => ({
    id: r.id,
    name: r.name,
    supplier: r.supplier ?? null,
    cents: r.cents ?? null,
    source: r.source,
    page: r.page,
    line: r.line,
    issues: r.issues,
    compared: false,
    cheapest: false,
  });
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "es");
  const house = s.priceList
    .filter((r) => isHouse(r.supplier))
    .map(view)
    .sort(byName);
  const groupOf = new Map<string, string>();
  for (const set of s.priceLinks)
    for (const k of set) groupOf.set(k, set[0] ?? k);
  const map = new Map<string, Stored[]>();
  for (const r of s.priceList) {
    if (isHouse(r.supplier)) continue;
    const own = priceKey(r.name);
    const key = groupOf.get(own) ?? own;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const stars = new Set(s.priceStars);
  const groups: PriceGroup[] = [];
  for (const [key, list] of map) {
    const rows = list.map(view);
    for (const r of rows)
      r.compared = !!r.supplier && r.cents !== null && r.cents > 0;
    // De más barata a más cara; después las de precio 0 o sin proveedor, y al final las sin precio.
    const rank = (r: PriceGroupRow) =>
      r.compared
        ? 0
        : r.cents !== null && r.cents > 0
          ? 1
          : r.cents === 0
            ? 2
            : 3;
    rows.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.cents ?? 0) - (b.cents ?? 0) ||
        (a.supplier ?? "").localeCompare(b.supplier ?? "", "es") ||
        byName(a, b),
    );
    const compared = rows.filter((r) => r.compared);
    const suppliers = new Set(compared.map((r) => priceKey(r.supplier ?? "")));
    const cheapest = suppliers.size > 1 ? (compared[0] ?? null) : null;
    let next: PriceGroup["next"] = null;
    let saving: PriceGroup["saving"] = null;
    if (cheapest && cheapest.cents) {
      cheapest.cheapest = true;
      const other = compared.find(
        (r) => priceKey(r.supplier ?? "") !== priceKey(cheapest.supplier ?? ""),
      );
      if (other && other.cents && other.supplier)
        next = {
          supplier: other.supplier,
          cents: other.cents,
          pct: pct1(((other.cents - cheapest.cents) / cheapest.cents) * 100),
        };
      const dearest = compared[compared.length - 1]?.cents ?? cheapest.cents;
      saving = {
        cents: dearest - cheapest.cents,
        pct: pct1(((dearest - cheapest.cents) / dearest) * 100),
        dearest,
      };
    }
    const names = [...new Set(list.map((r) => r.name))];
    const keys = new Set(list.map((r) => priceKey(r.name)));
    groups.push({
      key,
      name:
        names.sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ??
        "",
      joined: keys.size > 1 ? names : [],
      star: [...keys].some((k) => stars.has(k)),
      rows,
      suppliers: suppliers.size,
      cheapest,
      next,
      saving,
    });
  }
  groups.sort(
    (a, b) =>
      Number(b.star) - Number(a.star) ||
      (b.saving?.cents ?? -1) - (a.saving?.cents ?? -1) ||
      byName(a, b),
  );
  return {
    groups,
    house,
    totals: {
      rows: s.priceList.length,
      suppliers: new Set(
        s.priceList
          .filter((r) => r.supplier && !isHouse(r.supplier))
          .map((r) => priceKey(r.supplier ?? "")),
      ).size,
      groups: groups.length,
      comparable: groups.filter((g) => g.cheapest).length,
      stars: groups.filter((g) => g.star).length,
      sources: [...new Set(s.priceList.map((r) => r.source))],
    },
  };
}

/** De dónde sale un precio tomado de la lista: archivo, página y fila. */
export const priceRowSource = (r: {
  source: string;
  page: number;
  line: number;
  name: string;
}): string =>
  `${r.source} · página ${r.page} · fila ${r.line} · «${r.name}»`.slice(0, 300);

/** Iniciales de un proveedor nuevo, sacadas de su nombre (dos letras como mucho). */
export const supplierInitials = (name: string): string =>
  (
    name
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => (w[0] ?? "").toUpperCase())
      .join("") || "P"
  ).slice(0, 5);
