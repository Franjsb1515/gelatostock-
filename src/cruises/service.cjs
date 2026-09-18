// Servicio de cruceros: decide cuándo consultar, guarda lo validado y prepara las vistas.
// Fuente (provider-apb.cjs) → validación y cálculos (core/cruises.ts) → registro (repository.cjs).
// La interfaz solo recibe datos ya calculados, cada uno con su clase: confirmado, derivado o
// no disponible. Una fuente caída nunca rompe nada: se sirve lo último guardado y se dice.
const {
  parseApbPayload,
  parseStamp,
  daySummary,
  dayTimeline,
  dayBars,
  callsOnDay,
  declaredPassengers,
  callType,
  callTypeLabels,
  callStatus,
  statusLabels,
  stayMinutes,
  impactLabels,
  integrityIssues,
  syncIntervalHours,
  backoffMinutes,
  portToday,
  portNow,
  addDays,
  defaultThresholds,
  SOURCE_NAME,
  SOURCE_URL,
} = require("../../build/cruises.js");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { CruiseRepository } = require("./repository.cjs");
const { ApbProvider } = require("./provider-apb.cjs");

const HISTORY_PAGE = 1000;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

class CruiseService {
  constructor(
    dataDir,
    {
      provider = new ApbProvider(),
      log = () => {},
      thresholds = () => defaultThresholds,
      clock = () => new Date(),
      historyPauseMs = 4000,
    } = {},
  ) {
    this.repo = new CruiseRepository(dataDir);
    this.provider = provider;
    this.log = log;
    this.thresholds = thresholds;
    this.clock = clock;
    this.historyPauseMs = historyPauseMs;
    this.busy = null;
    this.backfilling = false;
    this.stopped = false;
  }
  close() {
    this.stopped = true;
    this.repo.close();
  }

