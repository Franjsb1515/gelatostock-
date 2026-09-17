const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CruiseRegistry,
  parseCalls,
  parseStamp,
  passengers,
  daySummary,
  aboard,
  localDay,
} = require("../src/cruises.cjs");
const { createApp } = require("../src/server.cjs");

// One row of the port's public grid, in its real column order (38 columns).
function row({
  type = "7",
  typeName = "Cruceros turísticos",
  ship = "MSC GRANDIOSA",
  from = "CIVITAVECCHIA",
  to = "BARCELONA",
  arrival = "18/09/2026 08:00",
  departure = "18/09/2026 21:00",
  call = 1100,
  berth = "AMPLIACION MUELLE PONIENTE NORTE",
  ops = "Trasbordo",
  qty = "5000",
  port = "Palma",
  codatr = 1,
} = {}) {
  return {
    id: `80|P|P|2026|${call}|${codatr}`,
    cell: [
      "80",
      "80",
      "P",
      2026,
      codatr,
      "P",
      type,
      typeName,
      "9803613",
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
      "Concedido",
    ],
  };
}
const dayStamp = (offset, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${hour}`;
};
const tmp = (name) => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, name));
};

test("cruceros: fechas del puerto y pasajeros por operación", () => {
  assert.equal(parseStamp("18/09/2026 04:00"), "2026-09-18T04:00");
  assert.equal(parseStamp("mañana"), "");
  assert.deepEqual(
    passengers("Desembarque<br/>Embarque<br/>Trasbordo", "1913<br/>2073<br/>5"),
    { disembark: 1913, embark: 2073, transit: 5 },
  );
  assert.deepEqual(passengers("Trasbordo", "no-es-número"), {
    disembark: 0,
    embark: 0,
    transit: 0,
  });
});

test("cruceros: solo cruceros de Palma, una escala por barco y sin HTML", () => {
  const calls = parseCalls({
    rows: [
      row(),
      row({ codatr: 2, departure: "18/09/2026 23:00" }),
      row({ type: "8", typeName: "Ferrys", ship: "CIUDAD DE PALMA", call: 2 }),
      row({ ship: "AIDA", call: 3, port: "Eivissa" }),
      row({ ship: "<img src=x onerror=alert(1)>COSTA", call: 4 }),
      row({ ship: "ROTO", call: 5, arrival: "sin fecha" }),
      { cell: ["corta"] },
    ],
  });
  assert.equal(calls.length, 2);
  const msc = calls.find((c) => c.ship === "MSC GRANDIOSA");
  assert.equal(msc.departure, "2026-09-18T23:00");
  assert.equal(msc.from, "Civitavecchia");
  assert.equal(msc.to, "Barcelona");
  assert.equal(aboard(msc), 5000);
  assert.ok(!calls.some((c) => c.ship.includes("<")));
  const day = daySummary(calls, "2026-09-18");
  assert.equal(day.arrivals.length, 2);
  assert.equal(day.departures.length, 2);
  assert.equal(day.passengers, 10000);
  assert.equal(daySummary(calls, "2026-09-19").inPort.length, 0);
  assert.deepEqual(parseCalls(null), []);
});

test("cruceros: el registro conserva el pasado, sigue la previsión y aguanta sin internet", async () => {
  const dir = tmp("cruises-");
  try {
    let payload = {
      rows: [
        row({
          ship: "AYER",
          call: 10,
          arrival: dayStamp(-1, "08:00"),
          departure: dayStamp(-1, "20:00"),
        }),
        row({
          ship: "HOY",
          call: 11,
          arrival: dayStamp(0, "07:00"),
          departure: dayStamp(0, "19:00"),
        }),
        row({
          ship: "ANULADO",
          call: 12,
          arrival: dayStamp(3, "07:00"),
          departure: dayStamp(3, "19:00"),
        }),
      ],
    };
    const registry = new CruiseRegistry(dir, { fetcher: async () => payload });
    await registry.refresh();
    assert.equal(registry.calls().length, 3);
    assert.equal(registry.today().inPort, 1);
    assert.deepEqual(registry.today().ships, ["HOY"]);
    // The port drops yesterday's call and cancels a future one.
    payload = { rows: [payload.rows[1]] };
    await registry.refresh();
    assert.deepEqual(
      registry.calls().map((c) => c.ship),
      ["AYER", "HOY"],
    );
    // No connection: the error is visible and the saved registry stays.
    const offline = new CruiseRegistry(dir, {
      fetcher: async () => {
        throw Object.assign(Error("fetch failed"), {
          cause: { code: "ENOTFOUND" },
        });
      },
    });
    assert.equal(offline.calls().length, 2);
    const view = await offline.refresh();
    assert.match(view.error, /Sin conexión/);
    assert.equal(view.calls.length, 2);
    assert.equal(offline.stale(6), false);
    assert.equal(localDay(new Date(2026, 8, 5)), "2026-09-05");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cruceros: rutas del servidor con origen de datos, interruptor y sin red en pruebas", async () => {
  const dir = tmp("cruises-http-");
  let app;
  let fetched = 0;
  try {
    app = await createApp({
      dataDir: dir,
      cruiseFetcher: async () => {
        fetched++;
        return {
          rows: [
            row({
              ship: "HOY",
              call: 11,
              arrival: dayStamp(0, "07:00"),
              departure: dayStamp(0, "19:00"),
            }),
          ],
        };
      },
    });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    };
    const post = (url, body) =>
      fetch(origin + url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    assert.equal((await fetch(origin + "/api/cruises")).status, 403);
    let view = await (await fetch(origin + "/api/cruises", { headers })).json();
    assert.equal(view.enabled, true);
    assert.equal(view.calls.length, 0);
    assert.equal(fetched, 0, "nada sale a la red sin pedirlo");
    assert.equal(await post("/api/cruises", {}).then((r) => r.status), 200);
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
    view = await (await fetch(origin + "/api/cruises", { headers })).json();
    assert.equal(view.calls.length, 1);
    assert.equal(view.source, "Autoridad Portuaria de Baleares");
    let state = await (await fetch(origin + "/api/state", { headers })).json();
    assert.equal(state.cruises.today.inPort, 1);
    assert.equal(state.cruises.today.passengers, 5000);
    // Switch off: no query, no summary.
    const off = await (
      await post("/api/maintenance", { type: "cruises", enabled: false })
    ).json();
    assert.equal(off.cruises.enabled, false);
    assert.equal(off.cruises.today, null);
    const refused = await post("/api/cruises", {});
    assert.equal(refused.status, 400);
    assert.equal(fetched, 1);
    const on = await (
      await post("/api/maintenance", { type: "cruises", enabled: true })
    ).json();
    assert.equal(on.cruises.enabled, true);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
