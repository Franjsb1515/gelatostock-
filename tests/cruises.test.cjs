const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = require("../build/cruises.js");
const { CruiseService } = require("../src/cruises/service.cjs");
const { createApp } = require("../src/server.cjs");

// Una fila de la rejilla pública del puerto, en su orden real de columnas (38).
function row({
  type = "7",
  typeName = "Cruceros turísticos",
  ship = "MSC GRANDIOSA",
  imo = "9803613",
  from = "CIVITAVECCHIA",
  to = "BARCELONA",
  arrival = "18/09/2026 08:00",
  departure = "18/09/2026 21:00",
  call = 1100,
  year = 2026,
  berth = "AMPLIACION MUELLE PONIENTE NORTE",
  ops = "Trasbordo",
  qty = "5000",
  port = "Palma",
  codatr = 1,
  status = "Concedido",
} = {}) {
  return {
    id: `80|P|P|${year}|${call}|${codatr}`,
    cell: [
      "80",
      "80",
      "P",
      year,
      codatr,
      "P",
      type,
      typeName,
      imo,
      ship,
      "ITALIA",
      "ESPAÑA",
      from,
      to,
      arrival,
      departure,
      "P120",
      berth,
      "CONSIGNATARIA SA",
      181541,
      call,
      "MALTA",
      331,
      8.75,
      "C",
      "C",
      "",
      46,
      15,
      50,
      ops,
      "Pasajeros",
      qty,
      "TERMINAL",
      "0",
      "Sí",
      port,
      status,
    ],
  };
}
const calls = (...rows) => c.parseApbPayload({ rows }).calls;
const tmp = (name) => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, name));
};
// Fuente simulada: devuelve lo que diga la prueba y cuenta las consultas.
function fakeProvider(state) {
  return {
    hits: 0,
    async session() {
      return "c=1";
    },
    async forecast() {
      this.hits++;
      if (state.fail) throw state.fail;
      return {
        payload: state.forecast,
        sourceUpdatedAt: "18/09/2026 00:30",
        cookie: "c=1",
      };
    },
    async history() {
      return state.history || { total: 1, records: 0, rows: [] };
    },
  };
}
const stamp = (day, time) =>
  `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)} ${time}`;

test("cruceros: la hora es siempre la de Palma, con verano, invierno y cambios de hora", () => {
  assert.equal(c.parseStamp("18/09/2026 04:00"), "2026-09-18T04:00");
  assert.equal(c.parseStamp("31/02/2026 04:00"), "", "fecha que no existe");
  assert.equal(c.parseStamp("18/09/2026 25:00"), "");
  assert.equal(c.parseStamp("mañana"), "");
  // Verano UTC+2, invierno UTC+1: nunca se toma UTC por hora local.
  assert.equal(
    new Date(c.instantFromWall("2026-09-18T04:00")).toISOString(),
    "2026-09-18T02:00:00.000Z",
  );
  assert.equal(
    new Date(c.instantFromWall("2026-12-18T04:00")).toISOString(),
    "2026-12-18T03:00:00.000Z",
  );
  assert.equal(
    c.wallFromInstant(Date.parse("2026-09-17T22:30:00Z")),
    "2026-09-18T00:30",
  );
  assert.equal(
    c.portToday(new Date("2026-09-17T22:30:00Z")),
    "2026-09-18",
    "hoy es el día de Palma, no el del equipo",
  );
  // Noche del cambio de octubre (una hora más) y de marzo (una hora menos).
  assert.equal(
    c.stayMinutes({
      arrival: "2026-10-24T22:00",
      departure: "2026-10-25T06:00",
    }),
    540,
  );
  assert.equal(
    c.stayMinutes({
      arrival: "2026-03-28T22:00",
      departure: "2026-03-29T06:00",
    }),
    420,
  );
  assert.equal(c.addDays("2026-12-31", 1), "2027-01-01");
});

