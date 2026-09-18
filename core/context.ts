// Contexto del día para planificar: clima previsto, festivos oficiales y ventas frente a cruceros.
// Misma regla que en cruceros: CONFIRMADO (lo dice la fuente), DERIVADO (cálculo documentado) o
// null («No disponible»). Aquí tampoco hay estimaciones ni correlaciones.
import { wallFromInstant, addDays } from "./cruises.js";
import type { ImpactLevel } from "./cruises.js";

export const WEATHER_SOURCE = "MET Norway (api.met.no), CC BY 4.0";
export const WEATHER_URL = "https://api.met.no/";
export const HOLIDAY_SOURCE =
  "Govern de les Illes Balears, calendario laboral (datos abiertos)";
export const PALMA = { lat: 39.5696, lon: 2.6502 };

// ---------- Clima ----------
export type DayWeather = {
  day: string;
  /** DERIVADO: mínima y máxima de las temperaturas previstas para las horas del día. */
  tMin: number;
  tMax: number;
  /** DERIVADO: suma de la precipitación prevista por tramos; null si la fuente no la da. */
  precipMm: number | null;
  /** CONFIRMADO: símbolo de la fuente para el tramo de mediodía (o el más cercano). */
  symbol: string | null;
  /** Horas del día cubiertas por la previsión: con pocas, mínima y máxima son orientativas. */
  samples: number;
  /** "hourly" si hay dato cada hora; "6h" si la fuente solo da un valor cada seis horas. */
  resolution: "hourly" | "6h";
};
type MetStep = {
  time?: unknown;
  data?: {
    instant?: { details?: { air_temperature?: unknown } };
    next_1_hours?: Period;
    next_6_hours?: Period;
    next_12_hours?: Period;
  };
};
type Period = {
  summary?: { symbol_code?: unknown };
  details?: { precipitation_amount?: unknown };
};
const finite = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : null;
/** Previsión de MET Norway (UTC) → un resumen por día de Palma. Valores fuera de rango se ignoran. */
export function parseMetno(payload: unknown): DayWeather[] {
  const series = (payload as { properties?: { timeseries?: unknown } })
    ?.properties?.timeseries;
  if (!Array.isArray(series)) return [];
  type Acc = {
    temps: number[];
    precip: number;
    anyPrecip: boolean;
    hourly: number;
    symbols: { hour: number; code: string }[];
  };
  const days = new Map<string, Acc>();
  for (const raw of series as MetStep[]) {
    const ms = Date.parse(String(raw?.time ?? ""));
    if (Number.isNaN(ms)) continue;
    const wall = wallFromInstant(ms);
    const day = wall.slice(0, 10);
    const acc =
      days.get(day) ??
      ({
        temps: [],
        precip: 0,
        anyPrecip: false,
        hourly: 0,
        symbols: [],
      } as Acc);
    days.set(day, acc);
    const t = finite(raw.data?.instant?.details?.air_temperature, -40, 60);
    if (t !== null) acc.temps.push(t);
    // One period per step, never both: hourly while the source has it, six-hourly afterwards.
    const period = raw.data?.next_1_hours ?? raw.data?.next_6_hours;
    if (raw.data?.next_1_hours) acc.hourly++;
    const mm = finite(period?.details?.precipitation_amount, 0, 1000);
    if (mm !== null) {
      acc.precip += mm;
      acc.anyPrecip = true;
    }
    const code =
      raw.data?.next_6_hours?.summary?.symbol_code ??
      raw.data?.next_1_hours?.summary?.symbol_code;
    if (typeof code === "string" && /^[a-z_]{3,40}$/.test(code))
      acc.symbols.push({ hour: Number(wall.slice(11, 13)), code });
  }
  const out: DayWeather[] = [];
  for (const [day, a] of days) {
    if (!a.temps.length) continue;
    // Symbol of the period closest to 13:00 port time: the one that matters for an afternoon.
    const symbol =
      [...a.symbols].sort(
        (x, y) => Math.abs(x.hour - 13) - Math.abs(y.hour - 13),
      )[0]?.code ?? null;
    out.push({
      day,
      tMin: Math.round(Math.min(...a.temps) * 10) / 10,
      tMax: Math.round(Math.max(...a.temps) * 10) / 10,
      precipMm: a.anyPrecip ? Math.round(a.precip * 10) / 10 : null,
      symbol,
      samples: a.temps.length,
      resolution: a.hourly >= a.temps.length / 2 ? "hourly" : "6h",
    });
  }
  return out.sort((x, y) => x.day.localeCompare(y.day));
}
const symbolWords: [RegExp, string][] = [
  [/thunder/, "tormenta"],
  [/heavysnow|snow/, "nieve"],
  [/sleet/, "aguanieve"],
  [/heavyrain/, "lluvia fuerte"],
  [/lightrain/, "lluvia débil"],
  [/rain/, "lluvia"],
  [/fog/, "niebla"],
  [/^cloudy/, "nublado"],
  [/partlycloudy/, "intervalos nubosos"],
  [/fair/, "poco nuboso"],
  [/clearsky/, "despejado"],
];
/** Traducción del símbolo de la fuente. Un código desconocido se muestra tal cual, no se adivina. */
export function symbolLabel(code: string | null): string | null {
  if (!code) return null;
  const base = code.replace(/_(day|night|polartwilight)$/, "");
  const word = symbolWords.find(([re]) => re.test(base))?.[1];
  if (!word) return base;
  return /showers/.test(base) ? `chubascos (${word})` : word;
}
/** Una previsión más completa del mismo día no se pisa con otra parcial tomada más tarde. */
export const keepsBetter = (
  stored: { samples: number } | null,
  fresh: DayWeather,
  today: string,
): boolean => !stored || fresh.day > today || fresh.samples >= stored.samples;

