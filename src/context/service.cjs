// Contexto del día: clima previsto, festivos oficiales y eventos que anota el usuario.
// Base propia data/contexto.sqlite. El clima guardado de un día pasado es la PREVISIÓN que había,
// no una observación: se rotula así. Los eventos son del usuario y no salen de ninguna fuente.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const {
  parseMetno,
  parseHolidayCsv,
  symbolLabel,
  keepsBetter,
  WEATHER_SOURCE,
  HOLIDAY_SOURCE,
} = require("../../build/context.js");
const { portToday, addDays } = require("../../build/cruises.js");
const { MetnoProvider, CaibHolidayProvider } = require("./providers.cjs");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS weather(
  day TEXT PRIMARY KEY, t_min REAL NOT NULL, t_max REAL NOT NULL, precip_mm REAL, symbol TEXT,
  samples INTEGER NOT NULL, resolution TEXT NOT NULL, source TEXT NOT NULL,
  source_updated_at TEXT, fetched_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS holidays(
  day TEXT NOT NULL, name TEXT NOT NULL, scope TEXT NOT NULL, year INTEGER NOT NULL,
  source TEXT NOT NULL, source_url TEXT NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY(day, name));
CREATE INDEX IF NOT EXISTS holidays_year ON holidays(year);
CREATE TABLE IF NOT EXISTS events(
  id TEXT PRIMARY KEY, day_from TEXT NOT NULL, day_to TEXT NOT NULL, name TEXT NOT NULL,
  note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_days ON events(day_from, day_to);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d) => dayPattern.test(d) && addDays(addDays(d, 1), -1) === d;

class ContextService {
  constructor(
    dataDir,
    {
      weather = new MetnoProvider(),
      holidays = new CaibHolidayProvider(),
      log = () => {},
      clock = () => new Date(),
    } = {},
  ) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, "contexto.sqlite");
    this.db = new DatabaseSync(this.file);
    this.db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
    this.db.exec(SCHEMA);
    this.weatherProvider = weather;
    this.holidayProvider = holidays;
    this.log = log;
    this.clock = clock;
    this.busy = null;
  }
  close() {
    try {
      this.db.close();
    } catch {
      // Already closed.
    }
  }
  meta(key, fallback = "") {
    return (
      this.db.prepare("SELECT value FROM meta WHERE key=?").get(key)?.value ??
      fallback
    );
  }
  setMeta(key, value) {
    this.db
      .prepare(
        "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, String(value));
  }
  backupTo(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, "contexto-copia.sqlite");
    const tmp = target + ".tmp";
    fs.rmSync(tmp, { force: true });
    this.db.exec("VACUUM INTO '" + tmp.replace(/'/g, "''") + "'");
    fs.renameSync(tmp, target);
    return target;
  }

  // ---------- Sincronización ----------
  /** Clima: nunca antes de lo que marca Expires ni de 3 h; tras un fallo, 1 h. */
  weatherDue() {
    const now = this.clock().getTime();
    const next = Date.parse(this.meta("weather_next", "")) || 0;
    return now >= next;
  }
  async syncWeather() {
    const now = this.clock();
    try {
      const r = await this.weatherProvider.forecast({
        ifModifiedSince: this.meta("weather_last_modified"),
      });
      const expires = Date.parse(r.expires || "") || 0;
      const next = Math.max(expires, now.getTime() + 3 * 3600000);
      this.setMeta("weather_next", new Date(next).toISOString());
      this.setMeta("weather_ok", now.toISOString());
      this.setMeta("weather_error", "");
      if (r.notModified) return { stored: 0, notModified: true };
      const today = portToday(now);
      const days = parseMetno(r.payload).filter((d) => d.day >= today);
      if (!days.length)
        throw Error("La previsión no trae ningún día utilizable.");
      let stored = 0;
      const get = this.db.prepare("SELECT samples FROM weather WHERE day=?");
      for (const d of days) {
        // A lone sample at the edge of the forecast says nothing about a whole day.
        if (d.samples < 3 && d.day !== today) continue;
        if (!keepsBetter(get.get(d.day) || null, d, today)) continue;
        this.db
          .prepare(
            `INSERT INTO weather(day,t_min,t_max,precip_mm,symbol,samples,resolution,source,source_updated_at,fetched_at)
             VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET t_min=excluded.t_min,
             t_max=excluded.t_max, precip_mm=excluded.precip_mm, symbol=excluded.symbol,
             samples=excluded.samples, resolution=excluded.resolution,
             source_updated_at=excluded.source_updated_at, fetched_at=excluded.fetched_at`,
          )
          .run(
            d.day,
            d.tMin,
            d.tMax,
            d.precipMm,
            d.symbol,
            d.samples,
            d.resolution,
            WEATHER_SOURCE,
            r.updatedAt || null,
            now.toISOString(),
          );
        stored++;
      }
      if (r.lastModified) this.setMeta("weather_last_modified", r.lastModified);
      this.log(`clima: ${stored} días guardados`);
      return { stored };
    } catch (e) {
      const network = e?.name === "TimeoutError" || e?.cause?.code;
      const message = network
        ? "Sin conexión con el servicio meteorológico."
        : String(e?.message || e).slice(0, 200);
      this.setMeta("weather_error", message);
      this.setMeta(
        "weather_next",
        new Date(now.getTime() + 3600000).toISOString(),
      );
      this.log("clima: " + message);
      return { error: message };
    }
  }
  /** Festivos: una vez por año. Si el año aún no está publicado, se vuelve a mirar cada 7 días. */
  holidayYearsDue() {
    const now = this.clock();
    const year = Number(portToday(now).slice(0, 4));
    const wanted = [year];
    // The next year's calendar is approved in autumn: start looking in October.
    if (Number(portToday(now).slice(5, 7)) >= 10) wanted.push(year + 1);
    return wanted.filter((y) => {
      if (this.meta("holidays_ok_" + y)) return false;
      const tried = Date.parse(this.meta("holidays_tried_" + y, "")) || 0;
      return now.getTime() - tried >= 7 * 86400000;
    });
  }
  async syncHolidays(year) {
    const now = this.clock();
    this.setMeta("holidays_tried_" + year, now.toISOString());
    try {
      const r = await this.holidayProvider.calendar(year);
      if (r.missing) {
        this.setMeta("holidays_note_" + year, r.reason);
        this.log(`festivos ${year}: ${r.reason}`);
        return { missing: true, reason: r.reason };
      }
      const parsed = parseHolidayCsv(r.text, year);
      // A real calendar has about 14 days for Palma; far fewer means the format changed.
      if (parsed.holidays.length < 8)
        throw Error(
          `El CSV de ${year} solo dio ${parsed.holidays.length} festivos: formato no reconocido.`,
        );
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare("DELETE FROM holidays WHERE year=?").run(year);
        for (const h of parsed.holidays)
          this.db
            .prepare(
              "INSERT INTO holidays(day,name,scope,year,source,source_url,fetched_at) VALUES(?,?,?,?,?,?,?)",
            )
            .run(
              h.day,
              h.name,
              h.scope,
              year,
              HOLIDAY_SOURCE,
              r.url,
              now.toISOString(),
            );
        this.db.exec("COMMIT");
      } catch (e) {
        if (this.db.isTransaction) this.db.exec("ROLLBACK");
        throw e;
      }
      this.setMeta("holidays_ok_" + year, now.toISOString());
      this.setMeta("holidays_note_" + year, "");
      this.log(
        `festivos ${year}: ${parsed.holidays.length} guardados, ${parsed.rejected.length} filas rechazadas`,
      );
      return {
        stored: parsed.holidays.length,
        rejected: parsed.rejected.length,
      };
    } catch (e) {
      const network = e?.name === "TimeoutError" || e?.cause?.code;
      const message = network
        ? "Sin conexión con el catálogo del Govern."
        : String(e?.message || e).slice(0, 200);
      this.setMeta("holidays_note_" + year, message);
      this.log(`festivos ${year}: ${message}`);
      return { error: message };
    }
  }
  /** Llamado por el temporizador y por «Actualizar ahora». */
  sync({ force = false } = {}) {
    if (this.busy) return this.busy;
    this.busy = (async () => {
      if (force || this.weatherDue()) await this.syncWeather();
      const years = force
        ? [
            ...new Set([
              Number(portToday(this.clock()).slice(0, 4)),
              ...this.holidayYearsDue(),
            ]),
          ].filter((y) => !this.meta("holidays_ok_" + y))
        : this.holidayYearsDue();
      for (const y of years) await this.syncHolidays(y);
    })()
      .finally(() => {
        this.busy = null;
      })
      .then(() => this.status());
    return this.busy;
  }

  // ---------- Vistas ----------
  status() {
    const year = Number(portToday(this.clock()).slice(0, 4));
    return {
      weather: {
        source: WEATHER_SOURCE,
        updatedAt: this.meta("weather_ok") || null,
        error: this.meta("weather_error"),
      },
      holidays: {
        source: HOLIDAY_SOURCE,
        year,
        loaded: Boolean(this.meta("holidays_ok_" + year)),
        note: this.meta("holidays_note_" + year),
      },
    };
  }
  /** Contexto por día de un intervalo: { "AAAA-MM-DD": { weather, holidays, events } }. */
  range(from, to) {
    if (!realDay(from) || !realDay(to) || to < from)
      throw Error("Intervalo inválido.");
    if (addDays(from, 100) < to) throw Error("Intervalo demasiado largo.");
    const today = portToday(this.clock());
    const days = {};
    const slot = (day) =>
      (days[day] ??= { weather: null, holidays: [], events: [] });
    for (const w of this.db
      .prepare("SELECT * FROM weather WHERE day BETWEEN ? AND ?")
      .all(from, to))
      slot(w.day).weather = {
        tMin: w.t_min,
        tMax: w.t_max,
        precipMm: w.precip_mm,
        symbol: w.symbol,
        label: symbolLabel(w.symbol),
        approximate: w.resolution !== "hourly" || w.samples < 12,
        // Never an observation: for a past day this is the forecast that was stored.
        kind: w.day < today ? "previsión guardada" : "previsión",
        source: w.source,
        fetchedAt: w.fetched_at,
      };
    for (const h of this.db
      .prepare("SELECT * FROM holidays WHERE day BETWEEN ? AND ? ORDER BY day")
      .all(from, to))
      slot(h.day).holidays.push({
        name: h.name,
        scope: h.scope,
        source: h.source,
      });
    for (const e of this.db
      .prepare(
        "SELECT * FROM events WHERE day_from<=? AND day_to>=? ORDER BY day_from",
      )
      .all(to, from))
      for (
        let d = e.day_from < from ? from : e.day_from;
        d <= e.day_to && d <= to;
        d = addDays(d, 1)
      )
        slot(d).events.push({
          id: e.id,
          name: e.name,
          note: e.note,
          from: e.day_from,
          to: e.day_to,
        });
    return { from, to, days, status: this.status() };
  }
  addEvent(input) {
    const clean = (v, max) =>
      String(v ?? "")
        .replace(/\p{Cc}/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
    const name = clean(input.name, 80);
    const from = String(input.from || "");
    const to = String(input.to || from);
    if (!name) throw Error("Pon un nombre al evento.");
    if (!realDay(from) || !realDay(to) || to < from)
      throw Error("Fechas del evento inválidas.");
    if (addDays(from, 60) < to)
      throw Error("Un evento no puede durar más de 60 días.");
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO events(id,day_from,day_to,name,note,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        from,
        to,
        name,
        clean(input.note, 200),
        this.clock().toISOString(),
      );
    return id;
  }
  deleteEvent(id) {
    const r = this.db
      .prepare("DELETE FROM events WHERE id=?")
      .run(String(id || ""));
    if (!r.changes) throw Error("Evento desconocido.");
  }
}

module.exports = { ContextService };
