// Cuadrante de turnos leído de una foto con forma de tabla (src/table-ocr.cjs da, por casilla,
// varias lecturas candidatas). Aquí, solo reglas: qué fila son los días de la semana, cuál los
// números, de qué mes y año, quién es cada persona y qué turno tiene cada día. Lo dudoso se marca
// (sure: false) para que la persona lo revise; lo que no se lee queda vacío. Nada se inventa.
import { addDays, fold, pad } from "./util";

export type CellReading = { text: string; conf: number };
export type ShiftValue = { label?: string; from?: string; to?: string };
export type RosterCell = {
  /** Lo leído tal cual (la mejor lectura). */
  raw: string;
  value: ShiftValue | null;
  /** false: hay que revisarlo (lectura dudosa o palabra desconocida). */
  sure: boolean;
  /** Horas que dieron las distintas lecturas, cuando no coinciden. */
  options?: string[];
};
export type Roster = {
  /** Una fecha por columna de día; vacío si no se pudo saber el mes (se pregunta). */
  dates: string[];
  /** Día de la semana leído en cada columna (0 = lunes), o null. */
  weekdays: (number | null)[];
  month: number | null;
  year: number | null;
  /** Cómo se sabe el año (está escrito, o se deduce porque cuadran los días de la semana). */
  yearReason: string;
  people: { name: string; cells: RosterCell[] }[];
  /** Filas que no son personas (cruceros, clima…) o personas sin ningún turno. */
  skipped: string[];
  problems: string[];
};

const weekdayNames = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];
const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
/** Tipos de turno conocidos (más los que ya haya escrito la persona en el horario). */
const baseLabels = [
  "Apertura",
  "Cierre",
  "Partido",
  "Producción",
  "Libre",
  "Mise en place",
  "Logística",
  "Mañana",
  "Tarde",
  "Noche",
  "Intermedio",
  "Refuerzo",
  "Vacaciones",
  "Descanso",
  "Baja",
  "Cocina",
  "Sala",
  "Barra",
  "Obrador",
  "Laboratorio",
];
const letters = (t: string): string => fold(t).replace(/[^a-z]/g, "");
const notRows = [
  "cruceros",
  "clima",
  "dia",
  "dias",
  "semana",
  "total",
  "totales",
  "horario",
  "fecha",
];

/** Distancia de edición (Levenshtein). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length]![b.length]!;
}
/** La palabra de la lista más parecida y su distancia (sin tildes, solo letras). */
function closest(
  text: string,
  list: string[],
): { word: string; dist: number } | null {
  const t = letters(text);
  if (t.length < 2) return null;
  let best: { word: string; dist: number } | null = null;
  for (const w of list) {
    const d = distance(t, letters(w));
    if (!best || d < best.dist) best = { word: w, dist: d };
  }
  return best;
}
const tolerance = (word: string) =>
  Math.max(1, Math.round(letters(word).length * 0.25));

const weekdayOf = (cands: CellReading[]): number | null => {
  for (const c of [...cands].sort((a, b) => b.conf - a.conf)) {
    const m = closest(c.text, weekdayNames);
    if (m && m.dist <= 2) return weekdayNames.indexOf(m.word);
  }
  return null;
};
/** El último número de 1 a 31 de la casilla («agosto 31» → 31). */
const dayNumberOf = (cands: CellReading[]): number | null => {
  for (const c of [...cands].sort((a, b) => b.conf - a.conf)) {
    const nums = (c.text.match(/\d{1,2}/g) || [])
      .map(Number)
      .filter((n) => n >= 1 && n <= 31);
    if (nums.length && c.conf >= 40) return nums.at(-1)!;
  }
  return null;
};