// ---------- Festivos ----------
export type Holiday = {
  day: string;
  name: string;
  scope: "regional" | "local";
};
const months: Record<string, number> = {
  gener: 1,
  febrer: 2,
  març: 3,
  abril: 4,
  maig: 5,
  juny: 6,
  juliol: 7,
  agost: 8,
  setembre: 9,
  octubre: 10,
  novembre: 11,
  desembre: 12,
};
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
/** "24 de juny" o "2 d’abril" + año del conjunto de datos → "AAAA-MM-DD"; "" si no se entiende. */
export function parseCatalanDate(text: string, year: number): string {
  const m = /^(\d{1,2})\s+d(?:e\s+|['’`´]\s*)(\p{L}+)$/u.exec(
    text.trim().toLowerCase(),
  );
  if (!m) return "";
  const month = months[m[2] ?? ""];
  const dayNum = Number(m[1]);
  if (!month || dayNum < 1 || dayNum > 31) return "";
  const d = new Date(Date.UTC(year, month - 1, dayNum));
  if (d.getUTCMonth() !== month - 1) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
}
/**
 * CSV oficial «Calendari Laboral General i Local Illes Balears» → festivos que afectan a Palma:
 * los de ámbito autonómico (incluyen los nacionales) y los locales del municipio de Palma.
 */
export function parseHolidayCsv(
  text: string,
  year: number,
): { holidays: Holiday[]; rejected: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const at = (name: string): number =>
    header.findIndex((h) => h.startsWith(name));
  const iScope = at("àmbit");
  const iTown = at("municipi");
  const iPlace = at("localitat");
  const iDate = at("data");
  const iName = at("nom");
  if ([iScope, iTown, iDate, iName].some((i) => i < 0))
    return { holidays: [], rejected: ["cabecera del CSV no reconocida"] };
  const seen = new Set<string>();
  const holidays: Holiday[] = [];
  const rejected: string[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const scope = (c[iScope] ?? "").toLowerCase();
    const town = (c[iTown] ?? "").toLowerCase();
    const place = (c[iPlace] ?? town).toLowerCase();
    const regional = scope.startsWith("auton") || scope.startsWith("estatal");
    const local =
      scope.startsWith("local") && town === "palma" && place === "palma";
    if (!regional && !local) continue;
    const day = parseCatalanDate(c[iDate] ?? "", year);
    const name = (c[iName] ?? "")
      .replace(/\p{Cc}/gu, " ")
      .trim()
      .slice(0, 80);
    if (!day || !name) {
      if (rejected.length < 20) rejected.push(line.slice(0, 80));
      continue;
    }
    if (seen.has(day + name)) continue;
    seen.add(day + name);
    holidays.push({ day, name, scope: regional ? "regional" : "local" });
  }
  return {
    holidays: holidays.sort((a, b) => a.day.localeCompare(b.day)),
    rejected,
  };
}

// ---------- Ventas frente a cruceros ----------
export type SalesDay = { day: string; salesKg: number; impact: ImpactLevel };
export type ImpactSales = {
  impact: ImpactLevel;
  days: number;
  /** DERIVADO: media y extremos de los kilos vendidos en los días de ese nivel. */
  meanKg: number | null;
  minKg: number | null;
  maxKg: number | null;
  /** Hay días suficientes para que la media diga algo. Por debajo solo se muestran los días. */
  enough: boolean;
};
export const MIN_DAYS_PER_LEVEL = 8;
/**
 * Ventas registradas agrupadas por el nivel de impacto de ese día. Son hechos puestos lado a lado:
 * no se calcula correlación ni se predice nada. Solo entran días con ventas registradas, porque
 * un día sin registro no distingue «cerrado» de «no apuntado».
 */
export function salesByImpact(days: SalesDay[]): ImpactSales[] {
  const order: ImpactLevel[] = [
    "none",
    "low",
    "medium",
    "high",
    "veryHigh",
    "unknown",
  ];
  return order.map((impact) => {
    const kg = days
      .filter((d) => d.impact === impact && d.salesKg > 0)
      .map((d) => d.salesKg);
    const n = kg.length;
    const round = (v: number): number => Math.round(v * 100) / 100;
    return {
      impact,
      days: n,
      meanKg: n ? round(kg.reduce((a, b) => a + b, 0) / n) : null,
      minKg: n ? round(Math.min(...kg)) : null,
      maxKg: n ? round(Math.max(...kg)) : null,
      enough: n >= MIN_DAYS_PER_LEVEL,
    };
  });
}
/** Kilos vendidos por día: movimientos «Venta del día AAAA-MM-DD» que no fueron deshechos. */
export function dailySalesKg(
  movements: {
    id: string;
    kind: string;
    reason: string;
    delta: number;
    reverses?: string | undefined;
  }[],
): Map<string, number> {
  const undone = new Set(
    movements.map((m) => m.reverses).filter((id): id is string => !!id),
  );
  const out = new Map<string, number>();
  for (const m of movements) {
    if (m.kind !== "exit" || undone.has(m.id)) continue;
    const day = /^Venta del día (\d{4}-\d{2}-\d{2})/.exec(m.reason)?.[1];
    if (!day) continue;
    out.set(
      day,
      Math.round(((out.get(day) ?? 0) + Math.abs(m.delta)) * 1000) / 1000,
    );
  }
  return out;
}
export { addDays };
