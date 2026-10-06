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
  /** Producto del inventario al que corresponde este nombre, si la persona lo dijo (nameProducts). */
  product: string | null;
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
      product:
        s.nameProducts.find((n) => n.kind === "list" && keys.has(n.key))
          ?.product ?? null,
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

/** Palabras que no distinguen un ingrediente de otro. */
const STOP = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "en",
  "y",
  "e",
  "o",
  "con",
  "sin",
  "x",
  "por",
  "para",
  "al",
  "a",
  // Unidades escritas en el nombre: son formato, no ingrediente.
  "kg",
  "kgs",
  "g",
  "gr",
  "l",
  "lt",
  "lts",
  "ml",
  "ud",
  "und",
  "uds",
]);
const uniq = (list: string[]) => [...new Set(list)];
export type NameParts = { words: string[]; numbers: string[]; codes: string[] };
/**
 * Trocea un nombre para compararlo: palabras (en singular), números sueltos («26», «38») y
 * códigos de formato con cifras («t08», «pet50», «7k»). Solo sirve para proponer: nunca junta.
 */
export function nameParts(name: string): NameParts {
  const words: string[] = [],
    numbers: string[] = [],
    codes: string[] = [];
  for (const t of priceKey(name).split(" ")) {
    if (!t || STOP.has(t)) continue;
    if (/^\d+$/.test(t)) numbers.push(t);
    else if (/\d/.test(t)) codes.push(t);
    else words.push(t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);
  }
  return { words: uniq(words), numbers: uniq(numbers), codes: uniq(codes) };
}
const subset = (a: string[], b: string[]) => a.every((x) => b.includes(x));
const eitherWay = (a: string[], b: string[]) => subset(a, b) || subset(b, a);
/** La palabra tal como la escribe el nombre («PASCUAL»), a partir de su forma troceada. */
const original = (name: string, word: string): string =>
  name.split(/[^\p{L}\p{N}]+/u).find((t) => nameParts(t).words[0] === word) ??
  word;
/**
 * Por qué dos nombres distintos de la lista podrían ser el mismo ingrediente, en palabras; null
 * si no hay motivo. Regla estrecha a propósito: las palabras de uno están todas en el otro, con
 * una palabra de más como mucho, y los números y códigos de uno están en el otro (así «CHOCOLATE
 * NEGRO 55%» y «CHOCOLATE NEGRO 73%» no se proponen, ni «COPETAS T08» y «COPETAS T12»). La persona
 * decide: la lista no dice que sean lo mismo.
 */
export function likelySame(a: string, b: string): string | null {
  if (priceKey(a) === priceKey(b)) return null;
  const pa = nameParts(a),
    pb = nameParts(b);
  if (!pa.words.length || !pb.words.length) return null;
  const [small, big, bigName] =
    pa.words.length <= pb.words.length ? [pa, pb, b] : [pb, pa, a];
  if (!subset(small.words, big.words)) return null;
  const extra = big.words.filter((w) => !small.words.includes(w));
  if (extra.length > 1) return null;
  if (!eitherWay(pa.numbers, pb.numbers) || !eitherWay(pa.codes, pb.codes))
    return null;
  const why: string[] = [];
  if (extra[0]) why.push(`«${original(bigName, extra[0])}» de más en uno`);
  const only = (x: string[], y: string[]) => x.filter((n) => !y.includes(n));
  const nums = [
    ...only(pa.numbers, pb.numbers),
    ...only(pb.numbers, pa.numbers),
    ...only(pa.codes, pb.codes),
    ...only(pb.codes, pa.codes),
  ];
  if (nums.length)
    why.push(`${nums.map((n) => `«${n}»`).join(" y ")} solo en uno de los dos`);
  return why.length
    ? `Las mismas palabras, con ${why.join(" y ")}.`
    : "Las mismas palabras, en otro orden o con otros signos.";
}
export type PriceSuggestion = {
  a: { key: string; name: string; row: string };
  b: { key: string; name: string; row: string };
  reason: string;
};
const pairKey = (x: string, y: string) => [x, y].sort().join("|");
/**
 * «Posibles iguales»: parejas de ingredientes de la lista que, por su nombre, podrían ser el
 * mismo, para que la persona los junte o diga que no. Nunca se juntan solos. No se proponen los
 * que ya cuentan como uno, los que ella dijo que son distintos (priceNotSame) ni lo hecho en casa.
 */
export function priceSuggestions(
  s: State,
  comparison: PriceComparison = priceGroups(s),
): PriceSuggestion[] {
  const rejected = new Set(s.priceNotSame.map(([x, y]) => pairKey(x!, y!)));
  const sides = comparison.groups.map((g) => {
    const names = new Map<string, string>();
    for (const r of g.rows) if (!names.has(r.name)) names.set(r.name, r.id);
    return { key: g.key, names: [...names] };
  });
  const out: PriceSuggestion[] = [];
  for (let i = 0; i < sides.length; i++)
    for (let j = i + 1; j < sides.length; j++) {
      const A = sides[i]!,
        B = sides[j]!;
      let found: PriceSuggestion | null = null,
        no = false;
      for (const [na, ra] of A.names) {
        for (const [nb, rb] of B.names) {
          if (rejected.has(pairKey(priceKey(na), priceKey(nb)))) {
            no = true;
            break;
          }
          const reason: string | null = found ? null : likelySame(na, nb);
          if (reason)
            found = {
              a: { key: A.key, name: na, row: ra },
              b: { key: B.key, name: nb, row: rb },
              reason,
            };
        }
        if (no) break;
      }
      if (found && !no) out.push(found);
    }
  return out.sort(
    (x, y) =>
      x.a.name.localeCompare(y.a.name, "es") ||
      x.b.name.localeCompare(y.b.name, "es"),
  );
}

