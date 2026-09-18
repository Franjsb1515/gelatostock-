const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const c = require("../build/context.js");
const { portToday, addDays } = require("../build/cruises.js");
const { ContextService } = require("../src/context/service.cjs");
const { CruiseService } = require("../src/cruises/service.cjs");
const { createApp } = require("../src/server.cjs");

const tmp = (name) => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, name));
};
// Una previsión con la forma de MET Norway: horas en UTC, por horas el primer día y cada 6 h después.
function metno(steps) {
  return {
    properties: {
      meta: { updated_at: "2026-09-18T13:16:59Z" },
      timeseries: steps.map(([time, temp, mm, symbol, six]) => ({
        time,
        data: {
          instant: { details: { air_temperature: temp } },
          [six ? "next_6_hours" : "next_1_hours"]: {
            summary: { symbol_code: symbol },
            details: { precipitation_amount: mm },
          },
        },
      })),
    },
  };
}
const csv = [
  "Illa,Àmbit,Municipi,Localitat,Data,Nom festa",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,1 de gener,Cap d’any",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,6 de gener,Epifania del Senyor",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,2 de març,L’endemà del Dia de les Illes Balears",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,2 d’abril,Dijous Sant",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,3 d’abril,Divendres Sant",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,1 de maig,Dia del Treball",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,15 d’agost,Assumpció de la Mare de Déu",
  "Illes Balears,Autonòmic,Illes Balears,Illes Balears,25 de desembre,Dia de Nadal",
  "Mallorca,Local,Bunyola,Palmanyola,20 de gener,Sant Sebastià",
  "Mallorca,Local,Palma,Palma,20 de gener,Sant Sebastià",
  'Mallorca,Local,Palma,Palma,24 de juny,"Sant Joan, patró"',
  "Mallorca,Local,Alcúdia,Alcúdia,25 de juliol,Sant Jaume",
  "Mallorca,Local,Palma,Palma,31 de febrer,Dia impossible",
  "Mallorca,Local,Palma,Palma,algun dia,Sense data",
].join("\r\n");

test("contexto: la previsión se agrupa por día de Palma y nada se inventa", () => {
  const days = c.parseMetno(
    metno([
      // 22:00 UTC del 18 es ya el 19 en Palma (verano, UTC+2).
      ["2026-09-18T21:00:00Z", 22.4, 0, "fair_night"],
      ["2026-09-18T22:00:00Z", 21.9, 0.2, "cloudy"],
      ["2026-09-19T05:00:00Z", 18.4, 0, "clearsky_day"],
      ["2026-09-19T11:00:00Z", 27.8, 1.3, "lightrainshowers_day"],
      ["2026-09-19T12:00:00Z", 999, 0, "clearsky_day"],
      ["2026-09-20T00:00:00Z", 19, 0, "fair_night", true],
      ["2026-09-20T06:00:00Z", 21, null, "partlycloudy_day", true],
      ["2026-09-20T12:00:00Z", 28.9, 0.4, "heavyrain", true],
      ["no-es-fecha", 20, 0, "clearsky_day"],
    ]),
  );
  assert.deepEqual(
    days.map((d) => d.day),
    ["2026-09-18", "2026-09-19", "2026-09-20"],
  );
  const d19 = days[1];
  assert.deepEqual(
    [d19.tMin, d19.tMax, d19.precipMm, d19.samples, d19.resolution],
    [18.4, 27.8, 1.5, 3, "hourly"],
  );
  assert.equal(
    d19.symbol,
    "lightrainshowers_day",
    "el símbolo del tramo más cercano a las 13:00",
  );
  assert.equal(days[2].resolution, "6h");
  assert.equal(days[2].precipMm, 0.4);
  assert.equal(
    c.symbolLabel("lightrainshowers_day"),
    "chubascos (lluvia débil)",
  );
  assert.equal(c.symbolLabel("clearsky_night"), "despejado");
  assert.equal(
    c.symbolLabel("codigo_nuevo"),
    "codigo_nuevo",
    "un código desconocido no se adivina",
  );
  assert.equal(c.symbolLabel(null), null);
  assert.deepEqual(c.parseMetno(null), []);
  assert.deepEqual(c.parseMetno({ properties: { timeseries: "x" } }), []);
  const noRain = c.parseMetno({
    properties: {
      timeseries: [
        {
          time: "2026-09-19T10:00:00Z",
          data: { instant: { details: { air_temperature: 25 } } },
        },
      ],
    },
  });
  assert.equal(
    noRain[0].precipMm,
    null,
    "sin dato de lluvia: no disponible, no cero",
  );
  // Una previsión parcial tomada por la tarde no pisa la completa de la mañana.
  assert.equal(
    c.keepsBetter(
      { samples: 20 },
      { day: "2026-09-18", samples: 5 },
      "2026-09-18",
    ),
    false,
  );
  assert.equal(
    c.keepsBetter(
      { samples: 4 },
      { day: "2026-09-19", samples: 3 },
      "2026-09-18",
    ),
    true,
  );
  assert.equal(
    c.keepsBetter(null, { day: "2026-09-18", samples: 1 }, "2026-09-18"),
    true,
  );
});

