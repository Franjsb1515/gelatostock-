// Registro de cruceros en SQLite propio (data/cruceros.sqlite), separado del inventario.
// El histórico no se borra nunca: es lo que más adelante permitirá comparar cruceros y ventas.
// Una escala es una fila con identificador oficial estable; los cambios actualizan esa fila y
// dejan rastro en «changes». Nada de lo que hay aquí lo escribe la interfaz salvo la ficha manual
// del barco (naviera y capacidad), que guarda quién lo dijo.
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  callChanges,
  SOURCE_NAME,
  SOURCE_URL,
} = require("../../build/cruises.js");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ships(
  key TEXT PRIMARY KEY, imo TEXT NOT NULL, name TEXT NOT NULL,
  line TEXT, capacity_standard INTEGER, capacity_max INTEGER, crew INTEGER,
  info_source TEXT, info_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS calls(
  id TEXT PRIMARY KEY, ship_key TEXT NOT NULL REFERENCES ships(key),
  imo TEXT NOT NULL, ship TEXT NOT NULL,
  from_port TEXT NOT NULL, from_country TEXT NOT NULL, to_port TEXT NOT NULL, to_country TEXT NOT NULL,
  arrival TEXT NOT NULL, departure TEXT NOT NULL,
  scheduled_arrival TEXT, scheduled_departure TEXT,
  berth TEXT NOT NULL, agent TEXT NOT NULL, gt REAL, length REAL, flag TEXT NOT NULL,
  source_status TEXT NOT NULL,
  pax_disembark INTEGER, pax_embark INTEGER, pax_transit INTEGER,
  withdrawn INTEGER NOT NULL DEFAULT 0, withdrawn_at TEXT,
  origin TEXT NOT NULL, source TEXT NOT NULL, source_url TEXT NOT NULL, source_updated_at TEXT,
  retrieved_at TEXT NOT NULL, last_verified_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS calls_arrival ON calls(arrival);
CREATE INDEX IF NOT EXISTS calls_departure ON calls(departure);
CREATE INDEX IF NOT EXISTS calls_ship ON calls(ship_key);
CREATE INDEX IF NOT EXISTS calls_imo ON calls(imo);
CREATE INDEX IF NOT EXISTS calls_status ON calls(source_status, withdrawn);
CREATE TABLE IF NOT EXISTS changes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, call_id TEXT NOT NULL REFERENCES calls(id),
  at TEXT NOT NULL, field TEXT NOT NULL, before TEXT NOT NULL, after TEXT NOT NULL, reason TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS changes_call ON changes(call_id, at);
CREATE TABLE IF NOT EXISTS syncs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, started_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL, rows INTEGER NOT NULL, fetched INTEGER NOT NULL,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, unchanged INTEGER NOT NULL,
  rejected INTEGER NOT NULL, withdrawn INTEGER NOT NULL, restored INTEGER NOT NULL,
  error TEXT NOT NULL, notes TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const toCall = (r) => ({
  id: r.id,
  imo: r.imo,
  ship: r.ship,
  shipKey: r.ship_key,
  from: r.from_port,
  fromCountry: r.from_country,
  to: r.to_port,
  toCountry: r.to_country,
  arrival: r.arrival,
  departure: r.departure,
  scheduledArrival: r.scheduled_arrival,
  scheduledDeparture: r.scheduled_departure,
  berth: r.berth,
  agent: r.agent,
  gt: r.gt,
  length: r.length,
  flag: r.flag,
  sourceStatus: r.source_status,
  pax: {
    disembark: r.pax_disembark,
    embark: r.pax_embark,
    transit: r.pax_transit,
  },
  withdrawn: Boolean(r.withdrawn),
  withdrawnAt: r.withdrawn_at,
  origin: r.origin,
  source: r.source,
  sourceUrl: r.source_url,
  sourceUpdatedAt: r.source_updated_at,
  retrievedAt: r.retrieved_at,
  lastVerifiedAt: r.last_verified_at,
  updatedAt: r.updated_at,
});
const shipKey = (call) => call.imo || "N:" + call.ship;
const finished = (call) => /^finaliz/i.test(call.sourceStatus);

class CruiseRepository {
  constructor(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, "cruceros.sqlite");
    this.db = new DatabaseSync(this.file);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;",
    );
    this.db.exec(SCHEMA);
    // 0.24.0 kept a JSON cache; every call in it comes back from the source with better data.
    const legacy = path.join(dataDir, "cruceros.json");
    if (fs.existsSync(legacy))
      try {
        fs.renameSync(legacy, legacy + ".anterior");
      } catch {
        // Not worth failing for: the file is simply ignored.
      }
  }
  close() {
    try {
      this.db.close();
    } catch {
      // Already closed.
    }
  }
  /** Copia coherente del registro (VACUUM INTO) con nombre fijo: siempre la última. */
  backupTo(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, "cruceros-copia.sqlite");
    const tmp = target + ".tmp";
    fs.rmSync(tmp, { force: true });
    this.db.exec("VACUUM INTO '" + tmp.replace(/'/g, "''") + "'");
    fs.renameSync(tmp, target);
    return target;
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
  /**
   * Guarda una tanda de escalas ya validadas. origin: "forecast" (previsión vigente, completa) o
   * "history" (escalas finalizadas, con horas reales). Solo una previsión completa y no vacía
   * puede marcar como retiradas las escalas futuras que ya no aparecen.
   */
  apply(calls, { origin, now = new Date(), nowWall, sourceUpdatedAt = "" }) {
    const at = now.toISOString();
    const stats = {
      created: 0,
      updated: 0,
      unchanged: 0,
      withdrawn: 0,
      restored: 0,
    };
    const get = this.db.prepare("SELECT * FROM calls WHERE id=?");
    const addChange = this.db.prepare(
      "INSERT INTO changes(call_id,at,field,before,after,reason) VALUES(?,?,?,?,?,?)",
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const call of calls) {
        const key = shipKey(call);
        this.db
          .prepare(
            `INSERT INTO ships(key,imo,name,created_at,updated_at) VALUES(?,?,?,?,?)
             ON CONFLICT(key) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at
             WHERE ships.name<>excluded.name`,
          )
          .run(key, call.imo, call.ship, at, at);
        const row = get.get(call.id);
        if (!row) {
          this.db
            .prepare(
              `INSERT INTO calls(id,ship_key,imo,ship,from_port,from_country,to_port,to_country,
               arrival,departure,scheduled_arrival,scheduled_departure,berth,agent,gt,length,flag,
               source_status,pax_disembark,pax_embark,pax_transit,origin,source,source_url,
               source_updated_at,retrieved_at,last_verified_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .run(
              call.id,
              key,
              call.imo,
              call.ship,
              call.from,
              call.fromCountry,
              call.to,
              call.toCountry,
              call.arrival,
              call.departure,
              finished(call) ? null : call.arrival,
              finished(call) ? null : call.departure,
              call.berth,
              call.agent,
              call.gt,
              call.length,
              call.flag,
              call.sourceStatus,
              call.pax.disembark,
              call.pax.embark,
              call.pax.transit,
              origin,
              SOURCE_NAME,
              SOURCE_URL,
              sourceUpdatedAt || null,
              at,
              at,
              at,
            );
          stats.created++;
          continue;
        }
        const before = toCall(row);
        // A figure the source once declared is never replaced by «not declared».
        const pax = {
          disembark: call.pax.disembark ?? before.pax.disembark,
          embark: call.pax.embark ?? before.pax.embark,
          transit: call.pax.transit ?? before.pax.transit,
        };
        const after = { ...call, pax };
        let changes = callChanges(before, after);
        // Real times of a finished call are not a «schedule change»: the plan stays apart.
        if (finished(call))
          changes = changes.filter(
            (c) => c.field !== "Llegada" && c.field !== "Salida",
          );
        const restored = before.withdrawn;
        const same =
          !restored &&
          !changes.length &&
          before.arrival === call.arrival &&
          before.departure === call.departure &&
          before.agent === call.agent &&
          before.ship === call.ship;
        if (same) {
          this.db
            .prepare(
              "UPDATE calls SET last_verified_at=?, source_updated_at=COALESCE(?,source_updated_at) WHERE id=?",
            )
            .run(at, sourceUpdatedAt || null, call.id);
          stats.unchanged++;
          continue;
        }
        for (const c of changes)
          addChange.run(
            call.id,
            at,
            c.field,
            c.before,
            c.after,
            "Actualización de la fuente",
          );
        if (restored) {
          addChange.run(
            call.id,
            at,
            "Estado",
            "Retirada de la previsión",
            call.sourceStatus,
            "Vuelve a aparecer en la previsión",
          );
          stats.restored++;
        }
        this.db
          .prepare(
            `UPDATE calls SET ship_key=?, imo=?, ship=?, from_port=?, from_country=?, to_port=?,
             to_country=?, arrival=?, departure=?,
             scheduled_arrival=CASE WHEN ? THEN scheduled_arrival ELSE ? END,
             scheduled_departure=CASE WHEN ? THEN scheduled_departure ELSE ? END,
             berth=?, agent=?, gt=COALESCE(?,gt), length=COALESCE(?,length), flag=?,
             source_status=?, pax_disembark=?, pax_embark=?, pax_transit=?, withdrawn=0,
             withdrawn_at=NULL, origin=?, source_updated_at=COALESCE(?,source_updated_at),
             last_verified_at=?, updated_at=? WHERE id=?`,
          )
          .run(
            key,
            call.imo,
            call.ship,
            call.from,
            call.fromCountry,
            call.to,
            call.toCountry,
            call.arrival,
            call.departure,
            finished(call) ? 1 : 0,
            call.arrival,
            finished(call) ? 1 : 0,
            call.departure,
            call.berth,
            call.agent,
            call.gt,
            call.length,
            call.flag,
            call.sourceStatus,
            pax.disembark,
            pax.embark,
            pax.transit,
            origin,
            sourceUpdatedAt || null,
            at,
            at,
            call.id,
          );
        stats.updated++;
      }
      if (origin === "forecast" && calls.length && nowWall) {
        const seen = new Set(calls.map((c) => c.id));
        const future = this.db
          .prepare(
            "SELECT id, source_status FROM calls WHERE withdrawn=0 AND arrival>? AND origin='forecast'",
          )
          .all(nowWall);
        for (const row of future) {
          if (seen.has(row.id)) continue;
          this.db
            .prepare(
              "UPDATE calls SET withdrawn=1, withdrawn_at=?, updated_at=? WHERE id=?",
            )
            .run(at, at, row.id);
          addChange.run(
            row.id,
            at,
            "Estado",
            row.source_status,
            "Retirada de la previsión",
            "Ya no aparece en la previsión del puerto",
          );
          stats.withdrawn++;
        }
      }
      this.db.exec("COMMIT");
    } catch (e) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw e;
    }
    return stats;
  }
  /** Escalas que tocan el intervalo de días [from, to] (incluye las retiradas, marcadas). */
  between(from, to) {
    return this.db
      .prepare(
        "SELECT * FROM calls WHERE arrival<? AND departure>=? ORDER BY arrival",
      )
      .all(to + "T99", from + "T00:00")
      .map(toCall);
  }
  upcoming(nowWall, limit = 1) {
    return this.db
      .prepare(
        "SELECT * FROM calls WHERE withdrawn=0 AND arrival>? ORDER BY arrival LIMIT ?",
      )
      .all(nowWall, limit)
      .map(toCall);
  }
  call(id) {
    const row = this.db.prepare("SELECT * FROM calls WHERE id=?").get(id);
    if (!row) return null;
    return {
      ...toCall(row),
      changes: this.db
        .prepare(
          "SELECT at,field,before,after,reason FROM changes WHERE call_id=? ORDER BY id DESC LIMIT 50",
        )
        .all(id),
      shipInfo: this.ship(row.ship_key),
    };
  }
  changedSince(iso) {
    return new Set(
      this.db
        .prepare("SELECT DISTINCT call_id FROM changes WHERE at>=?")
        .all(iso)
        .map((r) => r.call_id),
    );
  }
  ship(key) {
    const r = this.db.prepare("SELECT * FROM ships WHERE key=?").get(key);
    if (!r) return null;
    return {
      key: r.key,
      imo: r.imo,
      name: r.name,
      line: r.line,
      capacityStandard: r.capacity_standard,
      capacityMax: r.capacity_max,
      crew: r.crew,
      infoSource: r.info_source,
      infoAt: r.info_at,
      calls: this.db
        .prepare(
          "SELECT COUNT(*) n FROM calls WHERE ship_key=? AND withdrawn=0",
        )
        .get(key).n,
    };
  }
  ships(keys) {
    const out = {};
    for (const key of new Set(keys)) out[key] = this.ship(key);
    return out;
  }
  /** Ficha manual del barco. La fuente oficial no publica naviera ni capacidad. */
  setShipInfo(key, info, now = new Date()) {
    if (!this.db.prepare("SELECT 1 FROM ships WHERE key=?").get(key))
      throw Error("Barco desconocido.");
    this.db
      .prepare(
        "UPDATE ships SET line=?, capacity_standard=?, capacity_max=?, crew=?, info_source=?, info_at=?, updated_at=? WHERE key=?",
      )
      .run(
        info.line || null,
        info.capacityStandard ?? null,
        info.capacityMax ?? null,
        info.crew ?? null,
        info.infoSource || null,
        now.toISOString(),
        now.toISOString(),
        key,
      );
    return this.ship(key);
  }
  search({
    q = "",
    status = "",
    from = "",
    to = "",
    limit = 100,
    offset = 0,
  } = {}) {
    const where = [];
    const args = [];
    if (q) {
      where.push(
        "(c.ship LIKE ? OR c.from_port LIKE ? OR c.to_port LIKE ? OR c.imo=? OR IFNULL(s.line,'') LIKE ?)",
      );
      const like = "%" + q.replace(/[%_]/g, " ") + "%";
      args.push(like, like, like, q, like);
    }
    if (status === "withdrawn") where.push("c.withdrawn=1");
    else if (status) {
      where.push("c.withdrawn=0 AND c.source_status LIKE ?");
      args.push(status + "%");
    }
    if (from) {
      where.push("c.departure>=?");
      args.push(from + "T00:00");
    }
    if (to) {
      where.push("c.arrival<?");
      args.push(to + "T99");
    }
    const sql = ` FROM calls c JOIN ships s ON s.key=c.ship_key ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
    return {
      total: this.db.prepare("SELECT COUNT(*) n" + sql).get(...args).n,
      items: this.db
        .prepare(
          "SELECT c.*" + sql + " ORDER BY c.arrival DESC LIMIT ? OFFSET ?",
        )
        .all(...args, Math.min(500, Math.max(1, limit)), Math.max(0, offset))
        .map(toCall),
    };
  }
  totals() {
    const r = this.db
      .prepare(
        "SELECT COUNT(*) n, MIN(arrival) first, MAX(arrival) last FROM calls WHERE withdrawn=0",
      )
      .get();
    return {
      calls: r.n,
      first: r.first,
      last: r.last,
      ships: this.db.prepare("SELECT COUNT(*) n FROM ships").get().n,
    };
  }
  logSync(s) {
    this.db
      .prepare(
        `INSERT INTO syncs(kind,started_at,duration_ms,rows,fetched,created,updated,unchanged,
         rejected,withdrawn,restored,error,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        s.kind,
        s.startedAt,
        s.durationMs,
        s.rows || 0,
        s.fetched || 0,
        s.created || 0,
        s.updated || 0,
        s.unchanged || 0,
        s.rejected || 0,
        s.withdrawn || 0,
        s.restored || 0,
        s.error || "",
        (s.notes || []).join(" · ").slice(0, 2000),
      );
    // Observability without hoarding: the last 200 runs are plenty.
    this.db.exec(
      "DELETE FROM syncs WHERE id NOT IN (SELECT id FROM syncs ORDER BY id DESC LIMIT 200)",
    );
  }
  lastSyncs(limit = 10) {
    return this.db
      .prepare("SELECT * FROM syncs ORDER BY id DESC LIMIT ?")
      .all(limit);
  }
}

module.exports = { CruiseRepository };