test("cruceros: pasajeros declarados, sin confundir «cero» con «no disponible»", () => {
  assert.deepEqual(
    c.parsePassengers(
      "Desembarque<br/>Embarque<br/>Trasbordo",
      "1913<br/>2073<br/>5",
    ),
    {
      disembark: 1913,
      embark: 2073,
      transit: 5,
    },
  );
  const nothing = c.parsePassengers("", "");
  assert.deepEqual(nothing, { disembark: null, embark: null, transit: null });
  assert.equal(c.declaredPassengers(nothing), null);
  assert.equal(c.callType(nothing), null);
  assert.equal(c.declaredPassengers(c.parsePassengers("Desembarque", "0")), 0);
  assert.deepEqual(
    c.parsePassengers("Trasbordo", "999999"),
    nothing,
    "cifra absurda: se descarta",
  );
  assert.deepEqual(c.parsePassengers("Trasbordo", "-4"), nothing);
  assert.deepEqual(c.parsePassengers("Trasbordo", "muchos"), nothing);
  assert.equal(
    c.declaredPassengers({ disembark: 1913, embark: 2073, transit: 5 }),
    2078,
  );
  assert.equal(
    c.callType({ disembark: null, embark: null, transit: 5000 }),
    "transit",
  );
  assert.equal(
    c.callType({ disembark: 1400, embark: 1500, transit: null }),
    "turnaround",
  );
  assert.equal(c.callType({ disembark: 7, embark: 1, transit: 599 }), "mixed");
});

test("cruceros: la respuesta externa se valida; la basura no entra", () => {
  const parsed = c.parseApbPayload({
    rows: [
      row(),
      row({ codatr: 2, departure: "18/09/2026 23:00", berth: "OTRO MUELLE" }),
      row({ type: "8", typeName: "Ferrys", ship: "CIUDAD DE PALMA", call: 2 }),
      row({ ship: "AIDA", call: 3, port: "Alcúdia" }),
      row({
        ship: "<img src=x onerror=alert(1)>COSTA  pacifica",
        imo: "9378498",
        call: 4,
      }),
      row({ ship: "ROTO", call: 5, arrival: "sin fecha" }),
      row({
        ship: "AL REVES",
        call: 6,
        arrival: "18/09/2026 20:00",
        departure: "18/09/2026 08:00",
      }),
      row({ ship: "ETERNO", call: 7, departure: "18/12/2026 08:00" }),
      row({ ship: "", call: 8 }),
      { id: "x", cell: ["corta"] },
      null,
    ],
  });
  assert.equal(parsed.calls.length, 2);
  assert.equal(parsed.rejected.length, 6);
  assert.ok(parsed.rejected.some((r) => /fecha inválida/.test(r)));
  assert.ok(parsed.rejected.some((r) => /anterior a la llegada/.test(r)));
  assert.ok(parsed.rejected.some((r) => /más de 30 días/.test(r)));
  assert.ok(parsed.rejected.some((r) => /sin barco/.test(r)));
  const msc = parsed.calls.find((x) => x.ship === "MSC GRANDIOSA");
  assert.equal(
    msc.id,
    "P-2026-1100",
    "identificador oficial: puerto, año y número de escala",
  );
  assert.equal(
    msc.departure,
    "2026-09-18T23:00",
    "dos atraques de una escala son una escala",
  );
  assert.match(msc.berth, /PONIENTE NORTE · OTRO MUELLE/);
  assert.equal(msc.from, "Civitavecchia");
  const costa = parsed.calls.find((x) => x.imo === "9378498");
  assert.equal(
    costa.ship,
    "COSTA PACIFICA",
    "sin HTML y con el nombre normalizado",
  );
  assert.deepEqual(c.parseApbPayload(null), {
    calls: [],
    rejected: ["respuesta sin filas"],
    rows: 0,
  });
  assert.deepEqual(c.parseApbPayload({ rows: "no" }).calls, []);
});

