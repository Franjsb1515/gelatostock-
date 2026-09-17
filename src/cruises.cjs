// Registro de escalas de cruceros en el puerto de Palma.
// Origen de los datos: Autoridad Portuaria de Baleares (previsión de tráfico, datos abiertos).
// Es la única consulta de la app a internet aparte de WhatsApp: solo lee datos públicos, no envía
// nada del negocio y se puede desactivar en Configuración. El archivo data/cruceros.json es un
// registro derivado: si se borra, se vuelve a llenar con la previsión vigente (no con el pasado).
const fs = require("node:fs");
const path = require("node:path");

const BASE = "https://posidoniaweb.portsdebalears.com/gisweb_server";
const SOURCE = "Autoridad Portuaria de Baleares";
const KEEP_DAYS = 400;

// Column positions of the public grid (modelo «buques» del visor de la APB).
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
};

const pad = (n) => String(n).padStart(2, "0");
const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n, 12));
};
// "18/09/2026 04:00" (hora de Palma) → "2026-09-18T04:00". Sin zona: es hora local del puerto.
function parseStamp(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(
    String(text || ""),
  );
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : "";
}
const clean = (v, max = 80) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const title = (v) =>
  clean(v)
    .toLowerCase()
    .replace(/(^|[\s(\-/])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const number = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Passenger operations arrive as parallel lists joined by <br/>.
function passengers(ops, qty) {
  const names = String(ops || "").split(/<br\s*\/?>/i);
  const amounts = String(qty || "").split(/<br\s*\/?>/i);
  const out = { disembark: 0, embark: 0, transit: 0 };
  names.forEach((name, i) => {
    const n = number(amounts[i]);
    if (/^desembar/i.test(name.trim())) out.disembark += n;
    else if (/^embar/i.test(name.trim())) out.embark += n;
    else if (/^tra[ns]*bordo|^tr[aá]nsito/i.test(name.trim())) out.transit += n;
  });
  return out;
}

// Rows of the public grid → cruise calls at Palma, one per call (berth shifts are merged).
function parseCalls(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const calls = new Map();
  for (const row of rows) {
    const c = row?.cell;
    if (!Array.isArray(c) || c.length < 38) continue;
    if (
      String(c[COL.typeCode]) !== "7" &&
      !/crucero/i.test(String(c[COL.type]))
    )
      continue;
    if (clean(c[COL.port]) !== "Palma") continue;
    const arrival = parseStamp(c[COL.arrival]);
    const departure = parseStamp(c[COL.departure]);
    const ship = clean(c[COL.ship]);
    if (!arrival || !departure || !ship || departure < arrival) continue;
    const id = `${arrival.slice(0, 4)}-${clean(c[COL.call], 12) || clean(c[COL.imo], 12)}`;
    const pax = passengers(c[COL.ops], c[COL.qty]);
    const prev = calls.get(id);
    if (prev) {
      // Same call, another berth: widen the stay and keep the larger passenger figures.
      if (arrival < prev.arrival) prev.arrival = arrival;
      if (departure > prev.departure) prev.departure = departure;
      for (const k of Object.keys(pax))
        prev.pax[k] = Math.max(prev.pax[k], pax[k]);
      continue;
    }
    calls.set(id, {
      id,
      ship,
      imo: clean(c[COL.imo], 12),
      from: title(c[COL.from]),
      fromCountry: title(c[COL.fromCountry]),
      to: title(c[COL.to]),
      toCountry: title(c[COL.toCountry]),
      arrival,
      departure,
      berth: clean(c[COL.berth], 100),
      agent: clean(c[COL.agent], 100),
      gt: number(c[COL.gt]),
      length: number(c[COL.length]),
      flag: title(c[COL.flag]),
      status: clean(c[COL.status], 20),
      pax,
    });
  }
  return [...calls.values()].sort((a, b) => a.arrival.localeCompare(b.arrival));
}

// People aboard, roughly: those in transit plus the larger of who gets off and who gets on.
const aboard = (call) =>
  call.pax.transit + Math.max(call.pax.disembark, call.pax.embark);

function daySummary(calls, day) {
  const arrivals = calls.filter((c) => c.arrival.slice(0, 10) === day);
  const departures = calls.filter((c) => c.departure.slice(0, 10) === day);
  const inPort = calls.filter(
    (c) => c.arrival.slice(0, 10) <= day && c.departure.slice(0, 10) >= day,
  );
  return {
    day,
    arrivals,
    departures,
    inPort,
    passengers: inPort.reduce((n, c) => n + aboard(c), 0),
  };
}

// Anonymous session exactly as the public viewer opens it, then the grid as JSON.
async function fetchForecast({ fetchImpl = fetch, timeoutMs = 25000 } = {}) {
  const headers = {
    "User-Agent": "GelatoStock (consulta de datos abiertos de la APB)",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const login = await fetchImpl(BASE + "/login.do?metodo=login", {
    method: "POST",
    headers,
    body: "autpor=80",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!login.ok)
    throw Error(
      "El puerto respondió " + login.status + " al abrir la consulta.",
    );
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const list = await fetchImpl(BASE + "/atraqueop.do?metodo=list", {
    method: "POST",
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
    body: "_search=false&rows=5000&page=1&sidx=fecatr&sord=asc",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!list.ok)
    throw Error(
      "El puerto respondió " + list.status + " al pedir la previsión.",
    );
  const text = await list.text();
  if (text.length > 20_000_000)
    throw Error("Respuesta del puerto demasiado grande.");
  return JSON.parse(text);
}

class CruiseRegistry {
  constructor(dataDir, { fetcher = fetchForecast, log = () => {} } = {}) {
    this.file = path.join(dataDir, "cruceros.json");
    this.fetcher = fetcher;
    this.log = log;
    this.busy = null;
    this.error = "";
    this.data = { updatedAt: null, calls: {} };
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (saved && typeof saved.calls === "object")
        this.data = { updatedAt: saved.updatedAt || null, calls: saved.calls };
    } catch {
      // First run or unreadable file: the registry starts empty and refills on the next refresh.
    }
  }
  calls() {
    return Object.values(this.data.calls).sort((a, b) =>
      a.arrival.localeCompare(b.arrival),
    );
  }
  // Merge a fresh forecast: past calls stay as the registry, future ones follow the port's plan
  // (a future call that disappears from the forecast was cancelled and is removed).
  merge(fresh, now = new Date()) {
    const today = localDay(now);
    const limit = addDays(today, -KEEP_DAYS);
    const next = {};
    for (const c of Object.values(this.data.calls))
      if (c.departure.slice(0, 10) < today && c.departure.slice(0, 10) >= limit)
        next[c.id] = c;
    for (const c of fresh)
      if (c.departure.slice(0, 10) >= limit) next[c.id] = c;
    this.data = { updatedAt: now.toISOString(), calls: next };
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ source: SOURCE, ...this.data }));
    fs.renameSync(tmp, this.file);
  }
  refresh() {
    if (this.busy) return this.busy;
    this.busy = (async () => {
      try {
        const fresh = parseCalls(await this.fetcher());
        this.merge(fresh);
        this.error = "";
        this.log(`cruceros: ${fresh.length} escalas en la previsión`);
      } catch (e) {
        this.error =
          e?.name === "TimeoutError" || e?.cause?.code
            ? "Sin conexión con el puerto. Se muestra lo último guardado."
            : String(e?.message || e).slice(0, 200);
        this.log("cruceros: " + this.error);
      } finally {
        this.busy = null;
      }
      return this.view();
    })();
    return this.busy;
  }
  stale(hours = 6) {
    return (
      !this.data.updatedAt ||
      Date.now() - Date.parse(this.data.updatedAt) > hours * 3600 * 1000
    );
  }
  today(now = new Date()) {
    const s = daySummary(this.calls(), localDay(now));
    return {
      arrivals: s.arrivals.length,
      departures: s.departures.length,
      inPort: s.inPort.length,
      passengers: s.passengers,
      ships: s.inPort.map((c) => c.ship),
    };
  }
  view() {
    return {
      source: SOURCE,
      updatedAt: this.data.updatedAt,
      error: this.error,
      busy: Boolean(this.busy),
      calls: this.calls(),
    };
  }
}

module.exports = {
  CruiseRegistry,
  parseCalls,
  parseStamp,
  passengers,
  daySummary,
  aboard,
  fetchForecast,
  localDay,
  SOURCE,
};