test("contexto: festivos del calendario oficial, solo los que afectan a Palma", () => {
  assert.equal(c.parseCatalanDate("24 de juny", 2026), "2026-06-24");
  assert.equal(c.parseCatalanDate("2 d’abril", 2026), "2026-04-02");
  assert.equal(c.parseCatalanDate("15 d'agost", 2026), "2026-08-15");
  assert.equal(c.parseCatalanDate("31 de febrer", 2026), "");
  assert.equal(
    c.parseCatalanDate("24 de junio", 2026),
    "",
    "otro idioma: no se adivina",
  );
  const { holidays, rejected } = c.parseHolidayCsv(csv, 2026);
  assert.equal(holidays.length, 10);
  assert.equal(rejected.length, 2);
  assert.deepEqual(
    holidays
      .filter((h) => h.scope === "local")
      .map((h) => h.day + " " + h.name),
    ["2026-01-20 Sant Sebastià", "2026-06-24 Sant Joan, patró"],
  );
  assert.ok(!holidays.some((h) => /Jaume/.test(h.name)), "Alcúdia no es Palma");
  assert.deepEqual(c.parseHolidayCsv("a,b,c\n1,2,3", 2026), {
    holidays: [],
    rejected: ["cabecera del CSV no reconocida"],
  });
});

test("contexto: ventas por nivel de impacto, hechos sin correlación", () => {
  const moves = [
    { id: "a", kind: "exit", reason: "Venta del día 2026-09-10", delta: -4 },
    { id: "b", kind: "exit", reason: "Venta del día 2026-09-10", delta: -1.5 },
    { id: "c", kind: "exit", reason: "Venta del día 2026-09-11", delta: -9 },
    { id: "d", kind: "reversal", reason: "Deshacer", delta: 9, reverses: "c" },
    { id: "e", kind: "exit", reason: "Salida manual", delta: -3 },
    { id: "f", kind: "waste", reason: "Merma del día 2026-09-10", delta: -2 },
  ];
  const sales = c.dailySalesKg(moves);
  assert.deepEqual(
    [...sales],
    [["2026-09-10", 5.5]],
    "una venta deshecha no cuenta",
  );
  const rows = [];
  for (let i = 0; i < 8; i++)
    rows.push({ day: "d" + i, salesKg: 10 + i, impact: "high" });
  rows.push(
    { day: "x", salesKg: 6, impact: "low" },
    { day: "y", salesKg: 0, impact: "low" },
  );
  const levels = c.salesByImpact(rows);
  const high = levels.find((l) => l.impact === "high");
  assert.deepEqual(
    [high.days, high.meanKg, high.minKg, high.maxKg, high.enough],
    [8, 13.5, 10, 17, true],
  );
  const low = levels.find((l) => l.impact === "low");
  assert.deepEqual(
    [low.days, low.meanKg, low.enough],
    [1, 6, false],
    "un día sin ventas no entra; con un día no hay media fiable",
  );
  assert.deepEqual(
    [
      levels.find((l) => l.impact === "none").days,
      levels.find((l) => l.impact === "none").meanKg,
    ],
    [0, null],
  );
});

