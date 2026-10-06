// Tabla de composición de ingredientes leída de un PDF de la persona (una fila por ingrediente,
// valores por 100 g). Solo reglas sobre la posición de cada texto: un número pertenece a la
// columna cuya cabecera tiene más cerca. Lo que la tabla no trae queda sin valor (nunca 0), lo
// que no cuadra se marca y se enseña, y nada se corrige ni se completa.
import { fold } from "./util";

export const compositionKeys = [
  "sugars",
  "fat",
  "msnf",
  "otherSolids",
  "solids",
  "water",
  "lactose",
  "milkProtein",
  "minerals",
  "protein",
  "fiber",
  "pacSugars",
  "pac",
  "pod",
] as const;
export type CompositionKey = (typeof compositionKeys)[number];
export const compositionLabels: Record<CompositionKey, string> = {
  sugars: "Azúcar",
  fat: "Grasas",
  msnf: "Sólidos lácteos no grasos",
  otherSolids: "Otros sólidos",
  solids: "Sólidos totales",
  water: "Agua",
  lactose: "Lactosa",
  milkProtein: "Proteína de leche",
  minerals: "Sales minerales",
  protein: "Proteínas totales",
  fiber: "Fibras",
  pacSugars: "PAC de los azúcares",
  pac: "PAC total",
  pod: "POD",
};
/** Las tres últimas columnas son índices (pueden pasar de 100); el resto, tanto por ciento. */
export const compositionIndex: CompositionKey[] = ["pacSugars", "pac", "pod"];

export type PdfItem = { x: number; y: number; s: string };
export type TableRow = {
  name: string;
  page: number;
  composition: Partial<Record<CompositionKey, number>>;
  issues: string[];
};
export type TableReading = {
  rows: TableRow[];
  /** Lo que se vio y no se importa, con su motivo. */
  skipped: { page: number; text: string; reason: string }[];
  columns: CompositionKey[];
  reason: string;
};

type Column = CompositionKey | "quantity";
// Cabeceras de una sola línea y, para las de dos líneas, la palabra de abajo (la que distingue).
const mainLabels: [RegExp, Column][] = [
  [/^cantidad$/, "quantity"],
  [/^azucar(es)?$/, "sugars"],
  [/^grasas?$/, "fat"],
  [/^s\.?m\.?l\.?$/, "msnf"],
  [/^agua$/, "water"],
  [/^lactosa$/, "lactose"],
  [/^fibras?$/, "fiber"],
  [/^pac total$/, "pac"],
  [/^pod$/, "pod"],
];
const lowerLabels: [RegExp, Column][] = [
  [/^solidos$/, "otherSolids"],
  [/^totales$/, "solids"],
  [/^\(leche\)$/, "milkProtein"],
  [/^minerales$/, "minerals"],
  [/^\(totales\)$/, "protein"],
  [/^azucares$/, "pacSugars"],
];
const numberLike = /^\d{1,4}([.,]\d{1,2})?$/;
const toNumber = (s: string) => Number(s.replace(",", "."));
const near = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) <= tolerance;

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