  // ---------- Sincronización ----------
  /** ¿Toca consultar? Respeta el intervalo según la cercanía de barcos y la espera tras fallos. */
  due() {
    if (this.busy) return false;
    const now = this.clock().getTime();
    const failures = Number(this.repo.meta("failures", "0"));
    const lastAttempt = Date.parse(this.repo.meta("last_attempt", "")) || 0;
    const lastOk = Date.parse(this.repo.meta("last_ok", "")) || 0;
    if (failures > 0)
      return now - lastAttempt >= backoffMinutes(failures) * 60000;
    return now - lastOk >= this.intervalHours() * 3600000;
  }
  intervalHours() {
    const today = portToday(this.clock());
    return syncIntervalHours(
      this.repo.between(today, addDays(today, 8)),
      today,
    );
  }
  sync(kind = "auto") {
    if (this.busy) return this.busy;
    this.busy = this.run(kind)
      .finally(() => {
        this.busy = null;
      })
      .then(() => this.status());
    return this.busy;
  }
  async run(kind) {
    const started = this.clock();
    const entry = { kind, startedAt: started.toISOString(), notes: [] };
    this.repo.setMeta("last_attempt", entry.startedAt);
    try {
      const { payload, sourceUpdatedAt, cookie } =
        await this.provider.forecast();
      const parsed = parseApbPayload(payload);
      if (!parsed.rows) throw Error("El puerto devolvió una previsión vacía.");
      const stamp = parseStamp(sourceUpdatedAt);
      const stats = this.repo.apply(parsed.calls, {
        origin: "forecast",
        now: this.clock(),
        nowWall: portNow(this.clock()),
        sourceUpdatedAt: stamp,
      });
      Object.assign(entry, stats, {
        rows: parsed.rows,
        fetched: parsed.calls.length,
        rejected: parsed.rejected.length,
      });
      entry.notes.push(...parsed.rejected.slice(0, 5));
      // Recently finished calls: real times and final passenger figures.
      try {
        const recent = parseApbPayload(
          await this.provider.history({ page: 1, rows: 60, cookie }),
        );
        const h = this.repo.apply(recent.calls, {
          origin: "history",
          now: this.clock(),
        });
        entry.created += h.created;
        entry.updated += h.updated;
        entry.rejected += recent.rejected.length;
        entry.notes.push(`histórico reciente: ${recent.calls.length}`);
      } catch (e) {
        entry.notes.push(
          "histórico reciente no disponible: " +
            String(e?.message || e).slice(0, 120),
        );
      }
      const today = portToday(this.clock());
      const issues = integrityIssues(
        this.repo.between(addDays(today, -7), addDays(today, 120)),
      );
      if (issues.length)
        entry.notes.push("integridad: " + issues.slice(0, 5).join("; "));
      this.repo.setMeta("integrity", JSON.stringify(issues.slice(0, 20)));
      this.repo.setMeta("last_ok", this.clock().toISOString());
      this.repo.setMeta("failures", "0");
      this.repo.setMeta("last_error", "");
      if (stamp) this.repo.setMeta("source_updated_at", stamp);
    } catch (e) {
      const network = e?.name === "TimeoutError" || e?.cause?.code;
      entry.error = network
        ? "Sin conexión con el puerto."
        : String(e?.message || e).slice(0, 200);
      this.repo.setMeta(
        "failures",
        String(Number(this.repo.meta("failures", "0")) + 1),
      );
      this.repo.setMeta("last_error", entry.error);
    }
    entry.durationMs = this.clock().getTime() - started.getTime();
    this.repo.logSync(entry);
    this.log(
      `cruceros ${kind}: ${entry.error || `${entry.fetched} escalas (${entry.created} nuevas, ${entry.updated} cambiadas, ${entry.withdrawn} retiradas, ${entry.rejected} rechazadas)`} en ${entry.durationMs} ms`,
    );
  }
  /**
   * Importa una sola vez el histórico oficial de cruceros en Palma (desde 2014), por páginas y con
   * pausas. Se puede interrumpir: continúa por la página siguiente en la próxima ocasión.
   */
  async backfill() {
    if (this.backfilling || this.repo.meta("history_done") === "1") return;
    this.backfilling = true;
    try {
      let page = Number(this.repo.meta("history_page", "1"));
      let cookie;
      for (let guard = 0; guard < 40 && !this.stopped; guard++) {
        const started = this.clock();
        cookie = cookie || (await this.provider.session?.());
        const payload = await this.provider.history({
          page,
          rows: HISTORY_PAGE,
          cookie,
        });
        const parsed = parseApbPayload(payload);
        const stats = this.repo.apply(parsed.calls, {
          origin: "history",
          now: this.clock(),
        });
        this.repo.logSync({
          kind: "histórico",
          startedAt: started.toISOString(),
          durationMs: this.clock().getTime() - started.getTime(),
          rows: parsed.rows,
          fetched: parsed.calls.length,
          rejected: parsed.rejected.length,
          ...stats,
          notes: [
            `página ${page} de ${payload?.total ?? "?"}`,
            ...parsed.rejected.slice(0, 3),
          ],
        });
        this.repo.setMeta("history_total", String(payload?.records ?? ""));
        const pages = Number(payload?.total) || 0;
        if (!parsed.rows || page >= pages) {
          this.repo.setMeta("history_done", "1");
          this.log("cruceros: histórico importado por completo");
          break;
        }
        page++;
        this.repo.setMeta("history_page", String(page));
        await new Promise((r) => setTimeout(r, this.historyPauseMs));
      }
    } catch (e) {
      this.log(
        "cruceros: histórico interrumpido: " +
          String(e?.message || e).slice(0, 160),
      );
    } finally {
      this.backfilling = false;
    }
  }
  /** Llamado por el temporizador: consulta si toca y, con datos ya guardados, trae el histórico. */
  async tick() {
    if (this.due()) await this.sync("auto");
    if (this.repo.meta("last_ok") && this.repo.meta("history_done") !== "1")
      this.backfill().catch(() => {});
  }