test("contexto: servicio con fuentes simuladas, caídas, año sin publicar y eventos propios", async () => {
  const dir = tmp("context-");
  let now = new Date("2026-09-18T08:00:00Z");
  const state = { weatherHits: 0, since: [] };
  const weather = {
    async forecast({ ifModifiedSince }) {
      state.weatherHits++;
      state.since.push(ifModifiedSince);
      if (state.weatherFail) throw state.weatherFail;
      if (state.notModified) return { notModified: true, expires: "" };
      return {
        payload: state.payload,
        expires: new Date(now.getTime() + 30 * 60000).toUTCString(),
        lastModified: "Fri, 18 Sep 2026 07:30:00 GMT",
        updatedAt: "2026-09-18T07:16:59Z",
      };
    },
  };
  const holidays = {
    asked: [],
    async calendar(year) {
      this.asked.push(year);
      if (year === 2027)
        return { missing: true, reason: "sin conjunto de datos para ese año" };
      return { text: state.csv ?? csv, url: "https://intranet.caib.es/x.csv" };
    },
  };
  const service = new ContextService(dir, {
    weather,
    holidays,
    clock: () => now,
  });
  try {
    const hours = [];
    for (let h = 6; h < 22; h++)
      hours.push([
        `2026-09-18T${String(h).padStart(2, "0")}:00:00Z`,
        20 + (h % 9),
        0,
        "clearsky_day",
      ]);
    state.payload = metno([
      ...hours,
      ["2026-09-19T10:00:00Z", 26, 0, "fair_day"],
      ["2026-09-29T00:00:00Z", 22, 0, "fair_day", true],
    ]);
    await service.sync();
    let view = service.range("2026-09-18", "2026-09-29");
    assert.equal(view.days["2026-09-18"].weather.kind, "previsión");
    assert.equal(view.days["2026-09-18"].weather.tMax, 28);
    assert.equal(
      view.days["2026-09-19"],
      undefined,
      "una sola muestra de un día futuro no es una previsión del día",
    );
    assert.equal(view.status.holidays.loaded, true);
    assert.deepEqual(
      holidays.asked,
      [2026],
      "el año siguiente no se busca hasta octubre",
    );
    assert.equal(
      service.weatherDue(),
      false,
      "no se consulta antes de 3 h aunque Expires sea antes",
    );
    // Por la tarde llega una previsión parcial del mismo día: se conserva la completa.
    now = new Date("2026-09-18T18:00:00Z");
    state.payload = metno([
      ["2026-09-18T19:00:00Z", 21, 0, "fair_night"],
      ["2026-09-18T20:00:00Z", 20, 0, "fair_night"],
    ]);
    await service.sync();
    assert.equal(
      state.since.at(-1),
      "Fri, 18 Sep 2026 07:30:00 GMT",
      "se usa If-Modified-Since",
    );
    assert.equal(
      service.range("2026-09-18", "2026-09-18").days["2026-09-18"].weather.tMax,
      28,
    );
    // Al día siguiente, lo guardado de ayer es una previsión guardada, no una observación.
    now = new Date("2026-09-19T09:00:00Z");
    state.notModified = true;
    await service.sync();
    assert.equal(
      service.range("2026-09-18", "2026-09-18").days["2026-09-18"].weather.kind,
      "previsión guardada",
    );
    // Fuente caída: error visible, datos intactos y una hora de espera.
    now = new Date("2026-09-19T13:00:00Z");
    state.notModified = false;
    state.weatherFail = Object.assign(Error("fetch failed"), {
      cause: { code: "ENOTFOUND" },
    });
    await service.sync();
    assert.match(service.status().weather.error, /Sin conexión/);
    assert.equal(service.weatherDue(), false);
    assert.ok(
      service.range("2026-09-18", "2026-09-18").days["2026-09-18"].weather,
    );
    // Octubre: se busca el año siguiente; si no está publicado se anota y se espera una semana.
    now = new Date("2026-10-05T09:00:00Z");
    state.weatherFail = null;
    await service.sync();
    assert.deepEqual(holidays.asked, [2026, 2027]);
    await service.sync({ force: true });
    assert.deepEqual(
      holidays.asked,
      [2026, 2027],
      "el año sin publicar no se repregunta antes de 7 días salvo que falte el actual",
    );
    // Un CSV que cambió de formato no borra los festivos buenos.
    const other = new ContextService(tmp("context-bad-"), {
      weather,
      holidays,
      clock: () => now,
    });
    state.csv =
      "Illa,Àmbit,Municipi,Localitat,Data,Nom festa\nMallorca,Local,Palma,Palma,20 de gener,Sant Sebastià";
    const bad = await other.syncHolidays(2026);
    assert.match(bad.error, /formato no reconocido/);
    other.close();
    assert.equal(
      service.range("2026-06-24", "2026-06-24").days["2026-06-24"].holidays[0]
        .name,
      "Sant Joan, patró",
    );
    // Eventos: son del usuario y se validan.
    assert.throws(
      () => service.addEvent({ name: "", from: "2026-09-19" }),
      /nombre/,
    );
    assert.throws(
      () => service.addEvent({ name: "X", from: "2026-02-31" }),
      /inválidas/,
    );
    assert.throws(
      () =>
        service.addEvent({ name: "X", from: "2026-09-19", to: "2026-09-01" }),
      /inválidas/,
    );
    assert.throws(
      () =>
        service.addEvent({ name: "X", from: "2026-01-01", to: "2026-12-31" }),
      /60 días/,
    );
    const id = service.addEvent({
      name: "<b>Nit de l'Art</b>",
      from: "2026-09-19",
      to: "2026-09-20",
      note: "centro",
    });
    view = service.range("2026-09-20", "2026-09-21");
    assert.equal(
      view.days["2026-09-20"].events[0].name,
      "<b>Nit de l'Art</b>",
      "se guarda tal cual; la interfaz lo escapa",
    );
    assert.equal(view.days["2026-09-21"], undefined);
    service.deleteEvent(id);
    assert.throws(() => service.deleteEvent(id), /desconocido/);
    assert.throws(() => service.range("2026-01-01", "2027-01-01"), /largo/);
    assert.ok(fs.existsSync(service.backupTo(path.join(dir, "backups"))));
  } finally {
    service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cruceros: la copia del registro se inspecciona y se restaura sin perder el registro actual", async () => {
  const dir = tmp("cruises-restore-");
  const row = (call, ship) => ({
    id: `80|P|P|2026|${call}|1`,
    cell: [
      "80",
      "80",
      "P",
      2026,
      1,
      "P",
      "7",
      "Cruceros turísticos",
      "9803613",
      ship,
      "ITALIA",
      "ESPAÑA",
      "CIVITAVECCHIA",
      "BARCELONA",
      "18/09/2026 08:00",
      "18/09/2026 21:00",
      "P120",
      "MUELLE",
      "AGENTE",
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
      "Trasbordo",
      "Pasajeros",
      "5000",
      "T",
      "0",
      "Sí",
      "Palma",
      "Concedido",
    ],
  });
  const state = { forecast: { rows: [row(1, "UNO")] } };
  const provider = {
    async session() {
      return "c";
    },
    async forecast() {
      return { payload: state.forecast, sourceUpdatedAt: "", cookie: "c" };
    },
    async history() {
      return { total: 1, records: 0, rows: [] };
    },
  };
  const service = new CruiseService(dir, {
    provider,
    clock: () => new Date("2026-09-10T08:00:00Z"),
  });
  try {
    const backups = path.join(dir, "backups");
    assert.equal(service.copyInfo(backups), null);
    assert.throws(() => service.restoreCopy(backups), /No hay una copia/);
    await service.sync("manual");
    service.setShipInfo("9803613", {
      line: "Naviera anotada",
      infoSource: "web",
    });
    service.repo.backupTo(backups);
    assert.deepEqual(
      [service.copyInfo(backups).calls, service.copyInfo(backups).ships],
      [1, 1],
    );
    // Después de la copia el registro cambia (y se pierde la ficha): restaurar la recupera.
    service.setShipInfo("9803613", {});
    state.forecast = { rows: [row(1, "UNO"), row(2, "DOS")] };
    await service.sync("manual");
    assert.equal(service.status().totals.calls, 2);
    const info = service.restoreCopy(backups);
    assert.equal(info.calls, 1);
    assert.equal(service.status().totals.calls, 1);
    assert.equal(service.day("2026-09-18").calls[0].line, "Naviera anotada");
    assert.ok(
      fs.existsSync(path.join(dir, "cruceros-antes-de-restaurar.sqlite")),
      "el registro anterior se conserva",
    );
    fs.writeFileSync(
      path.join(backups, "cruceros-copia.sqlite"),
      "esto no es una base de datos",
    );
    assert.equal(service.copyInfo(backups), null);
    assert.throws(
      () => service.restoreCopy(backups),
      /No hay una copia legible/,
    );
    assert.equal(
      service.status().totals.calls,
      1,
      "una copia ilegible no toca nada",
    );
  } finally {
    service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("contexto: rutas del servidor, ventas junto al impacto, eventos e interruptor", async () => {
  const dir = tmp("context-http-");
  const today = portToday();
  const contextProviders = {
    weather: {
      hits: 0,
      async forecast() {
        this.hits++;
        const steps = [];
        for (let h = 0; h < 24; h++)
          steps.push([
            new Date(
              Date.parse(today + "T00:00:00Z") + h * 3600000,
            ).toISOString(),
            20 + (h % 8),
            0,
            "clearsky_day",
          ]);
        return {
          payload: metno(steps),
          expires: "",
          lastModified: "",
          updatedAt: "",
        };
      },
    },
    holidays: {
      async calendar() {
        return {
          text: csv.replace(
            "1 de gener,Cap d’any",
            `${Number(today.slice(8))} de ${Object.entries({ gener: 1, febrer: 2, març: 3, abril: 4, maig: 5, juny: 6, juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12 }).find(([, n]) => n === Number(today.slice(5, 7)))[0]},Festa de prova`,
          ),
          url: "https://intranet.caib.es/x.csv",
        };
      },
    },
  };
  const cruiseProvider = {
    async session() {
      return "c";
    },
    async forecast() {
      return {
        payload: { rows: [{ cell: new Array(38).fill("") }] },
        sourceUpdatedAt: "",
        cookie: "c",
      };
    },
    async history() {
      return { total: 1, records: 0, rows: [] };
    },
  };
  let app;
  try {
    app = await createApp({ dataDir: dir, cruiseProvider, contextProviders });
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
    assert.equal(
      (await fetch(origin + `/api/cruises/context?from=${today}&to=${today}`))
        .status,
      403,
    );
    assert.equal(
      contextProviders.weather.hits,
      0,
      "nada sale a la red sin pedirlo",
    );
    assert.equal((await post("/api/cruises", { type: "sync" })).status, 200);
    assert.equal(contextProviders.weather.hits, 1);
    let ctx = await get(
      `/api/cruises/context?from=${today}&to=${addDays(today, 2)}`,
    );
    assert.ok(ctx.days[today].weather.tMax >= 20);
    assert.equal(ctx.days[today].holidays[0].name, "Festa de prova");
    assert.equal(
      (await fetch(origin + "/api/cruises/context?from=x&to=y", { headers }))
        .status,
      400,
    );
    assert.equal(
      (await post("/api/cruises", { type: "event", name: "", from: today }))
        .status,
      400,
    );
    assert.equal(
      (
        await post("/api/cruises", {
          type: "event",
          name: "Feria",
          from: today,
          to: addDays(today, 1),
        })
      ).status,
      200,
    );
    ctx = await get(
      `/api/cruises/context?from=${today}&to=${addDays(today, 2)}`,
    );
    assert.equal(ctx.days[addDays(today, 1)].events[0].name, "Feria");
    assert.equal(
      (
        await post("/api/cruises", {
          type: "eventDelete",
          id: ctx.days[today].events[0].id,
        })
      ).status,
      200,
    );
    // Ventas junto al impacto: sin ventas no hay cifras; con una venta aparece su día.
    let sales = await get("/api/cruises/sales");
    assert.equal(sales.daysWithSales, 0);
    const state = (await get("/api/state")).state;
    const finished = state.products.find((p) =>
      state.recipes.some((r) => r.product === p.id),
    );
    assert.ok(finished, "la demo trae un producto terminado");
    const r = await post("/api/action", {
      type: "dailySales",
      date: today,
      lines: [
        { product: finished.id, sold: Math.min(1, finished.stock), waste: 0 },
      ],
      revision: state.revision,
      operationId: randomUUID(),
    });
    assert.equal(r.status, 200, "la venta del día se registra");
    sales = await get("/api/cruises/sales");
    assert.equal(sales.daysWithSales, 1);
    assert.equal(
      sales.levels.find((l) => l.impact === "none").days,
      1,
      "sin cruceros registrados ese día",
    );
    assert.equal(sales.levels.find((l) => l.impact === "none").enough, false);
    const report = await get("/api/report");
    assert.ok(report.context, "la semana lleva el contexto de cada día");
    assert.equal((await get("/api/cruises/copy")).copy.calls, 0);
    assert.equal(
      (await post("/api/cruises", { type: "restore" })).status,
      400,
      "una copia vacía no se restaura",
    );
    assert.ok(
      fs.existsSync(path.join(dir, "backups", "contexto-copia.sqlite")),
    );
    await post("/api/maintenance", { type: "cruises", enabled: false });
    assert.equal((await get("/api/report")).context, null);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