/** Lee la tabla de todas las páginas. Si no encuentra la cabecera, no propone nada y lo dice. */
export function parseCompositionTable(pages: PdfItem[][]): TableReading {
  const out: TableReading = { rows: [], skipped: [], columns: [], reason: "" };
  const seen = new Set<string>();
  let found = false;
  pages.forEach((items, index) => {
    const page = index + 1;
    const rows = rowsOf(items);
    const head = rows.findIndex((r) =>
      r.cells.some((c) => fold(c.s) === "ingredientes"),
    );
    const headRow = rows[head];
    if (!headRow) {
      if (rows.length)
        out.skipped.push({
          page,
          text: "Toda la página",
          reason: "No tiene la cabecera de la tabla: no se lee.",
        });
      return;
    }
    // La cabecera ocupa hasta tres líneas: la de «INGREDIENTES», la de encima y la de debajo.
    const columns: { key: Column; x: number }[] = [];
    for (const c of headRow.cells) {
      const hit = mainLabels.find(([re]) => re.test(fold(c.s)));
      if (hit) columns.push({ key: hit[1], x: c.x });
    }
    const below = rows[head + 1];
    if (below && headRow.y - below.y < 30)
      for (const c of below.cells) {
        const hit = lowerLabels.find(([re]) => re.test(fold(c.s)));
        if (hit) columns.push({ key: hit[1], x: c.x });
      }
    columns.sort((a, b) => a.x - b.x);
    const quantity = columns.find((c) => c.key === "quantity");
    if (!quantity || columns.length < 4) return;
    found = true;
    for (const c of columns)
      if (c.key !== "quantity" && !out.columns.includes(c.key))
        out.columns.push(c.key);
    const gaps = columns.slice(1).map((c, i) => c.x - (columns[i]?.x ?? 0));
    const tolerance = Math.min(...gaps) / 2;
    const first = head + (below && headRow.y - below.y < 30 ? 2 : 1);
    let pending: TableRow | null = null;
    const push = (row: TableRow) => {
      if (!row.name) {
        out.skipped.push({
          page,
          text: Object.values(row.composition).join(" "),
          reason: "Fila de números sin nombre de ingrediente.",
        });
        return;
      }
      const key = fold(row.name);
      if (seen.has(key)) {
        out.skipped.push({
          page,
          text: row.name,
          reason: "Nombre repetido en la tabla: se conserva el primero.",
        });
        return;
      }
      seen.add(key);
      out.rows.push(row);
    };
    for (const r of rows.slice(first)) {
      const names = r.cells.filter(
        (c) => c.x < quantity.x - tolerance && !numberLike.test(c.s),
      );
      const rest = r.cells.filter((c) => !names.includes(c));
      const name = names
        .map((c) => c.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      // Al final de la tabla vienen los rangos de referencia («% GELATO 18 - 22»): no son
      // ingredientes y aquí acaba la lectura de la página.
      if (name.startsWith("%") || rest.some((c) => /\d\s*-\s*\d/.test(c.s))) {
        if (pending) push(pending);
        pending = null;
        out.skipped.push({
          page,
          text: "Rangos de referencia del final de la tabla",
          reason: "No son ingredientes: no se importan.",
        });
        break;
      }
      if (!rest.length) {
        // Solo un nombre: es el de la fila de números que tiene justo encima.
        if (pending && !pending.name) {
          pending.name = name;
          push(pending);
          pending = null;
        } else if (name)
          out.skipped.push({
            page,
            text: name,
            reason: "Nombre sin números a su altura.",
          });
        continue;
      }
      if (pending) push(pending);
      pending = null;
      const row: TableRow = { name, page, composition: {}, issues: [] };
      let amount: number | undefined;
      let unreadable = "";
      for (const c of rest) {
        const col = columns.reduce((best, k) =>
          Math.abs(k.x - c.x) < Math.abs(best.x - c.x) ? k : best,
        );
        if (!numberLike.test(c.s) || !near(col.x, c.x, tolerance)) {
          unreadable = c.s;
          break;
        }
        const value = toNumber(c.s);
        if (col.key === "quantity") amount = value;
        else if (row.composition[col.key] !== undefined) {
          unreadable = c.s;
          break;
        } else row.composition[col.key] = value;
      }
      if (unreadable) {
        out.skipped.push({
          page,
          text: `${name || "(sin nombre)"}: «${unreadable}»`,
          reason: "Un dato de la fila no cae en ninguna columna.",
        });
        continue;
      }
      const invalid =
        name.length > 100
          ? "El nombre pasa de 100 letras."
          : compositionKeys.some(
                (k) =>
                  (row.composition[k] ?? 0) >
                  (compositionIndex.includes(k) ? 1000 : 100),
              )
            ? "Trae un valor imposible (un porcentaje de más de 100 o un índice de más de 1000)."
            : "";
      if (invalid) {
        out.skipped.push({
          page,
          text: name || "(sin nombre)",
          reason: invalid,
        });
        continue;
      }
      checkRow(
        row,
        amount,
        columns.map((c) => c.key),
      );
      if (row.name) push(row);
      else pending = row;
    }
    if (pending) push(pending);
  });
  if (!found)
    out.reason =
      "No se ha encontrado una tabla de composición: hace falta una cabecera con «INGREDIENTES», «CANTIDAD» y las columnas (azúcar, grasas…).";
  else if (!out.rows.length)
    out.reason = "La tabla se reconoce, pero no trae ninguna fila que leer.";
  return out;
}

/** Comprobaciones con los propios números de la fila. Solo avisan: nada se corrige. */
function checkRow(row: TableRow, amount: number | undefined, cols: Column[]) {
  const c = row.composition;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const text = (n: number) => String(r1(n)).replace(".", ",");
  if (amount !== undefined && amount !== 100)
    row.issues.push(
      `La cantidad de la fila es ${text(amount)}, no 100: los valores no son por 100 g.`,
    );
  const lacking = compositionKeys.filter(
    (k) => cols.includes(k) && c[k] === undefined,
  );
  if (lacking.length)
    row.issues.push(
      `La tabla no trae: ${lacking.map((k) => compositionLabels[k]).join(", ")}.`,
    );
  const has = (...keys: CompositionKey[]) =>
    keys.every((k) => c[k] !== undefined);
  if (has("sugars", "fat", "msnf", "otherSolids", "solids")) {
    const sum = c.sugars! + c.fat! + c.msnf! + c.otherSolids!;
    if (Math.abs(sum - c.solids!) > 0.25)
      row.issues.push(
        `Azúcar + grasas + sólidos lácteos + otros sólidos suman ${text(sum)} y la tabla dice ${text(c.solids!)} de sólidos totales.`,
      );
  }
  if (has("solids", "water") && Math.abs(c.solids! + c.water! - 100) > 0.25)
    row.issues.push(
      `Sólidos totales + agua suman ${text(c.solids! + c.water!)}, no 100.`,
    );
  if (has("pacSugars", "pac") && c.pac! < c.pacSugars! - 0.05)
    row.issues.push(
      `El PAC total (${text(c.pac!)}) es menor que el PAC de los azúcares (${text(c.pacSugars!)}).`,
    );
}