test("cruceros: día normal, escala nocturna, simultaneidad e impacto auditable", () => {
  const normal = calls(
    row({ arrival: "18/09/2026 08:00", departure: "18/09/2026 18:00" }),
  );
  const s = c.daySummary(normal, "2026-09-18");
  assert.equal(s.ships, 1);
  assert.equal(s.firstArrival, "08:00");
  assert.equal(s.lastDeparture, "18:00");
  assert.deepEqual(
    [s.peak.ships, s.peak.from, s.peak.to],
    [1, "08:00", "18:00"],
  );
  assert.equal(c.stayMinutes(normal[0]), 600);
  // Nocturno: llega a las 22:00 y sale a las 06:00 del día siguiente.
  const night = calls(
    row({ arrival: "18/09/2026 22:00", departure: "19/09/2026 06:00" }),
  );
  assert.equal(c.daySummary(night, "2026-09-18").ships, 1);
  assert.equal(c.daySummary(night, "2026-09-18").departures, 0);
  assert.equal(c.daySummary(night, "2026-09-19").ships, 1);
  assert.equal(c.daySummary(night, "2026-09-19").arrivals, 0);
  assert.equal(c.daySummary(night, "2026-09-20").ships, 0);
  assert.deepEqual(
    c
      .dayBars(night, "2026-09-19")
      .map((b) => [b.startMinute, b.endMinute, b.startsBefore]),
    [[0, 360, true]],
  );
  assert.deepEqual(c.dayBars(night, "2026-09-18")[0].endMinute, 1440);
  // Tres barcos: 06–18, 07–16 y 09–22. El pico es de 09:00 a 16:00.
  const three = calls(
    row({
      ship: "AIDA",
      imo: "1111111",
      call: 1,
      arrival: "18/09/2026 06:00",
      departure: "18/09/2026 18:00",
      qty: "2000",
    }),
    row({
      ship: "NORWEGIAN",
      imo: "2222222",
      call: 2,
      arrival: "18/09/2026 07:00",
      departure: "18/09/2026 16:00",
      qty: "2300",
    }),
    row({
      ship: "MSC",
      imo: "3333333",
      call: 3,
      arrival: "18/09/2026 09:00",
      departure: "18/09/2026 22:00",
      qty: "5000",
    }),
  );
  const t = c.daySummary(three, "2026-09-18");
  assert.deepEqual(
    [t.peak.ships, t.peak.from, t.peak.to, t.peak.passengers],
    [3, "09:00", "16:00", 9300],
  );
  assert.deepEqual(
    [t.peakPassengers, t.peakPassengersFrom, t.peakPassengersTo],
    [9300, "09:00", "16:00"],
  );
  assert.equal(t.passengers, 9300);
  assert.equal(t.impact, "high");
  assert.equal(
    c.daySummary(three, "2026-09-18", {
      medium: 100,
      high: 200,
      veryHigh: 9000,
    }).impact,
    "veryHigh",
  );
  assert.deepEqual(
    c
      .dayTimeline(three, "2026-09-18")
      .map((x) => x.time + " " + x.ships.length),
    ["06:00 1", "07:00 2", "09:00 3", "16:00 2", "18:00 1", "22:00 0"],
  );
  // Fórmula del impacto, caso a caso.
  assert.equal(c.impactLevel(0, null), "none");
  assert.equal(c.impactLevel(2, null), "unknown");
  assert.equal(c.impactLevel(1, 2999), "low");
  assert.equal(c.impactLevel(1, 3000), "medium");
  assert.equal(c.impactLevel(1, 6000), "high");
  assert.equal(c.impactLevel(1, 10000), "veryHigh");
  // Datos faltantes: sin pasajeros, sin muelle, sin puerto anterior. Todo sigue funcionando.
  const bare = calls(row({ ops: "", qty: "", berth: "", from: "", imo: "" }));
  const b = c.daySummary(bare, "2026-09-18");
  assert.deepEqual(
    [b.ships, b.passengers, b.undeclared, b.impact],
    [1, null, 1, "unknown"],
  );
  assert.equal(bare[0].berth, "");
  assert.equal(c.daySummary([], "2026-09-18").impact, "none");
  // Una escala retirada no cuenta.
  assert.equal(
    c.daySummary([{ ...normal[0], withdrawn: true }], "2026-09-18").ships,
    0,
  );
});

test("cruceros: estados solo los que la fuente permite afirmar, e integridad", () => {
  const [call] = calls(row());
  assert.equal(c.callStatus(call), "granted");
  assert.equal(
    c.callStatus({ ...call, sourceStatus: "Solicitado" }),
    "requested",
  );
  assert.equal(c.callStatus({ ...call, sourceStatus: "Iniciado" }), "inPort");
  assert.equal(
    c.callStatus({ ...call, sourceStatus: "Finalizado" }, "2026-09-20T00:00"),
    "finished",
  );
  assert.equal(
    c.callStatus(call, "2026-09-20T00:00"),
    "past",
    "derivado y dicho como tal",
  );
  assert.equal(c.callStatus({ ...call, withdrawn: true }), "withdrawn");
  assert.equal(c.callStatus({ ...call, sourceStatus: "Otro" }), "pending");
  assert.deepEqual(
    c.integrityIssues(
      calls(row(), row({ ship: "OTRO", imo: "1234567", call: 9 })),
    ),
    [],
  );
  const dup = c.integrityIssues(calls(row(), row({ call: 1101 })));
  assert.equal(dup.length, 1);
  assert.match(dup[0], /se solapan/);
  assert.equal(c.syncIntervalHours(calls(row()), "2026-09-18"), 3);
  assert.equal(c.syncIntervalHours(calls(row()), "2026-09-13"), 6);
  assert.equal(c.syncIntervalHours(calls(row()), "2026-08-01"), 12);
  assert.equal(c.syncIntervalHours([], "2026-09-18"), 12);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 9].map(c.backoffMinutes),
    [0, 5, 15, 60, 180, 180],
  );
});