  // ---------- Estado de los datos ----------
  status() {
    const lastOk = this.repo.meta("last_ok");
    const error = this.repo.meta("last_error");
    const interval = this.intervalHours();
    const age = lastOk
      ? (this.clock().getTime() - Date.parse(lastOk)) / 3600000
      : Infinity;
    const state = this.busy
      ? "syncing"
      : !lastOk
        ? error
          ? "error"
          : "never"
        : error
          ? "error"
          : age > Math.max(2 * interval, 13)
            ? "stale"
            : "fresh";
    return {
      state,
      label: {
        syncing: "Actualizando…",
        never: "Información pendiente de sincronización",
        error: "Error de sincronización",
        stale: "Datos posiblemente desactualizados",
        fresh: "Datos actualizados",
      }[state],
      error,
      updatedAt: lastOk || null,
      sourceUpdatedAt: this.repo.meta("source_updated_at") || null,
      intervalHours: interval,
      source: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      totals: this.repo.totals(),
      history: {
        done: this.repo.meta("history_done") === "1",
        running: this.backfilling,
        page: Number(this.repo.meta("history_page", "1")),
        records: Number(this.repo.meta("history_total", "0")) || null,
      },
      integrity: JSON.parse(this.repo.meta("integrity", "[]")),
    };
  }