/** Hora «11:00 A 16:00», «19.00-00.00», «11 a 16»; con las confusiones típicas (O por 0). */
function timeRange(
  text: string,
): { from: string; to: string; sure: boolean } | null {
  const t = text
    .toUpperCase()
    .replace(/(?<=\d)[O]|[O](?=\d)/g, "0")
    .replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, "1");
  const m =
    /(\d{1,2})\s*[:.;,]?\s*(\d{2})?\s*(?:A|-|–|—|HASTA|AL)\s*(\d{1,2})\s*[:.;,]?\s*(\d{2})?/.exec(
      t,
    );
  if (!m) return null;
  const h1 = Number(m[1]),
    h2 = Number(m[3]);
  const m1 = m[2] ?? "00",
    m2 = m[4] ?? "00";
  if (h1 > 24 || h2 > 24 || Number(m1) > 59 || Number(m2) > 59) return null;
  const from = `${pad(h1 % 24)}:${m1}`,
    to = `${pad(h2 % 24)}:${m2}`;
  // Minutos raros (00:09) suelen ser un 0 mal leído: se proponen, pero hay que revisarlos.
  const round = (x: string) => ["00", "15", "30", "45"].includes(x);
  return { from, to, sure: round(m1) && round(m2) && from !== to };
}

/** El turno de una casilla, eligiendo entre sus lecturas la que mejor encaja. */
function shiftOf(
  cands: CellReading[],
  labels: string[],
  inked = false,
): RosterCell {
  let best: (RosterCell & { score: number }) | null = null;
  for (const c of cands) {
    const raw = c.text.trim();
    if ((raw.match(/[\p{L}\d]/gu) || []).length < 2) continue;
    const time = timeRange(raw);
    let cell: RosterCell & { score: number };
    if (time)
      cell = {
        raw,
        value: { from: time.from, to: time.to },
        sure: time.sure && c.conf >= 50,
        score: (time.sure ? 3 : 1) + c.conf / 100,
      };
    else {
      const m = closest(raw, labels);
      if (m && m.dist <= tolerance(m.word))
        cell = {
          raw,
          value: { label: m.word },
          sure: m.dist <= 1 && c.conf >= 40,
          score: 3 - m.dist + c.conf / 100,
        };
      else if (letters(raw).length >= 3 && c.conf >= 60)
        cell = {
          raw,
          value: {
            label: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
          },
          sure: false,
          score: c.conf / 200,
        };
      else continue;
    }
    if (!best || cell.score > best.score) best = cell;
  }
  // Si dos lecturas dan horas distintas (un 9 leído como 8), hay que revisarlo; se propone la que
  // más se repite y se guardan las demás por si otra casilla del cuadrante confirma alguna.
  const counts = new Map<string, number>();
  for (const c of cands) {
    const x = timeRange(c.text);
    if (x)
      counts.set(
        x.from + "-" + x.to,
        (counts.get(x.from + "-" + x.to) ?? 0) + 1,
      );
  }
  if (best?.value?.from && counts.size > 1) {
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const [from, to] = top.split("-") as [string, string];
    best.value = { from, to };
    best.sure = false;
    best.options = [...counts.keys()];
  }
  if (best) {
    const { score, ...cell } = best;
    void score;
    return cell;
  }
  // Algo hay escrito pero no se entiende: vacío y a revisar.
  const seen = cands.find((c) => letters(c.text).length >= 2);
  return seen || inked
    ? { raw: seen?.text ?? "", value: null, sure: false }
    : { raw: "", value: null, sure: true };
}

const titleCase = (t: string) =>
  t
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, a: string, b: string) => a + b.toUpperCase(),
    );

/**
 * Interpreta la tabla. grid[fila][columna] = lecturas de esa casilla. today da el año de partida.
 * known son tipos de turno ya escritos por la persona. null si no parece un cuadrante.
 */
/** Fila de los días de la semana y columnas de los días (o null). */
function findHeader(
  grid: CellReading[][][],
): { header: number; dayCols: number[] } | null {
  let header = -1;
  let dayCols: number[] = [];
  for (const [r, row] of grid.entries()) {
    const cols = row
      .map((c, i) => (weekdayOf(c) !== null ? i : -1))
      .filter((i) => i >= 0);
    if (cols.length >= 3 && cols.length > dayCols.length) {
      header = r;
      dayCols = cols;
    }
  }
  return header < 0 ? null : { header, dayCols };
}