test("cruceros: cambios y retiradas actualizan la escala, sin duplicados ni pérdida de histórico", async () => {
  const dir = tmp("cruises-");
  const state = {};
  let now = new Date("2026-09-10T08:00:00Z");
  const service = new CruiseService(dir, {
    provider: fakeProvider(state),
    clock: () => now,
  });
  try {
    assert.equal(service.status().state, "never");
    assert.equal(service.due(), true);
    state.forecast = {
      rows: [
        row({ call: 1 }),
        row({
          ship: "SIRENA",
          imo: "9187899",
          call: 2,
          arrival: "20/09/2026 07:00",
          departure: "20/09/2026 15:00",
          qty: "600",
        }),
        row({
          ship: "AYER",
          imo: "7654321",
          call: 3,
          arrival: "09/09/2026 08:00",
          departure: "09/09/2026 20:00",
          status: "Iniciado",
        }),
      ],
    };
    let status = await service.sync("manual");
    assert.equal(status.state, "fresh");
    assert.equal(status.totals.calls, 3);
    assert.equal(status.sourceUpdatedAt, "2026-09-18T00:30");
    assert.equal(service.due(), false, "recién consultado: no se insiste");
    // Cambio de horario y de escritura del nombre; SIRENA desaparece; la de ayer ya no se publica.
    now = new Date("2026-09-10T12:00:00Z");
    state.forecast = {
      rows: [
        row({
          call: 1,
          ship: "Msc  Grandiosa",
          arrival: "18/09/2026 10:00",
          ops: "",
          qty: "",
        }),
      ],
    };
    status = await service.sync("manual");
    assert.equal(
      status.totals.calls,
      2,
      "SIRENA retirada; la escala pasada se conserva",
    );
    assert.equal(
      status.totals.ships,
      3,
      "mismo IMO con otro nombre: sigue siendo un barco",
    );
    const changed = service.call("P-2026-1");
    assert.equal(changed.arrival, "2026-09-18T10:00");
    assert.equal(
      changed.declared,
      5000,
      "un dato declarado no se pierde porque la fuente lo omita después",
    );
    assert.deepEqual(
      changed.changes.map((x) => [x.field, x.before, x.after]),
      [["Llegada", "2026-09-18T08:00", "2026-09-18T10:00"]],
    );
    const gone = service.call("P-2026-2");
    assert.equal(gone.status, "withdrawn");
    assert.equal(gone.statusLabel, "Retirada de la previsión");
    assert.equal(service.day("2026-09-20").summary.ships, 0);
    assert.equal(service.day("2026-09-20").withdrawn.length, 1);
    assert.equal(service.day("2026-09-18").calls[0].modified, true);
    assert.equal(service.call("P-2026-3").status, "past");
    // Vuelve a aparecer: se restaura la misma fila.
    state.forecast.rows.push(
      row({
        ship: "SIRENA",
        imo: "9187899",
        call: 2,
        arrival: "20/09/2026 07:00",
        departure: "20/09/2026 15:00",
        qty: "600",
      }),
    );
    // El histórico confirma la escala de ayer con horas reales: no es un «cambio de horario».
    state.history = {
      total: 1,
      records: 1,
      rows: [
        row({
          ship: "AYER",
          imo: "7654321",
          call: 3,
          arrival: "09/09/2026 08:12",
          departure: "09/09/2026 19:48",
          status: "Finalizado",
        }),
      ],
    };
    await service.sync("manual");
    assert.equal(service.call("P-2026-2").status, "granted");
    assert.equal(service.status().totals.calls, 3);
    const done = service.call("P-2026-3");
    assert.deepEqual(
      [done.status, done.arrival, done.scheduledArrival],
      ["finished", "2026-09-09T08:12", "2026-09-09T08:00"],
    );
    assert.deepEqual(
      done.changes.map((x) => x.field),
      ["Estado"],
    );
    // Previsión vacía o basura: error visible y ni una retirada.
    state.forecast = { rows: [] };
    status = await service.sync("manual");
    assert.equal(status.state, "error");
    assert.equal(status.totals.calls, 3);
    state.forecast = "<html>mantenimiento</html>";
    await service.sync("manual");
    assert.equal(service.status().totals.calls, 3);
    // Fuente caída: error, datos intactos y espera creciente.
    state.fail = Object.assign(Error("fetch failed"), {
      cause: { code: "ENOTFOUND" },
    });
    status = await service.sync("auto");
    assert.equal(status.error, "Sin conexión con el puerto.");
    assert.equal(status.label, "Error de sincronización");
    assert.equal(service.day("2026-09-18").summary.ships, 1);
    assert.equal(
      service.due(),
      false,
      "tras fallar no se reintenta de inmediato",
    );
    now = new Date(now.getTime() + 61 * 60000);
    assert.equal(
      service.due(),
      true,
      "tres fallos: vuelve a tocar pasada una hora",
    );
    state.fail = null;
    state.forecast = { rows: [row({ call: 1, arrival: "18/09/2026 10:00" })] };
    assert.equal((await service.sync("auto")).state, "fresh");
    now = new Date(now.getTime() + 40 * 3600000);
    assert.equal(service.status().state, "stale", "datos viejos: se avisa");
    // Ficha manual del barco: sin fuente no se guarda nada.
    assert.throws(
      () => service.setShipInfo("9803613", { line: "MSC Cruises" }),
      /fuente/,
    );
    assert.throws(
      () =>
        service.setShipInfo("9803613", { capacityMax: -5, infoSource: "x" }),
      /rango/,
    );
    service.setShipInfo("9803613", {
      line: "MSC Cruises",
      capacityStandard: 4842,
      capacityMax: 6334,
      infoSource: "Ficha técnica de la naviera",
    });
    const card = service.day("2026-09-18").calls[0];
    assert.deepEqual(
      [card.line, card.capacityMax, card.infoSource],
      ["MSC Cruises", 6334, "Ficha técnica de la naviera"],
    );
    assert.equal(service.search({ q: "msc cruises" }).total, 1);
    assert.equal(
      service.search({ status: "withdrawn" }).total,
      1,
      "SIRENA falta en la última previsión: retirada otra vez, sin duplicarse",
    );
    assert.ok(service.repo.lastSyncs(20).length >= 6);
  } finally {
    service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cruceros: el histórico oficial se importa por páginas y una sola vez", async () => {
  const dir = tmp("cruises-his-");
  const pages = {
    1: {
      total: 2,
      records: 3,
      rows: [
        row({
          call: 1,
          year: 2025,
          arrival: "18/09/2025 08:00",
          departure: "18/09/2025 21:00",
          status: "Finalizado",
        }),
        row({
          call: 2,
          year: 2025,
          ship: "SIRENA",
          imo: "9187899",
          arrival: "17/09/2025 08:00",
          departure: "17/09/2025 21:00",
          status: "Finalizado",
        }),
      ],
    },
    2: {
      total: 2,
      records: 3,
      rows: [
        row({
          call: 9,
          year: 2014,
          ship: "AIDAMAR",
          imo: "9490052",
          arrival: "03/01/2014 05:25",
          departure: "03/01/2014 18:00",
          ops: "",
          qty: "",
          status: "Finalizado",
        }),
      ],
    },
  };
  const asked = [];
  const provider = {
    async session() {
      return "c=1";
    },
    async history({ page }) {
      asked.push(page);
      return pages[page];
    },
  };
  const service = new CruiseService(dir, { provider, historyPauseMs: 1 });
  try {
    await service.backfill();
    assert.deepEqual(asked, [1, 2]);
    assert.equal(service.status().history.done, true);
    assert.equal(service.status().totals.first, "2014-01-03T05:25");
    assert.equal(service.day("2014-01-03").calls[0].declared, null);
    await service.backfill();
    assert.deepEqual(asked, [1, 2], "no se vuelve a pedir");
  } finally {
    service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cruceros: rutas del servidor, permisos, umbrales e interruptor, sin red en pruebas", async () => {
  const dir = tmp("cruises-http-");
  const today = c.portToday();
  const state = {
    forecast: {
      rows: [
        row({
          ship: "HOY",
          imo: "5555555",
          call: 11,
          year: Number(today.slice(0, 4)),
          arrival: stamp(today, "07:00"),
          departure: stamp(today, "19:00"),
        }),
      ],
    },
  };
  const provider = fakeProvider(state);
  let app;
  try {
    // The day-context sources are simulated too: no test ever touches the network.
    const contextProviders = {
      weather: {
        async forecast() {
          return { notModified: true, expires: "" };
        },
      },
      holidays: {
        async calendar() {
          return { missing: true, reason: "prueba" };
        },
      },
    };
    app = await createApp({
      dataDir: dir,
      cruiseProvider: provider,
      contextProviders,
    });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    };
    const get = async (url) => (await fetch(origin + url, { headers })).json();
    const post = (url, body) =>
      fetch(origin + url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    assert.equal((await fetch(origin + "/api/cruises")).status, 403);
    assert.equal(
      (await fetch(origin + "/api/cruises/day?day=" + today)).status,
      403,
    );
    let view = await get("/api/cruises");
    assert.equal(view.enabled, true);
    assert.equal(view.status.state, "never");
    assert.equal(view.status.label, "Información pendiente de sincronización");
    assert.equal(provider.hits, 0, "nada sale a la red sin pedirlo");
    assert.equal(
      (
        await fetch(origin + "/api/cruises", {
          method: "POST",
          headers: { ...headers, Origin: "https://example.com" },
          body: "{}",
        })
      ).status,
      403,
    );
    view = await (await post("/api/cruises", { type: "sync" })).json();
    assert.equal(view.status.state, "fresh");
    assert.equal(view.status.source, "Autoridad Portuaria de Baleares");
    assert.equal(view.todaySummary.ships, 1);
    assert.equal(view.todaySummary.peakPassengers, 5000);
    assert.equal(view.todaySummary.impactLabel, "Medio");
    const day = await get("/api/cruises/day?day=" + today);
    assert.equal(day.calls[0].ship, "HOY");
    assert.equal(
      day.calls[0].line,
      null,
      "la naviera no viene de la fuente: no disponible",
    );
    assert.equal(day.calls[0].source, "Autoridad Portuaria de Baleares");
    assert.ok(day.calls[0].retrievedAt && day.calls[0].lastVerifiedAt);
    assert.equal(
      (await get(`/api/cruises/range?from=${today}&to=${c.addDays(today, 6)}`))
        .days.length,
      7,
    );
    assert.equal(
      (
        await fetch(
          origin + "/api/cruises/range?from=2026-01-01&to=2027-01-01",
          { headers },
        )
      ).status,
      400,
    );
    assert.equal(
      (await fetch(origin + "/api/cruises/day?day=../../x", { headers }))
        .status,
      400,
    );
    assert.equal(
      (await fetch(origin + "/api/cruises/call?id=nada", { headers })).status,
      404,
    );
    assert.equal((await get("/api/cruises/search?q=hoy")).total, 1);
    assert.equal((await get("/api/cruises/syncs")).syncs.length, 1);
    // Umbrales: del usuario, validados.
    assert.equal(
      (
        await post("/api/cruises", {
          type: "thresholds",
          medium: 9,
          high: 5,
          veryHigh: 20,
        })
      ).status,
      400,
    );
    view = await (
      await post("/api/cruises", {
        type: "thresholds",
        medium: 1000,
        high: 4000,
        veryHigh: 8000,
      })
    ).json();
    assert.equal(view.todaySummary.impactLabel, "Alto");
    assert.deepEqual(view.thresholds, {
      medium: 1000,
      high: 4000,
      veryHigh: 8000,
    });
    assert.equal(
      (
        await post("/api/cruises", {
          type: "ship",
          key: "5555555",
          line: "Naviera X",
        })
      ).status,
      400,
    );
    const state2 = await get("/api/state");
    assert.equal(state2.cruises.today.ships, 1);
    const report = await get("/api/report");
    assert.equal(report.cruises.length, 7);
    // Apagado: ni consulta ni resumen.
    const off = await (
      await post("/api/maintenance", { type: "cruises", enabled: false })
    ).json();
    assert.equal(off.cruises.enabled, false);
    assert.equal(off.cruises.today, null);
    assert.equal((await post("/api/cruises", { type: "sync" })).status, 400);
    assert.equal(provider.hits, 1);
    assert.equal((await get("/api/report")).cruises, null);
    assert.ok(
      fs.existsSync(path.join(dir, "backups", "cruceros-copia.sqlite")),
      "el registro de cruceros viaja con la copia diaria",
    );
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
