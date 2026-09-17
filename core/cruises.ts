// Cruceros en el puerto de Palma: validación de la fuente oficial y cálculos de planificación.
// Todo es puro y auditable. Las horas son siempre las del puerto (Europe/Madrid), nunca las del
// equipo. Clasificación de cada dato: CONFIRMADO (viene de la fuente), DERIVADO (calculado con
// datos confirmados; la fórmula está en el comentario), DESCONOCIDO (null; la interfaz muestra
// «No disponible»). Aquí no hay estimaciones.

export const PORT_ZONE = "Europe/Madrid";
export const SOURCE_NAME = "Autoridad Portuaria de Baleares";
export const SOURCE_URL = "https://www.portsdebalears.com/es/buques-en-puerto";

/** Pasajeros declarados por el barco al puerto para esa escala. null = la fuente no lo dice. */
export type Pax = {
  disembark: number | null;
  embark: number | null;
  transit: number | null;
};
export type CruiseCall = {
  /** Identificador oficial de la escala: puerto + año + número de escala de la APB. */
  id: string;
  imo: string;
  ship: string;
  from: string;
  fromCountry: string;
  to: string;
  toCountry: string;
  /** Hora del puerto, "AAAA-MM-DDTHH:mm", tal como la publica la fuente. */
  arrival: string;
  departure: string;
  berth: string;
  agent: string;
  gt: number | null;
  length: number | null;
  flag: string;
  /** Estado literal de la fuente: Solicitado, Concedido, Iniciado, Finalizado. */
  sourceStatus: string;
  pax: Pax;
  /** La escala futura dejó de aparecer en la previsión. La fuente no explica el motivo. */
  withdrawn?: boolean;
};
export type Thresholds = { medium: number; high: number; veryHigh: number };
export const defaultThresholds: Thresholds = {
  medium: 3000,
  high: 6000,
  veryHigh: 10000,
};
export type ImpactLevel =
  "none" | "unknown" | "low" | "medium" | "high" | "veryHigh";
export const impactLabels: Record<ImpactLevel, string> = {
  none: "Sin cruceros",
  unknown: "No calculable",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  veryHigh: "Muy alto",
};