/**
 * Zona del título (encima y a la izquierda de los días) para leerla de una vez: el mes suele ir en
 * una casilla combinada que la cuadrícula parte. Coordenadas en líneas de la cuadrícula.
 */
export function rosterRegions(
  grid: CellReading[][][],
): { r0: number; r1: number; c0: number; c1: number }[] {
  const h = findHeader(grid);
  if (!h || h.dayCols[0]! < 1) return [];
  return [
    {
      r0: 0,
      r1: Math.min(grid.length, h.header + 2),
      c0: 0,
      c1: h.dayCols[0]!,
    },
  ];
}

export function parseRoster(
  grid: CellReading[][][],
  today: string,
  known: string[] = [],
  title: CellReading[][] = [],
  /** «Tinta» de cada casilla (src/table-ocr.cjs): con 6 o más hay algo escrito. */
  ink: number[][] = [],
): Roster | null {
  const labels = [...new Set([...baseLabels, ...known])];
  // 1. La fila de los días de la semana y sus columnas.
  let header = -1;
  let dayCols: number[] = [];
  for (const [r, row] of grid.entries()) {
    const cols = row
      .map((c, i) => (weekdayOf(c) !== null ? i : -1))
      .filter((i) => i >= 0);
    if (cols.length >= 3 && cols.length > dayCols.length) {
      header = r;
      dayCols = cols;
    }
  }
  if (header < 0) return null;
  // Columnas seguidas entre la primera y la última (una casilla mal leída no rompe la serie).
  const first = dayCols[0]!,
    last = dayCols.at(-1)!;
  dayCols = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const weekdays = dayCols.map((c) => weekdayOf(grid[header]![c] ?? []));
  const problems: string[] = [];
  // 2. La fila de los números del día, cerca de la de los días de la semana.
  let numbers: (number | null)[] = [];
  let numberRow = -1;
  for (const r of [header + 1, header - 1, header + 2, header - 2]) {
    const row = grid[r];
    if (!row) continue;
    const nums = dayCols.map((c) => dayNumberOf(row[c] ?? []));
    if (nums.filter((n) => n !== null).length >= Math.min(3, dayCols.length)) {
      numbers = nums;
      numberRow = r;
      break;
    }
  }
  // 3. El mes y, si está, el año: en las casillas de encima de la primera persona.
  let month: number | null = null,
    year: number | null = null;
  // Solo el título (filas de encima) y las casillas de la izquierda: «agosto 31» dentro de un día
  // no dice de qué mes es el cuadrante.
  // Primero la zona del título leída de una vez; después, las casillas sueltas (y unidas por fila,
  // por si la cuadrícula partió la palabra: «SEPTIEM» + «BRE»).
  const pieces: CellReading[] = [...title.flat()];
  for (const [r, row] of grid.slice(0, header + 3).entries()) {
    const left = row.slice(0, first);
    pieces.push({ text: left.map((c) => c[0]?.text ?? "").join(""), conf: 50 });
    for (const [ci, cands] of row.entries())
      if (r < header - 1 || ci < first) pieces.push(...cands);
  }
  for (const c of pieces) {
    const words = fold(c.text).split(/[^a-z0-9]+/);
    for (const w of words) {
      if (month === null && w.length >= 4) {
        const m = closest(w, monthNames);
        if (m && m.dist <= 1) month = monthNames.indexOf(m.word) + 1;
      }
      if (year === null && /^20\d\d$/.test(w)) year = Number(w);
    }
  }
  // 4. Fechas: un número de un día seguido del siguiente (o el primero bien leído) ancla la serie.
  let dates: string[] = [];
  let yearReason = "";
  let anchor = -1;
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i];
    if (n === null || n === undefined || n > 28) continue;
    const next = numbers[i + 1];
    if (next === n + 1 || anchor < 0) anchor = i;
    if (next === n + 1) break;
  }
  if (month === null)
    problems.push(
      "No se lee el mes del cuadrante: elige tú la fecha del primer día.",
    );
  else if (anchor < 0)
    problems.push(
      "No se leen los números de los días: elige tú la fecha del primer día.",
    );
  else {
    const base = Number(today.slice(0, 4));
    const build = (y: number) =>
      dayCols.map((_, i) =>
        addDays(`${y}-${pad(month!)}-${pad(numbers[anchor]!)}`, i - anchor),
      );
    const fits = (list: string[]) =>
      list.every((d, i) => {
        const w = weekdays[i];
        return (
          w === null ||
          w === undefined ||
          (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7 === w
        );
      });
    if (year !== null) {
      dates = build(year);
      yearReason = `El año ${year} está escrito en el cuadrante.`;
      if (!fits(dates))
        problems.push(
          "Los días de la semana no cuadran con las fechas: revísalas.",
        );
    } else {
      const options = [base - 1, base, base + 1].filter((y) => fits(build(y)));
      year = options.includes(base) ? base : (options[0] ?? base);
      dates = build(year);
      yearReason = options.length
        ? `El cuadrante no dice el año: ${year}, porque es el año en que esos días caen en esos días de la semana.`
        : `El cuadrante no dice el año: se propone ${year}, pero los días de la semana no cuadran. Revísalo.`;
      if (!options.length)
        problems.push(
          "Los días de la semana no cuadran con las fechas: revísalas.",
        );
    }
  }
  // 5. Personas: filas de debajo con un nombre a la izquierda de los días.
  const people: Roster["people"] = [];
  const skipped: string[] = [];
  for (let r = header + 1; r < grid.length; r++) {
    if (r === numberRow) continue;
    const row = grid[r]!;
    const labelCols = row.slice(0, first);
    const best = (cands: CellReading[]) =>
      [...cands]
        .filter((c) => letters(c.text).length >= 3)
        .sort((a, b) => b.conf - a.conf)[0];
    const label = labelCols
      .map((c) => best(c)?.text ?? "")
      .join(" ")
      .trim();
    const joined = letters(label);
    if (!joined) continue;
    if (notRows.some((w) => joined.startsWith(w) || distance(joined, w) <= 2)) {
      continue;
    }
    // El nombre es la casilla más cercana a los días; a su izquierda puede ir el puesto.
    // Un nombre es solo letras (texto claro sobre color se lee con menos confianza, pero se lee).
    const nameCell = [...(row[first - 1] ?? [])]
      .map((c) => ({
        ...c,
        text: c.text
          .replace(/[^\p{L}\s'-]/gu, " ")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((c) => letters(c.text).length >= 3 && c.conf >= 25)
      .sort((x, y) => y.conf - x.conf)[0];
    if (!nameCell) {
      skipped.push(
        `una fila sin nombre legible (${titleCase(label.replace(/^[^\p{L}]+/u, ""))})`,
      );
      continue;
    }
    const cells = dayCols.map((c) =>
      shiftOf(row[c] ?? [], labels, (ink[r]?.[c] ?? 0) >= 6),
    );
    // Una persona tiene algún turno legible; si no (cruceros, clima…), no es una persona.
    if (!cells.some((c) => c.value)) {
      skipped.push(titleCase(nameCell.text) + " (sin turnos)");
      continue;
    }
    people.push({
      name: titleCase(nameCell.text.replace(/[^\p{L}\s'-]/gu, "").trim()),
      cells,
    });
  }
  if (!people.length) return null;
  // Una hora dudosa cuyas lecturas incluyen una hora que en este mismo cuadrante salió segura se
  // propone con esa hora (sigue marcada para revisar): «11:00-15:00 / 11:00-16:00» → 11:00-16:00.
  const sureTimes = new Set(
    people.flatMap((p) =>
      p.cells
        .filter((c) => c.sure && c.value?.from)
        .map((c) => c.value!.from + "-" + c.value!.to),
    ),
  );
  for (const p of people)
    for (const c of p.cells) {
      const known = (c.options ?? []).filter((o) => sureTimes.has(o));
      if (known.length === 1) {
        const [from, to] = known[0]!.split("-") as [string, string];
        c.value = { from, to };
      }
    }
  return {
    dates,
    weekdays,
    month,
    year,
    yearReason,
    people,
    skipped,
    problems,
  };
}
