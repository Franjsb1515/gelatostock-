// Foto del Calendario: con el texto que la lectura local sacó de la foto, propone a qué día va y
// a qué apartado (horario de la semana, ventas del día, documento de un proveedor o nota). Solo
// reglas, sin modelo. Nada se guarda aquí: la persona revisa la propuesta y la confirma. Lo que no
// se lee no se rellena: una fecha que la foto no dice queda null y se pregunta.
import type { State } from "./schema";
import { guessDocType, type DocType } from "./documents";
import { identifySupplier } from "./identify";
import { fold, kg as kgRound, pad } from "./util";
import type { Roster } from "./roster";

export type PhotoKind = "schedule" | "sales" | "document" | "note";
export type ReadShift = { person: string; from: string; to: string };
/** Un día leído del horario, por su posición en la semana (0 = lunes). */
export type ReadScheduleDay = {
  weekday: number;
  closed: boolean;
  open?: string;
  close?: string;
  shifts: ReadShift[];
};
export type ReadSaleLine = {
  product: string;
  name: string;
  sold: number;
  waste: number;
  gift: number;
  /** La línea de la foto de la que sale, para contrastar. */
  line: string;
};
export type DayPhotoReading = {
  /** null: no se pudo leer nada útil; la foto se guarda y se escribe a mano. */
  kind: PhotoKind | null;
  /** Día propuesto; null si la foto no lo dice (se pregunta). */
  date: string | null;
  /** Texto de la foto del que sale la fecha. */
  dateText: string | null;
  reasons: string[];
  schedule: ReadScheduleDay[];
  sales: ReadSaleLine[];
  /** Líneas con cantidades cuyo gelato no se reconoce: se enseñan, no se adivinan. */
  unknown: string[];
  /** Trozos que la lectura no entiende (una hora rota, una cantidad dudosa): se enseñan, no se usan. */
  skipped: string[];
  document: { docType?: DocType; supplier?: string } | null;
  note: string;
  /** Cuadrante de turnos leído como tabla (persona × día), si la foto lo es. */
  roster?: Roster;
};

/** Propuesta de una foto que es un cuadrante de turnos (leído casilla por casilla). */
export function rosterReading(r: Roster): DayPhotoReading {
  const unsure = r.people.reduce(
    (n, p) => n + p.cells.filter((c) => !c.sure).length,
    0,
  );
  const cells = r.people.reduce((n, p) => n + p.cells.length, 0);
  const reasons = [
    `Es un cuadrante: ${r.people.length} ${r.people.length === 1 ? "persona" : "personas"} y ${r.dates.length || r.weekdays.length} días, leídos casilla por casilla. Revísalo antes de guardar.`,
    unsure
      ? `${unsure} de ${cells} casillas están marcadas para revisar (lectura dudosa).`
      : "Todas las casillas se leyeron con seguridad.",
    ...(r.dates.length
      ? [`Del ${r.dates[0]} al ${r.dates.at(-1)}. ${r.yearReason}`]
      : []),
    ...r.problems,
    ...(r.skipped.length ? [`No se usan: ${r.skipped.join(", ")}.`] : []),
  ];
  return {
    kind: "schedule",
    date: r.dates[0] ?? null,
    dateText: null,
    reasons,
    schedule: [],
    sales: [],
    unknown: [],
    skipped: [],
    document: null,
    note: "",
    roster: r,
  };
}

const months: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sept: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};
const monthWord =
  "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)";
const weekdays: [RegExp, number][] = [
  [/^(lunes|lun)$/, 0],
  [/^(martes|mar)$/, 1],
  [/^(miercoles|mie|mier|mierc)$/, 2],
  [/^(jueves|jue)$/, 3],
  [/^(viernes|vie)$/, 4],
  [/^(sabado|sab)$/, 5],
  [/^(domingo|dom)$/, 6],
];
const weekdayOf = (word: string): number | null => {
  const w = fold(word).replace(/\.$/, "");
  for (const [re, n] of weekdays) if (re.test(w)) return n;
  return null;
};
const weekdayToken =
  /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|lun|mar|mi[eé]r?c?|jue|vie|s[aá]b|dom)\.?(?=$|[\s:,;|·\-–—/])/giu;