// ---------- Hora del puerto ----------
const wallFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: PORT_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const pad = (n: number): string => String(n).padStart(2, "0");
/** Instante → hora de pared del puerto "AAAA-MM-DDTHH:mm". */
export function wallFromInstant(ms: number): string {
  const p: Record<string, string> = {};
  for (const part of wallFormat.formatToParts(new Date(ms)))
    p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
const wallPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
function wallAsUtc(wall: string): number {
  const m = wallPattern.exec(wall);
  if (!m) return NaN;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
}
/**
 * Hora de pared del puerto → instante. Respeta horario de verano e invierno. En la hora repetida
 * del cambio de octubre se toma la primera (verano); la fuente no permite distinguirlas.
 */
export function instantFromWall(wall: string): number {
  const guess = wallAsUtc(wall);
  if (Number.isNaN(guess)) return NaN;
  const offset = (ms: number): number => wallAsUtc(wallFromInstant(ms)) - ms;
  const first = guess - offset(guess);
  const second = guess - offset(first);
  return offset(second) === offset(first) ? second : first;
}
/** La hora existe en el calendario (rechaza 31/02 o 25:00). */
export function validWall(wall: string): boolean {
  const ms = wallAsUtc(wall);
  if (Number.isNaN(ms)) return false;
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` ===
    wall
  );
}
/** Día de hoy en Palma, sea cual sea la zona horaria del equipo. */
export const portToday = (now: Date = new Date()): string =>
  wallFromInstant(now.getTime()).slice(0, 10);
export const portNow = (now: Date = new Date()): string =>
  wallFromInstant(now.getTime());
/** Aritmética de calendario sobre "AAAA-MM-DD" (sin zonas: son fechas, no instantes). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
const dayWindow = (day: string): [number, number] => [
  instantFromWall(day + "T00:00"),
  instantFromWall(addDays(day, 1) + "T00:00"),
];

// ---------- Validación de la fuente ----------
// Posiciones de columna de la rejilla pública (modelo «buques» del visor de la APB).
const COL = {
  typeCode: 6,
  type: 7,
  imo: 8,
  ship: 9,
  fromCountry: 10,
  toCountry: 11,
  from: 12,
  to: 13,
  arrival: 14,
  departure: 15,
  berth: 17,
  agent: 18,
  gt: 19,
  call: 20,
  flag: 21,
  length: 22,
  ops: 30,
  qty: 32,
  port: 36,
  status: 37,
} as const;
const MAX_STAY_DAYS = 30;
const MAX_PAX = 15000;

const clean = (v: unknown, max = 80): string =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const titleCase = (v: unknown): string =>
  clean(v)
    .toLowerCase()
    .replace(
      /(^|[\s(\-/])(\p{L})/gu,
      (_m, a: string, b: string) => a + b.toUpperCase(),
    );
/** Un mismo barco escrito de tres maneras es un solo barco. */
export const normalizeShipName = (v: unknown): string => clean(v).toUpperCase();
const positive = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** "18/09/2026 04:00" → "2026-09-18T04:00" (hora del puerto); "" si no es una fecha real. */
export function parseStamp(text: unknown): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(
    String(text ?? ""),
  );
  if (!m) return "";
  const wall = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
  return validWall(wall) ? wall : "";
}
/** Operaciones de pasaje: listas paralelas unidas por <br/>. Lo que no aparece queda en null. */
export function parsePassengers(ops: unknown, qty: unknown): Pax {
  const names = String(ops ?? "").split(/<br\s*\/?>/i);
  const amounts = String(qty ?? "").split(/<br\s*\/?>/i);
  const out: Pax = { disembark: null, embark: null, transit: null };
  names.forEach((raw, i) => {
    const name = raw.trim();
    const text = (amounts[i] ?? "").trim();
    const n = Number(text);
    if (!name || text === "" || !Number.isInteger(n) || n < 0 || n > MAX_PAX)
      return;
    const key: keyof Pax | null = /^desembar/i.test(name)
      ? "disembark"
      : /^embar/i.test(name)
        ? "embark"
        : /^tra[ns]*bordo|^tr[aá]nsito/i.test(name)
          ? "transit"
          : null;
    if (key) out[key] = (out[key] ?? 0) + n;
  });
  return out;
}
export type ParsedRow =
  | { ok: true; call: CruiseCall }
  | { ok: false; skip: true }
  | { ok: false; skip: false; reason: string };
/** Una fila de la rejilla → escala validada, fila ajena (otro puerto o tipo) o rechazo con motivo. */
export function parseApbRow(row: unknown): ParsedRow {
  const cell = (row as { cell?: unknown })?.cell;
  const rowId = clean((row as { id?: unknown })?.id, 60);
  if (!Array.isArray(cell) || cell.length < 38)
    return { ok: false, skip: false, reason: "fila con estructura inesperada" };
  const c = cell as unknown[];
  if (String(c[COL.typeCode]) !== "7" && !/crucero/i.test(String(c[COL.type])))
    return { ok: false, skip: true };
  if (clean(c[COL.port]) !== "Palma") return { ok: false, skip: true };
  const ship = normalizeShipName(c[COL.ship]);
  const arrival = parseStamp(c[COL.arrival]);
  const departure = parseStamp(c[COL.departure]);
  const label = ship || rowId || "sin nombre";
  if (!ship) return { ok: false, skip: false, reason: "escala sin barco" };
  if (!arrival || !departure)
    return { ok: false, skip: false, reason: `${label}: fecha inválida` };
  const stay = instantFromWall(departure) - instantFromWall(arrival);
  if (stay < 0)
    return {
      ok: false,
      skip: false,
      reason: `${label}: la salida es anterior a la llegada`,
    };
  if (stay > MAX_STAY_DAYS * 86400000)
    return {
      ok: false,
      skip: false,
      reason: `${label}: estancia de más de ${MAX_STAY_DAYS} días`,
    };
  // Official id "80|P|P|2026|741|1" = autoridad|puerto|puerto escala|año|número de escala|atraque.
  const parts = rowId.split("|");
  const year = /^\d{4}$/.test(parts[3] ?? "") ? parts[3] : "";
  const number = /^\d+$/.test(parts[4] ?? "")
    ? parts[4]
    : clean(c[COL.call], 12);
  const imo = /^\d{7}$/.test(clean(c[COL.imo], 12))
    ? clean(c[COL.imo], 12)
    : "";
  const id =
    year && number && /^\d+$/.test(String(number))
      ? `P-${year}-${number}`
      : imo
        ? `P-${imo}-${arrival.slice(0, 10)}`
        : "";
  if (!id)
    return {
      ok: false,
      skip: false,
      reason: `${label}: sin identificador de escala ni IMO`,
    };
  return {
    ok: true,
    call: {
      id,
      imo,
      ship,
      from: titleCase(c[COL.from]),
      fromCountry: titleCase(c[COL.fromCountry]),
      to: titleCase(c[COL.to]),
      toCountry: titleCase(c[COL.toCountry]),
      arrival,
      departure,
      berth: clean(c[COL.berth], 100),
      agent: clean(c[COL.agent], 100),
      gt: positive(c[COL.gt]),
      length: positive(c[COL.length]),
      flag: titleCase(c[COL.flag]),
      sourceStatus: clean(c[COL.status], 20),
      pax: parsePassengers(c[COL.ops], c[COL.qty]),
    },
  };
}
export type ParsedForecast = {
  calls: CruiseCall[];
  rejected: string[];
  rows: number;
};
/** Respuesta completa → escalas únicas. Los cambios de muelle de una misma escala se fusionan. */
export function parseApbPayload(payload: unknown): ParsedForecast {
  const rows = (payload as { rows?: unknown })?.rows;
  if (!Array.isArray(rows))
    return { calls: [], rejected: ["respuesta sin filas"], rows: 0 };
  const calls = new Map<string, CruiseCall>();
  const rejected: string[] = [];
  for (const row of rows) {
    const parsed = parseApbRow(row);
    if (!parsed.ok) {
      if (!parsed.skip && rejected.length < 50) rejected.push(parsed.reason);
      continue;
    }
    const call = parsed.call;
    const prev = calls.get(call.id);
    if (!prev) {
      calls.set(call.id, call);
      continue;
    }
    if (call.arrival < prev.arrival) prev.arrival = call.arrival;
    if (call.departure > prev.departure) prev.departure = call.departure;
    if (call.berth && !prev.berth.includes(call.berth))
      prev.berth = (prev.berth ? prev.berth + " · " : "") + call.berth;
    for (const k of ["disembark", "embark", "transit"] as const) {
      const a = prev.pax[k];
      const b = call.pax[k];
      prev.pax[k] = a === null ? b : b === null ? a : Math.max(a, b);
    }
  }
  return {
    calls: [...calls.values()].sort((a, b) =>
      a.arrival.localeCompare(b.arrival),
    ),
    rejected,
    rows: rows.length,
  };
}

// ---------- Datos derivados de una escala ----------
/**
 * DERIVADO. Pasajeros declarados a bordo = en tránsito + el mayor entre los que bajan y los que
 * suben (en un puerto base, unos sustituyen a otros). null si la fuente no declara nada.
 * No es la capacidad del barco ni el número de clientes.
 */
export function declaredPassengers(pax: Pax): number | null {
  if (pax.disembark === null && pax.embark === null && pax.transit === null)
    return null;
  return (pax.transit ?? 0) + Math.max(pax.disembark ?? 0, pax.embark ?? 0);
}
export type CallType = "transit" | "turnaround" | "mixed";
export const callTypeLabels: Record<CallType, string> = {
  transit: "Escala en tránsito",
  turnaround: "Puerto base (embarque y desembarque)",
  mixed: "Mixta (tránsito con embarque o desembarque)",
};
/** DERIVADO de las operaciones declaradas, nunca de los horarios. null si no hay declaración. */
export function callType(pax: Pax): CallType | null {
  const turn = Math.max(pax.disembark ?? 0, pax.embark ?? 0);
  const transit = pax.transit ?? 0;
  if (declaredPassengers(pax) === null || (turn === 0 && transit === 0))
    return null;
  return turn === 0 ? "transit" : transit === 0 ? "turnaround" : "mixed";
}
/** DERIVADO. Minutos reales de escala (cuenta bien las noches de cambio de hora). */
export const stayMinutes = (call: CruiseCall): number =>
  Math.round(
    (instantFromWall(call.departure) - instantFromWall(call.arrival)) / 60000,
  );
export type CallStatus =
  | "requested"
  | "granted"
  | "inPort"
  | "finished"
  | "past"
  | "withdrawn"
  | "pending";
export const statusLabels: Record<CallStatus, string> = {
  requested: "Programado (atraque solicitado)",
  granted: "Confirmado (atraque concedido)",
  inPort: "En puerto",
  finished: "Finalizado",
  past: "Salida prevista ya pasada (el puerto aún no la confirma)",
  withdrawn: "Retirada de la previsión",
  pending: "Información pendiente",
};
/** Solo los estados que la fuente permite afirmar. «Retrasado» o «Cancelado» no existen en ella. */
export function callStatus(call: CruiseCall, nowWall = ""): CallStatus {
  if (call.withdrawn) return "withdrawn";
  const s = call.sourceStatus.toLowerCase();
  // DERIVADO y dicho como tal: el horario pasó, pero la fuente todavía no cerró la escala.
  if (nowWall && call.departure < nowWall && !s.startsWith("finaliz"))
    return "past";
  return s.startsWith("solicit")
    ? "requested"
    : s.startsWith("conced")
      ? "granted"
      : s.startsWith("inici")
        ? "inPort"
        : s.startsWith("finaliz")
          ? "finished"
          : "pending";
}

// ---------- Cálculos del día ----------
export type Peak = {
  ships: number;
  /** Horas del puerto entre las que coinciden más barcos. */
  from: string;
  to: string;
  names: string[];
  /** Suma de pasajeros declarados de esos barcos; null si ninguno lo declara. */
  passengers: number | null;
};
export type DaySummary = {
  day: string;
  ships: number;
  arrivals: number;
  departures: number;
  firstArrival: string | null;
  lastDeparture: string | null;
  /** DERIVADO: suma de pasajeros declarados de los barcos presentes ese día. */
  passengers: number | null;
  /** Barcos del día sin pasajeros declarados (la suma queda incompleta). */
  undeclared: number;
  peak: Peak | null;
  /** DERIVADO: mayor suma de pasajeros declarados coincidiendo a la vez en puerto. */
  peakPassengers: number | null;
  peakPassengersFrom: string | null;
  peakPassengersTo: string | null;
  impact: ImpactLevel;
  ids: string[];
};
const active = (calls: CruiseCall[]): CruiseCall[] =>
  calls.filter((c) => !c.withdrawn);
/** Escalas presentes en algún momento del día (una nocturna cuenta en sus dos días). */
export function callsOnDay(calls: CruiseCall[], day: string): CruiseCall[] {
  const [start, end] = dayWindow(day);
  return active(calls)
    .filter((c) => {
      const a = instantFromWall(c.arrival);
      const d = instantFromWall(c.departure);
      return a < end && (d > start || (a >= start && d === a));
    })
    .sort((a, b) => a.arrival.localeCompare(b.arrival));
}
type Segment = { from: number; to: number; present: CruiseCall[] };
function segments(present: CruiseCall[], day: string): Segment[] {
  const [start, end] = dayWindow(day);
  const spans = present.map((c) => ({
    call: c,
    from: Math.max(start, instantFromWall(c.arrival)),
    to: Math.min(end, instantFromWall(c.departure)),
  }));
  const cuts = [
    ...new Set([start, end, ...spans.flatMap((s) => [s.from, s.to])]),
  ].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const from = cuts[i] as number;
    const to = cuts[i + 1] as number;
    out.push({
      from,
      to,
      present: spans
        .filter((s) => s.from <= from && s.to > from)
        .map((s) => s.call),
    });
  }
  return out;
}
const sumDeclared = (calls: CruiseCall[]): number | null => {
  const known = calls
    .map((c) => declaredPassengers(c.pax))
    .filter((n): n is number => n !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};
/**
 * Nivel de impacto potencial. Fórmula completa, sin factores ocultos:
 *   carga = mayor suma de pasajeros declarados que coinciden a la vez en puerto ese día.
 *   sin barcos → «Sin cruceros»; ningún barco declara pasajeros → «No calculable»;
 *   carga < medio → Bajo; < alto → Medio; < muy alto → Alto; si no → Muy alto.
 * Los umbrales se editan en Configuración. Mide carga portuaria potencial, no clientes.
 */
export function impactLevel(
  ships: number,
  peakPassengers: number | null,
  t: Thresholds = defaultThresholds,
): ImpactLevel {
  if (!ships) return "none";
  if (peakPassengers === null) return "unknown";
  return peakPassengers < t.medium
    ? "low"
    : peakPassengers < t.high
      ? "medium"
      : peakPassengers < t.veryHigh
        ? "high"
        : "veryHigh";
}
export function daySummary(
  calls: CruiseCall[],
  day: string,
  thresholds: Thresholds = defaultThresholds,
): DaySummary {
  const present = callsOnDay(calls, day);
  const arriving = present.filter((c) => c.arrival.slice(0, 10) === day);
  const leaving = present.filter((c) => c.departure.slice(0, 10) === day);
  const segs = segments(present, day);
  const most = Math.max(0, ...segs.map((s) => s.present.length));
  let peak: Peak | null = null;
  if (most > 0) {
    // First continuous run with the maximum number of ships.
    const first = segs.findIndex((s) => s.present.length === most);
    let last = first;
    while (
      last + 1 < segs.length &&
      (segs[last + 1] as Segment).present.length === most
    )
      last++;
    const a = segs[first] as Segment;
    const b = segs[last] as Segment;
    peak = {
      ships: most,
      from: wallFromInstant(a.from).slice(11),
      to: wallFromInstant(b.to).slice(11),
      names: a.present.map((c) => c.ship),
      passengers: sumDeclared(a.present),
    };
  }
  let peakPassengers: number | null = null;
  let paxFrom: string | null = null;
  let paxTo: string | null = null;
  segs.forEach((s, i) => {
    const total = sumDeclared(s.present);
    if (total === null || (peakPassengers !== null && total <= peakPassengers))
      return;
    peakPassengers = total;
    let end = i;
    while (
      end + 1 < segs.length &&
      sumDeclared((segs[end + 1] as Segment).present) === total
    )
      end++;
    paxFrom = wallFromInstant(s.from).slice(11);
    paxTo = wallFromInstant((segs[end] as Segment).to).slice(11);
  });
  const times = (list: string[]): string[] =>
    list.map((w) => w.slice(11)).sort();
  return {
    day,
    ships: present.length,
    arrivals: arriving.length,
    departures: leaving.length,
    firstArrival: times(arriving.map((c) => c.arrival))[0] ?? null,
    lastDeparture: times(leaving.map((c) => c.departure)).at(-1) ?? null,
    passengers: sumDeclared(present),
    undeclared: present.filter((c) => declaredPassengers(c.pax) === null)
      .length,
    peak,
    peakPassengers,
    peakPassengersFrom: paxFrom,
    peakPassengersTo: paxTo,
    impact: impactLevel(present.length, peakPassengers, thresholds),
    ids: present.map((c) => c.id),
  };
}
export type TimelineStep = { time: string; ships: string[] };
/** Cruceros en puerto a lo largo del día: una entrada cada vez que cambia el conjunto. */
export function dayTimeline(calls: CruiseCall[], day: string): TimelineStep[] {
  const out: TimelineStep[] = [];
  for (const s of segments(callsOnDay(calls, day), day)) {
    const ships = s.present.map((c) => c.ship).sort();
    const prev = out.at(-1);
    if (prev && prev.ships.join("|") === ships.join("|")) continue;
    if (!prev && !ships.length) continue;
    out.push({ time: wallFromInstant(s.from).slice(11), ships });
  }
  return out;
}
export type DayBar = {
  id: string;
  ship: string;
  /** Minutos desde las 00:00 del día (recortado al día). */
  startMinute: number;
  endMinute: number;
  startsBefore: boolean;
  endsAfter: boolean;
};
/** Barras horizontales del día, en minutos de reloj del puerto. */
export function dayBars(calls: CruiseCall[], day: string): DayBar[] {
  const minute = (wall: string): number =>
    Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
  return callsOnDay(calls, day).map((c) => {
    const startsBefore = c.arrival.slice(0, 10) < day;
    const endsAfter = c.departure.slice(0, 10) > day;
    return {
      id: c.id,
      ship: c.ship,
      startMinute: startsBefore ? 0 : minute(c.arrival),
      endMinute: endsAfter ? 1440 : minute(c.departure),
      startsBefore,
      endsAfter,
    };
  });
}

// ---------- Integridad ----------
/** Comprobaciones tras importar. Devuelve frases legibles; vacío = todo en orden. */
export function integrityIssues(calls: CruiseCall[]): string[] {
  const issues: string[] = [];
  const live = active(calls);
  for (const c of live) {
    if (!validWall(c.arrival) || !validWall(c.departure))
      issues.push(`${c.ship} (${c.id}): fecha imposible`);
    else if (c.departure < c.arrival)
      issues.push(`${c.ship} (${c.id}): sale antes de llegar`);
    for (const k of ["disembark", "embark", "transit"] as const) {
      const n = c.pax[k];
      if (n !== null && (n < 0 || n > MAX_PAX))
        issues.push(`${c.ship} (${c.id}): pasajeros fuera de rango`);
    }
    if (!c.ship) issues.push(`${c.id}: escala sin barco`);
  }
  const byShip = new Map<string, CruiseCall[]>();
  for (const c of live) {
    const key = c.imo || c.ship;
    byShip.set(key, [...(byShip.get(key) ?? []), c]);
  }
  for (const list of byShip.values()) {
    list.sort((a, b) => a.arrival.localeCompare(b.arrival));
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i] as CruiseCall;
      const b = list[i + 1] as CruiseCall;
      if (b.arrival < a.departure)
        issues.push(
          `${a.ship}: dos escalas se solapan (${a.id} y ${b.id}); posible duplicado`,
        );
    }
  }
  return issues;
}

// ---------- Cambios entre dos versiones de una escala ----------
export type FieldChange = { field: string; before: string; after: string };
const tracked: [keyof CruiseCall, string][] = [
  ["arrival", "Llegada"],
  ["departure", "Salida"],
  ["berth", "Muelle"],
  ["from", "Puerto anterior"],
  ["to", "Siguiente puerto"],
  ["sourceStatus", "Estado"],
];
/** Qué cambió en una escala ya conocida (para el historial de modificaciones). */
export function callChanges(
  before: CruiseCall,
  after: CruiseCall,
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const [key, label] of tracked) {
    const a = String(before[key] ?? "");
    const b = String(after[key] ?? "");
    if (a !== b) out.push({ field: label, before: a, after: b });
  }
  const pa = declaredPassengers(before.pax);
  const pb = declaredPassengers(after.pax);
  if (pa !== pb)
    out.push({
      field: "Pasajeros declarados",
      before: pa === null ? "No disponible" : String(pa),
      after: pb === null ? "No disponible" : String(pb),
    });
  return out;
}

// ---------- Sincronización ----------
/**
 * Cada cuánto consultar al puerto (la fuente se actualiza aproximadamente una vez al día):
 * barcos hoy o mañana → 3 h; en los próximos 7 días → 6 h; si no → 12 h.
 */
export function syncIntervalHours(calls: CruiseCall[], today: string): number {
  const next = active(calls)
    .filter((c) => c.departure.slice(0, 10) >= today)
    .map((c) => c.arrival.slice(0, 10))
    .sort()[0];
  if (!next) return 12;
  return next <= addDays(today, 1) ? 3 : next <= addDays(today, 7) ? 6 : 12;
}
/** Espera tras fallos consecutivos: 5 min, 15 min, 1 h, 3 h (tope). */
export const backoffMinutes = (failures: number): number =>
  [0, 5, 15, 60, 180][Math.min(Math.max(failures, 0), 4)] ?? 180;