  // ---------- Vistas ----------
  /** Una escala con sus datos derivados y la clase de cada uno. */
  present(call, ships, modified, nowWall) {
    const declared = declaredPassengers(call.pax);
    const type = callType(call.pax);
    const status = callStatus(call, nowWall);
    const info = ships[call.shipKey] || null;
    return {
      ...call,
      declared, // DERIVADO (null = no disponible)
      type,
      typeLabel: type ? callTypeLabels[type] : null,
      status,
      statusLabel: statusLabels[status],
      stayMinutes: stayMinutes(call), // DERIVADO
      modified: modified.has(call.id),
      line: info?.line || null, // manual, con su fuente
      capacityStandard: info?.capacityStandard ?? null,
      capacityMax: info?.capacityMax ?? null,
      infoSource: info?.infoSource || null,
    };
  }
  summarize(calls, day) {
    const s = daySummary(calls, day, this.thresholds());
    return { ...s, impactLabel: impactLabels[s.impact] };
  }
  /** Resumen por día de un intervalo (calendario, próximos 7 y 30 días). */
  range(from, to) {
    if (!dayPattern.test(from) || !dayPattern.test(to) || to < from)
      throw Error("Intervalo inválido.");
    if (addDays(from, 100) < to) throw Error("Intervalo demasiado largo.");
    const calls = this.repo.between(addDays(from, -1), addDays(to, 1));
    const days = [];
    for (let day = from; day <= to; day = addDays(day, 1))
      days.push(this.summarize(calls, day));
    return { from, to, days };
  }
  /** Detalle de un día: resumen, tarjetas, línea temporal y barras. */
  day(day) {
    if (!dayPattern.test(day)) throw Error("Día inválido.");
    const calls = this.repo.between(addDays(day, -1), addDays(day, 1));
    const nowWall = portNow(this.clock());
    const modified = this.repo.changedSince(
      new Date(this.clock().getTime() - 7 * 86400000).toISOString(),
    );
    const onDay = callsOnDay(calls, day);
    const withdrawn = calls.filter(
      (c) =>
        c.withdrawn &&
        c.arrival.slice(0, 10) <= day &&
        c.departure.slice(0, 10) >= day,
    );
    const ships = this.repo.ships(
      [...onDay, ...withdrawn].map((c) => c.shipKey),
    );
    return {
      summary: this.summarize(calls, day),
      calls: onDay.map((c) => this.present(c, ships, modified, nowWall)),
      withdrawn: withdrawn.map((c) =>
        this.present(c, ships, modified, nowWall),
      ),
      timeline: dayTimeline(calls, day),
      bars: dayBars(calls, day),
    };
  }
  /** Panel de entrada: hoy, mañana, próxima llegada y estado de los datos. */
  dashboard() {
    const today = portToday(this.clock());
    const nowWall = portNow(this.clock());
    const calls = this.repo.between(addDays(today, -1), addDays(today, 2));
    const next = this.repo.upcoming(nowWall, 1)[0] || null;
    return {
      today,
      now: nowWall,
      thresholds: this.thresholds(),
      todaySummary: this.summarize(calls, today),
      tomorrowSummary: this.summarize(calls, addDays(today, 1)),
      inPortNow: calls
        .filter(
          (c) => !c.withdrawn && c.arrival <= nowWall && c.departure > nowWall,
        )
        .map((c) => c.ship),
      nextArrival: next
        ? { ship: next.ship, arrival: next.arrival, from: next.from }
        : null,
      status: this.status(),
    };
  }
  call(id) {
    const call = this.repo.call(id);
    if (!call) return null;
    const nowWall = portNow(this.clock());
    return {
      ...this.present(
        call,
        { [call.shipKey]: call.shipInfo },
        new Set(),
        nowWall,
      ),
      changes: call.changes,
      shipInfo: call.shipInfo,
    };
  }
  search(query) {
    const nowWall = portNow(this.clock());
    const found = this.repo.search(query);
    const ships = this.repo.ships(found.items.map((c) => c.shipKey));
    return {
      total: found.total,
      items: found.items.map((c) => this.present(c, ships, new Set(), nowWall)),
    };
  }
  /** Resumen mínimo para Resumen y para la página Semana. */
  brief(day) {
    const calls = this.repo.between(addDays(day, -1), addDays(day, 1));
    const s = this.summarize(calls, day);
    return {
      day,
      ships: s.ships,
      passengers: s.passengers,
      peakPassengers: s.peakPassengers,
      impact: s.impact,
      impactLabel: s.impactLabel,
      names: callsOnDay(calls, day).map((c) => c.ship),
      firstArrival: s.firstArrival,
      lastDeparture: s.lastDeparture,
    };
  }
  /** Qué hay en la copia diaria del registro (o null si no existe o no se puede leer). */
  copyInfo(backupDir) {
    const file = path.join(backupDir, "cruceros-copia.sqlite");
    if (!fs.existsSync(file)) return null;
    try {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        return {
          file,
          modifiedAt: fs.statSync(file).mtime.toISOString(),
          calls: db.prepare("SELECT COUNT(*) n FROM calls").get().n,
          ships: db.prepare("SELECT COUNT(*) n FROM ships").get().n,
        };
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  }
  /** Sustituye el registro por la copia. El registro actual queda guardado al lado, nunca se pierde. */
  restoreCopy(backupDir) {
    if (this.busy || this.backfilling)
      throw Error("Hay una sincronización en curso. Espera a que termine.");
    const info = this.copyInfo(backupDir);
    if (!info)
      throw Error("No hay una copia legible del registro de cruceros.");
    if (!info.calls) throw Error("La copia está vacía: no se restaura.");
    const current = this.repo.file;
    this.repo.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    this.repo.close();
    try {
      fs.copyFileSync(
        current,
        current.replace(/\.sqlite$/, "-antes-de-restaurar.sqlite"),
      );
      for (const extra of ["-wal", "-shm"])
        fs.rmSync(current + extra, { force: true });
      fs.copyFileSync(info.file, current);
    } finally {
      this.repo = new CruiseRepository(path.dirname(current));
    }
    this.log(
      "cruceros: registro restaurado desde la copia (" +
        info.calls +
        " escalas)",
    );
    return info;
  }
  setShipInfo(key, input) {
    const int = (v, max) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0 || n > max)
        throw Error("Cifra fuera de rango.");
      return n;
    };
    const text = (v, max) =>
      String(v ?? "")
        .replace(/\p{Cc}/gu, " ")
        .trim()
        .slice(0, max);
    const info = {
      line: text(input.line, 80),
      capacityStandard: int(input.capacityStandard, 12000),
      capacityMax: int(input.capacityMax, 12000),
      crew: int(input.crew, 5000),
      infoSource: text(input.infoSource, 120),
    };
    const any =
      info.line || info.capacityStandard || info.capacityMax || info.crew;
    if (any && !info.infoSource)
      throw Error(
        "Indica de dónde sale el dato (fuente): sin fuente no se guarda.",
      );
    if (
      info.capacityStandard &&
      info.capacityMax &&
      info.capacityMax < info.capacityStandard
    )
      throw Error("La capacidad máxima no puede ser menor que la habitual.");
    return this.repo.setShipInfo(key, info, this.clock());
  }
}

module.exports = { CruiseService };