function realDate(y: number, m: number, d: number): string | null {
  const x = new Date(Date.UTC(y, m - 1, d));
  if (x.getUTCMonth() !== m - 1 || x.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

type FoundDate = {
  date: string;
  text: string;
  index: number;
  guessedYear: boolean;
};
/** Fechas escritas en el texto, en el orden en que aparecen. */
export function findDates(text: string, today: string): FoundDate[] {
  const t = fold(text);
  const year = Number(today.slice(0, 4));
  const out: FoundDate[] = [];
  const push = (
    index: number,
    raw: string,
    d: number,
    m: number,
    y: number | null,
  ) => {
    const full = y === null ? year : y < 100 ? 2000 + y : y;
    const date = realDate(full, m, d);
    if (date && full >= 2000 && full <= 2100)
      out.push({ date, text: raw.trim(), index, guessedYear: y === null });
  };
  for (const m of t.matchAll(
    /(?<!\d)(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4}|\d{2})(?!\d)/g,
  ))
    push(m.index, m[0], Number(m[1]), Number(m[2]), Number(m[3]));
  // «del 6 al 12 de octubre (de 2026)»: dos fechas del mismo mes.
  for (const m of t.matchAll(
    new RegExp(
      `(?<!\\d)(\\d{1,2})\\.?\\s+al\\s+(\\d{1,2})\\s+de\\s+${monthWord}(?:\\s+(?:de|del)?\\s*(\\d{4}))?`,
      "g",
    ),
  )) {
    const mo = months[m[3]!]!;
    const y = m[4] ? Number(m[4]) : null;
    push(m.index, m[0], Number(m[1]), mo, y);
    push(m.index + 1, m[0], Number(m[2]), mo, y);
  }
  for (const m of t.matchAll(
    new RegExp(
      `(?<!\\d)(\\d{1,2})\\s*(?:de\\s+)?${monthWord}\\.?(?![a-z])(?:\\s*(?:de|del|,)?\\s*(\\d{4}))?`,
      "g",
    ),
  ))
    if (
      !out.some((o) => o.index <= m.index && m.index < o.index + o.text.length)
    )
      push(
        m.index,
        m[0],
        Number(m[1]),
        months[m[2]!]!,
        m[3] ? Number(m[3]) : null,
      );
  return out.sort((a, b) => a.index - b.index);
}

// Hora suelta: «10», «10h», «10:30», «10.30». Un rango: hora - hora (o «a», «hasta»).
const hour = "([01]?\\d|2[0-3])(?:\\s?[:.,]\\s?([0-5]\\d))?\\s*h?";
const rangeRe = () =>
  new RegExp(
    `(?<![\\d:.,/])${hour}\\s*(?:-|–|—|a|al|hasta)\\s*${hour}(?![\\d/])`,
    "giu",
  );
const clock = (h: string, m?: string): string =>
  `${pad(Number(h))}:${m ?? "00"}`;
const notName =
  /^(abre|abrimos|apertura|horario|tienda|turno|turnos|de|y|cierre|cerrado|cerrada|h|horas?|manana|tarde|noche)$/;

/** Limpia la etiqueta delante de un rango: el nombre de la persona o nada (la apertura). */
function personOf(label: string): string {
  // Un número suelto delante («Ana 1017 Marta») es una hora mal leída: el nombre es lo de después.
  const tail = label.split(/\d[\d:.,]*/u).at(-1) ?? "";
  const words = tail
    .replace(/[|:;,·()[\]{}=*_"'«»]+/g, " ")
    .replace(/[-–—]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && /\p{L}/u.test(w) && !notName.test(fold(w)));
  const name = words.join(" ").trim();
  return name.length >= 2 && name.length <= 40 ? name : "";
}

/** Rango de horas de un trozo de texto con lo que lleva delante. */
function rangesIn(text: string): { label: string; from: string; to: string }[] {
  const out: { label: string; from: string; to: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(rangeRe())) {
    out.push({
      label: text.slice(last, m.index),
      from: clock(m[1]!, m[2]),
      to: clock(m[3]!, m[4]),
    });
    last = m.index + m[0].length;
  }
  return out;
}

const withoutDates = (line: string, today: string): string => {
  let out = line;
  for (const d of findDates(line, today))
    out = out.replace(
      new RegExp(d.text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "i"),
      " ",
    );
  // Fechas sin año («6/10») también fuera, para no leerlas como horas.
  return out.replace(/(?<!\d)\d{1,2}\/\d{1,2}(?!\d)/g, " ");
};

const weekdayNames = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
/** Horario: líneas que empiezan por un día de la semana, o «Persona: lunes 10-17, martes …». */
export function readSchedule(
  text: string,
  today: string,
): { days: ReadScheduleDay[]; skipped: string[] } {
  const skipped: string[] = [];
  const days = new Map<number, ReadScheduleDay>();
  const day = (n: number) =>
    days.get(n) ??
    days.set(n, { weekday: n, closed: false, shifts: [] }).get(n)!;
  for (const raw of text.split(/\r?\n/)) {
    const line = withoutDates(raw.normalize("NFC"), today).trim();
    if (!line) continue;
    const tokens = [...line.matchAll(weekdayToken)];
    const lead = /^[\s|*·•\-–—>]*/.exec(line)![0].length;
    if (tokens.length && tokens[0]!.index === lead) {
      // «Lunes 11:00-23:00 · Ana 10:30-17:00, Luis 17-23:30» o «Lunes cerrado».
      const n = weekdayOf(tokens[0]![1]!);
      if (n === null) continue;
      const rest = line.slice(lead + tokens[0]![0].length);
      const d = day(n);
      if (/cerrad/i.test(fold(rest)) && !rangesIn(rest).length) {
        d.closed = true;
        continue;
      }
      for (const r of rangesIn(rest)) {
        const broken = r.label.match(/\d[\d:.,]*/u);
        if (broken)
          skipped.push(
            `${weekdayNames[n]}: no se entiende «${r.label.trim()}» (una hora mal leída): escríbelo tú.`,
          );
        const person = personOf(r.label);
        if (person) d.shifts.push({ person, from: r.from, to: r.to });
        else if (!d.open) {
          d.open = r.from;
          d.close = r.to;
        }
      }
      continue;
    }
    // «Ana: lunes 10-17, martes 10-17».
    const head = /^\s*([\p{L}][\p{L} .'-]{1,38}?)\s*:\s*(.+)$/u.exec(line);
    if (!head || !tokens.length) continue;
    const person = personOf(head[1]!);
    if (!person) continue;
    const parts = [...head[2]!.matchAll(weekdayToken)];
    for (const [i, t] of parts.entries()) {
      const n = weekdayOf(t[1]!);
      if (n === null) continue;
      const end = parts[i + 1]?.index ?? head[2]!.length;
      const piece = head[2]!.slice(t.index + t[0].length, end);
      const r = rangesIn(piece)[0];
      if (r) day(n).shifts.push({ person, from: r.from, to: r.to });
    }
  }
  return {
    days: [...days.values()]
      .filter((d) => d.closed || d.open || d.shifts.length)
      .sort((a, b) => a.weekday - b.weekday),
    skipped,
  };
}

/** Gelatos de la persona (los que produce una receta) con los nombres por los que se reconocen. */
function gelatos(s: State) {
  const out: { id: string; name: string; keys: string[][] }[] = [];
  for (const r of s.recipes) {
    if (!r.product || out.some((g) => g.id === r.product)) continue;
    const p = s.products.find((x) => x.id === r.product);
    if (!p) continue;
    const keys = [p.name, r.name]
      .map((n) =>
        fold(n)
          .split(/[^a-z0-9]+/)
          .filter(
            (w) =>
              w.length >= 3 && !/^(gelato|helado|de|del|con|los|las)$/.test(w),
          ),
      )
      .filter((k) => k.some((w) => /[a-z]{3}/.test(w)));
    out.push({ id: p.id, name: p.name, keys });
  }
  return out;
}

/** Tope de lo que un sabor puede vender en un día; por encima, la cantidad se da por mal leída. */
const MAX_KG = 50;
const qtyRe =
  /(?<![\d.,])(\d+(?:[.,]\d{1,3})?)\s*(kg|kilos?|k(?![a-z])|gr|g(?![a-z])|gramos)/gu;

/** Ventas del día: «Pistacho 2,5 kg», «Chocolate vendido 3 kg merma 0,2 kg», «Fior di latte 800 g». */
export function readSales(
  s: State,
  text: string,
): { sales: ReadSaleLine[]; unknown: string[]; skipped: string[] } {
  const list = gelatos(s);
  const sales = new Map<string, ReadSaleLine>();
  const unknown: string[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const qs = [...fold(line).matchAll(qtyRe)];
    const words = new Set(fold(line).split(/[^a-z0-9]+/));
    if (!qs.length) {
      const named = list.find((g) =>
        g.keys.some((k) =>
          k.filter((w) => /[a-z]/.test(w)).every((w) => words.has(w)),
        ),
      );
      if (named)
        skipped.push(
          `${named.name}: no se lee la cantidad en «${line}». Escríbela tú.`,
        );
      continue;
    }
    // Un gelato se reconoce si están todas las palabras de su nombre (los números no hacen falta).
    const hits = list.filter((g) =>
      g.keys.some((k) =>
        k.filter((w) => /[a-z]/.test(w)).every((w) => words.has(w)),
      ),
    );
    if (hits.length !== 1) {
      if (/\p{L}{3}/u.test(line)) unknown.push(line);
      continue;
    }
    const g = hits[0]!;
    const row = sales.get(g.id) ?? {
      product: g.id,
      name: g.name,
      sold: 0,
      waste: 0,
      gift: 0,
      line,
    };
    const folded = fold(line);
    let previous = 0;
    const amounts: [string, number][] = [];
    for (const q of qs) {
      const before = folded.slice(previous, q.index);
      previous = q.index + q[0].length;
      let n = Number(q[1]!.replace(",", "."));
      if (/^(g|gr|gramos)$/.test(q[2]!)) n /= 1000;
      n = Math.round(n * 1000) / 1000;
      amounts.push([before, n]);
    }
    // Más de MAX_KG kilos de un sabor en un día no cabe en el pozzetto: es una lectura mala.
    if (amounts.some(([, n]) => n > MAX_KG)) {
      skipped.push(
        `${g.name}: la cantidad de «${line}» parece mal leída (más de ${MAX_KG} kg). Escríbela tú.`,
      );
      continue;
    }
    for (const [before, n] of amounts)
      if (/merma|tirad|perdid/.test(before)) row.waste = kgRound(row.waste + n);
      else if (/invitac|degusta|consumo/.test(before))
        row.gift = kgRound(row.gift + n);
      else row.sold = kgRound(row.sold + n);
    sales.set(g.id, row);
  }
  return { sales: [...sales.values()], unknown, skipped };
}

const letters = (t: string): number => (t.match(/\p{L}/gu) || []).length;

const numbersOf = (line: string): string =>
  (line.match(/\d+(?:[.,:]\d+)*/g) || []).join(" ");
const wordsOf = (line: string): string[] =>
  fold(line).match(/[a-z]{3,}/g) || [];

/**
 * Líneas de text cuyas cifras no salen iguales en second, una segunda lectura independiente de la
 * misma foto. Una cifra mal leída (un 11 que sale 14) no se distingue de una buena por sí sola;
 * que dos lecturas distintas coincidan, sí. Una línea vale si en la otra lectura hay una línea
 * con las mismas cifras en el mismo orden y alguna palabra en común.
 */
export function doubtfulLines(text: string, second: string): string[] {
  const pool = second
    .split(/\r?\n/)
    .map((l) => ({ nums: numbersOf(l), words: wordsOf(l) }))
    .filter((l) => l.nums);
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const nums = numbersOf(line);
    if (!nums) continue;
    const words = wordsOf(line);
    const i = pool.findIndex(
      (l) =>
        l.nums === nums &&
        (words.length === 0 || l.words.some((w) => words.includes(w))),
    );
    if (i >= 0) pool.splice(i, 1);
    else out.push(line);
  }
  return out;
}

/**
 * Lectura completa de una foto del Calendario. confidence es la de la lectura local (0–100).
 * second, si se da, es una segunda lectura de la misma foto: las líneas cuyas cifras no coinciden
 * en las dos no se usan para proponer nada y se enseñan para que la persona las escriba.
 */
export function readDayPhoto(
  s: State,
  text: string,
  confidence: number,
  today: string,
  second?: string,
): DayPhotoReading {
  const full = text.replace(/\r/g, "").trim();
  const doubtful = second === undefined ? [] : doubtfulLines(full, second);
  const clean = doubtful.length
    ? full
        .split("\n")
        .filter((l) => !doubtful.includes(l.trim()))
        .join("\n")
        .trim()
    : full;
  const doubts = doubtful.map(
    (l) =>
      `«${l}»: los números no se leen igual dos veces seguidas. Escríbelos tú.`,
  );
  const base: DayPhotoReading = {
    kind: null,
    date: null,
    dateText: null,
    reasons: [],
    schedule: [],
    sales: [],
    unknown: [],
    skipped: [],
    document: null,
    note: full,
  };
  if (letters(full) < 12 || confidence < 35)
    return {
      ...base,
      note: "",
      reasons: [
        "No se pudo leer texto útil en la foto. Se guarda en su día y puedes escribir tú lo que dice.",
      ],
    };
  const t = fold(clean);
  const dates = findDates(clean, today);
  const docType = guessDocType(clean);
  const who = identifySupplier(s, { text: clean });
  const docWords = (
    t.match(
      /\b(factura|albaran|nif|cif|base imponible|iva|total a pagar)\b/g,
    ) || []
  ).length;
  const { days: schedule, skipped: scheduleSkipped } = readSchedule(
    clean,
    today,
  );
  const { sales, unknown, skipped: salesSkipped } = readSales(s, clean);
  const scheduleScore =
    schedule.length + (/\b(horario|turnos?|cuadrante)\b/.test(t) ? 2 : 0);
  const salesScore =
    sales.length + (/\b(ventas?|vendido|cierre|caja)\b/.test(t) ? 2 : 0);
  let kind: PhotoKind;
  const reasons: string[] = [];
  if (docType || (docWords >= 2 && who.supplier) || docWords >= 3) {
    kind = "document";
    reasons.push(
      docType
        ? `El encabezado dice que es ${docType === "albaran" ? "un albarán" : docType === "factura" ? "una factura" : "un documento de proveedor"}: va a Documentos.`
        : "Tiene palabras de factura o albarán (IVA, NIF…): va a Documentos.",
    );
    reasons.push(
      who.supplier
        ? `Proveedor: ${s.suppliers.find((x) => x.id === who.supplier)?.name}. ${who.reason}`
        : who.reason,
    );
  } else if (schedule.length >= 2 && scheduleScore >= salesScore) {
    kind = "schedule";
    reasons.push(
      `Se leen ${schedule.length} días de horario o turnos: va al horario de la semana, para revisarlo antes de guardar.`,
    );
  } else if (
    (sales.length || salesSkipped.length) &&
    salesScore > scheduleScore
  ) {
    kind = "sales";
    reasons.push(
      `Se reconocen ${sales.length} ${sales.length === 1 ? "gelato" : "gelatos"} con cantidades: va a las ventas del día, para revisarlas antes de guardar.`,
    );
  } else {
    kind = "note";
    reasons.push(
      "No parece horario, ventas ni documento: se propone como nota del día.",
    );
  }
  if (unknown.length && kind === "sales")
    reasons.push(
      `${unknown.length} ${unknown.length === 1 ? "línea con cantidad no corresponde" : "líneas con cantidad no corresponden"} a ningún gelato tuyo: no se apuntan.`,
    );
  // El día: el horario va a la semana de su primera fecha; un documento, a su fecha; ventas y
  // notas, solo si la foto dice una sola fecha.
  let pick: FoundDate | null = null;
  const distinct = [...new Set(dates.map((d) => d.date))];
  if (kind === "schedule")
    pick = [...dates].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  else if (kind === "document") pick = dates[0] ?? null;
  else if (distinct.length === 1) pick = dates[0]!;
  let date = pick?.date ?? null;
  if (date && kind === "schedule") {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    date = d.toISOString().slice(0, 10);
  }
  if (pick) {
    reasons.push(
      `Fecha leída en la foto: «${pick.text}»${kind === "schedule" ? `: semana del lunes ${date}` : ""}.`,
    );
    if (pick.guessedYear)
      reasons.push(
        `La foto no dice el año: se propone ${pick.date.slice(0, 4)}. Compruébalo.`,
      );
  } else
    reasons.push(
      distinct.length > 1
        ? "La foto tiene varias fechas: elige tú el día."
        : "La foto no dice la fecha: elige tú el día.",
    );
  if (doubts.length)
    reasons.push(
      doubts.length === 1
        ? "Hay una línea con números dudosos: no se usa. Mírala en la foto y escríbela tú."
        : `Hay ${doubts.length} líneas con números dudosos: no se usan. Míralas en la foto y escríbelas tú.`,
    );
  return {
    ...base,
    kind,
    date,
    dateText: pick?.text ?? null,
    reasons,
    schedule: kind === "schedule" ? schedule : [],
    sales: kind === "sales" ? sales : [],
    unknown: kind === "sales" ? unknown : [],
    skipped: [
      ...(kind === "schedule"
        ? scheduleSkipped
        : kind === "sales"
          ? salesSkipped
          : []),
      ...doubts,
    ],
    document:
      kind === "document"
        ? {
            ...(docType ? { docType } : {}),
            ...(who.supplier ? { supplier: who.supplier } : {}),
          }
        : null,
  };
}