/**
 * El producto del inventario al que corresponde un nombre de la lista («list») o de la tabla
 * («table»), si la persona lo dijo alguna vez. En la lista valen también los nombres juntados.
 */
export function productOfName(
  s: State,
  kind: "list" | "table",
  name: string,
): string | null {
  const key = priceKey(name);
  const own = s.nameProducts.find((n) => n.kind === kind && n.key === key);
  if (own) return own.product;
  if (kind !== "list") return null;
  const keys = linkedKeys(s, key);
  return (
    s.nameProducts.find((n) => n.kind === "list" && keys.includes(n.key))
      ?.product ?? null
  );
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

/** Una forma de comprar un producto: el proveedor habitual o uno de los apuntados. */
export type BuyOption = { supplier: string; pack: number; price: number };
export type CartAdvice = {
  product: string;
  /** Lo elegido en el carrito y lo que cuesta la línea (null: sin precio). */
  chosen: BuyOption & { packs: number; cents: number | null };
  /**
   * Otro proveedor ya apuntado en el producto con el que la misma cantidad sale más barata.
   * packs = paquetes de ese proveedor que cubren lo pedido; saving = lo que baja la línea.
   */
  cheaper:
    (BuyOption & { packs: number; cents: number; saving: number }) | null;
  /**
   * Lo más barato de la lista de precios para un ingrediente que se llama igual que el producto
   * (o que la persona juntó con ese nombre). Es un dato de la lista, por su unidad: no se compara
   * con el paquete hasta que la persona lo apunta en el producto.
   */
  list: {
    row: string;
    supplier: string;
    cents: number;
    suppliers: number;
    noted: boolean;
  } | null;
};
const buyOptions = (p: State["products"][number]): BuyOption[] => [
  { supplier: p.supplier, pack: p.pack, price: p.price },
  ...p.alternates.map((x) => ({
    supplier: x.supplier,
    pack: x.pack,
    price: x.price,
  })),
];
/**
 * Para cada línea del carrito: lo que cuesta y si, con lo apuntado en el producto, la misma
 * cantidad sale más barata con otro proveedor. Solo compara precios que la persona ya confirmó
 * (proveedor habitual y otros proveedores). No cambia nada: informa.
 */
export function cartAdvice(s: State): CartAdvice[] {
  const comparison = s.priceList.length ? priceGroups(s) : null;
  const out: CartAdvice[] = [];
  for (const l of s.cart) {
    const p = s.products.find((x) => x.id === l.product);
    if (!p) continue;
    const options = buyOptions(p);
    const chosen =
      options.find((o) => o.supplier === (l.supplier ?? p.supplier)) ??
      options[0]!;
    const units = l.packs * chosen.pack;
    const cents = chosen.price > 0 ? l.packs * chosen.price : null;
    let cheaper: CartAdvice["cheaper"] = null;
    if (cents !== null)
      for (const o of options) {
        if (o.supplier === chosen.supplier || !(o.price > 0) || !(o.pack > 0))
          continue;
        const packs = Math.ceil(units / o.pack - 1e-9);
        const total = packs * o.price;
        if (total < cents && (!cheaper || total < cheaper.cents))
          cheaper = { ...o, packs, cents: total, saving: cents - total };
      }
    let list: CartAdvice["list"] = null;
    if (comparison) {
      // Primero el nombre de la lista que la persona dijo que es este producto; si no, el
      // nombre igual al del producto (o juntado con él).
      const remembered = s.nameProducts
        .filter((n) => n.kind === "list" && n.product === p.id)
        .flatMap((n) => linkedKeys(s, n.key));
      const byKeys = (keys: string[]) =>
        comparison.groups.find(
          (x) =>
            keys.includes(x.key) ||
            x.rows.some((r) => keys.includes(priceKey(r.name))),
        );
      const g =
        (remembered.length ? byKeys(remembered) : undefined) ??
        byKeys(linkedKeys(s, priceKey(p.name)));
      // Con un solo proveedor no hay «más barato», pero el precio de la lista se enseña igual.
      const best = g?.cheapest ?? g?.rows.find((r) => r.compared);
      if (g && best && best.supplier && best.cents !== null) {
        const sup = s.suppliers.find(
          (x) => priceKey(x.name) === priceKey(best.supplier ?? ""),
        );
        list = {
          row: best.id,
          supplier: best.supplier,
          cents: best.cents,
          suppliers: g.suppliers,
          // Ya apuntado: ese proveedor es una de las formas de comprar el producto.
          noted: !!sup && options.some((o) => o.supplier === sup.id),
        };
      }
    }
    out.push({
      product: p.id,
      chosen: { ...chosen, packs: l.packs, cents },
      cheaper,
      list,
    });
  }
  return out;
}
