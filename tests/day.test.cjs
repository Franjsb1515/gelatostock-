const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  apply,
  seed,
  validate,
  daySummary,
  localDate,
} = require("../build/domain.js");
const { Store } = require("../build/store.js");

// Los movimientos sin día propio (conteos, entradas) caen en el día de negocio de su hora real,
// así que estas pruebas trabajan sobre «hoy» y «ayer» de negocio con el cambio de día a las 5:00.
const dayOffset = (n) =>
  localDate(new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000));
const today = dayOffset(0);
const yesterday = dayOffset(-1);
const tomorrow = dayOffset(1);
const stock = (s, id = "p4") => s.products.find((p) => p.id === id).stock;
const produce = (s, quantity, date) => {
  s = apply(s, { type: "produce", recipe: "r1", quantity, date });
  const p = s.productions.find((x) => x.status === "proposed");
  return apply(s, {
    type: "applyProduction",
    id: p.id,
    lines: p.lines,
    note: "",
  });
};
const row = (d) => d.rows.find((r) => r.product === "p4");

test("resumen del día: al empezar + producido − salidas + ajustes = queda para mañana", () => {
  let s = seed();
  const opening = stock(s);
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 10000,
    from: yesterday,
  });
  s = produce(s, 1, today);
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [
      {
        product: "p4",
        sold: 0.8,
        waste: 0.2,
        gift: 0.1,
        wasteReason: "expiry",
      },
    ],
  });
  let d = daySummary(s, today);
  const r = row(d.live);
  assert.deepEqual(
    [r.opening, r.produced, r.sold, r.waste, r.gift, r.adjust, r.remaining],
    [opening, 1, 0.8, 0.2, 0.1, 0, Math.round((opening - 0.1) * 1000) / 1000],
  );
  // DERIVADO: kilos × valor de venta vigente ese día.
  assert.deepEqual(
    [r.saleValue, r.soldCents, r.wasteCents, r.giftCents],
    [10000, 8000, 2000, 1000],
  );
  assert.equal(d.live.totals.soldCents, 8000);
  assert.equal(d.closed, false);
  assert.equal(d.difference, null, "sin venta real no hay diferencia");
  // Un conteo que no cuadra se enseña como ajuste: no se vuelve merma ni venta.
  s = apply(s, {
    type: "count",
    product: "p4",
    value: r.remaining - 0.3,
    reason: "Conteo",
  });
  d = daySummary(s, today);
  assert.equal(row(d.live).adjust, -0.3);
  assert.equal(row(d.live).waste, 0.2);
  assert.equal(row(d.live).sold, 0.8);
  assert.equal(
    row(d.live).remaining,
    Math.round((r.remaining - 0.3) * 1000) / 1000,
  );
  // Ayer no pasó nada: lo que quedaba ayer es con lo que empezó hoy.
  const before = daySummary(s, yesterday);
  assert.equal(row(before.live).remaining, opening);
  // Una línea deshecha deja de contar en el resumen.
  s = apply(s, { type: "undoDailySales", date: today });
  assert.equal(row(daySummary(s, today).live).sold, 0);
  validate(s);
});

test("sin valor de venta la venta estimada es «No disponible», no cero", () => {
  let s = seed();
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [{ product: "p4", sold: 0.5 }],
  });
  const d = daySummary(s, today);
  assert.equal(row(d.live).soldCents, null);
  assert.equal(d.live.totals.soldCents, null);
  assert.equal(d.live.totals.wasteCents, 0, "sin merma, la merma vale 0 €");
});

test("confirmar el cierre congela el día; reabrir exige motivo y deja rastro", () => {
  let s = seed();
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 10000,
    from: yesterday,
  });
  assert.throws(
    () => apply(s, { type: "confirmDay", date: today }),
    /no tiene producción, ventas, mermas ni ajustes/,
  );
  s = produce(s, 1, today);
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [{ product: "p4", sold: 0.8, waste: 0.2 }],
  });
  s = apply(s, { type: "confirmDay", date: today, realSaleCents: 7500 });
  assert.match(
    s.activity[0].text,
    /cerrado: vendido 0.8 kg.*venta estimada 80,00 €, venta real 75,00 € \(diferencia −5,00 €\)/,
  );
  let d = daySummary(s, today);
  assert.equal(d.closed, true);
  assert.equal(d.drift, false);
  assert.equal(d.difference, -500);
  assert.equal(d.close.snapshot.totals.soldCents, 8000);
  // Día cerrado: nada de ese día cambia, y se explica cómo.
  const line = s.movements.find((m) => m.reason === `Venta del día ${today}`);
  const made = s.productions.find((p) => p.status === "applied");
  for (const action of [
    { type: "dailySales", date: today, lines: [{ product: "p4", sold: 0.1 }] },
    { type: "undoDailySales", date: today },
    { type: "undoCloseLine", id: line.id },
    { type: "editCloseLine", id: line.id, quantity: 0.5 },
    { type: "voidProduction", id: made.id, reason: "" },
    { type: "confirmDay", date: today },
  ])
    assert.throws(
      () => apply(s, action),
      /está cerrado. Reábrelo/,
      action.type,
    );
  // Otro día sigue abierto.
  apply(s, {
    type: "dailySales",
    date: yesterday,
    lines: [{ product: "p4", sold: 0.1 }],
  });
  // Cambiar hoy el valor de venta con fecha de mañana no toca el día cerrado.
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 20000,
    from: tomorrow,
  });
  assert.equal(daySummary(s, today).drift, false);
  // Reabrir: con motivo obligatorio.
  assert.throws(() => apply(s, { type: "reopenDay", date: today, reason: "" }));
  assert.throws(
    () => apply(s, { type: "reopenDay", date: yesterday, reason: "x" }),
    /no está cerrado/,
  );
  s = apply(s, {
    type: "reopenDay",
    date: today,
    reason: "Merma mal pesada",
  });
  assert.match(s.activity[0].text, /reabierto. Motivo: Merma mal pesada/);
  d = daySummary(s, today);
  assert.equal(d.closed, false);
  assert.equal(d.close.status, "reopened");
  s = apply(s, { type: "editCloseLine", id: line.id, quantity: 0.7 });
  s = apply(s, { type: "confirmDay", date: today });
  d = daySummary(s, today);
  assert.equal(d.close.snapshot.totals.soldCents, 7000);
  assert.equal(
    d.close.realSaleCents,
    undefined,
    "la venta real no se arrastra",
  );
  assert.deepEqual(
    d.close.log.map((l) => l.kind),
    ["confirmed", "reopened", "confirmed"],
  );
  assert.equal(d.close.log[1].reason, "Merma mal pesada");
  assert.equal(s.days.length, 1);
  validate(s);
});

test("el cierre confirmado persiste en SQLite (user_version 5) y la instantánea no deriva", () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "day-store-"));
  let store;
  try {
    store = new Store(dir);
    const act = (a) => store.dispatch(a);
    act({ type: "setSaleValue", recipe: "r1", cents: 10000, from: yesterday });
    act({
      type: "dailySales",
      date: today,
      lines: [{ product: "p4", sold: 0.5 }],
    });
    act({ type: "confirmDay", date: today, realSaleCents: 5200 });
    store.close();
    store = new Store(dir);
    const again = store.load();
    assert.equal(again.days.length, 1);
    const d = daySummary(again, today);
    assert.equal(d.closed, true);
    assert.equal(
      d.drift,
      false,
      "la instantánea guardada coincide con el recálculo",
    );
    assert.equal(d.difference, 200);
    assert.equal(
      Number(store.db.prepare("PRAGMA user_version").get().user_version),
      5,
    );
  } finally {
    try {
      store?.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("una base de la versión anterior (user_version 4, sin tabla days) abre sin perder nada", () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "day-migrate-"));
  let store;
  try {
    store = new Store(dir);
    store.dispatch({
      type: "dailySales",
      date: today,
      lines: [{ product: "p4", sold: 0.5 }],
    });
    store.db.exec("DROP TABLE days; PRAGMA user_version=4;");
    store.close();
    store = new Store(dir);
    const s = store.load();
    assert.deepEqual(s.days, []);
    assert.equal(row(daySummary(s, today).live).sold, 0.5);
    store.dispatch({ type: "confirmDay", date: today });
    assert.equal(store.load().days.length, 1);
  } finally {
    try {
      store?.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("servidor: GET /api/day resume el día y una acción sobre un día cerrado se rechaza", async () => {
  const { randomUUID } = require("node:crypto");
  const { createApp } = require("../src/server.cjs");
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "day-http-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    };
    const get = async (url) => (await fetch(origin + url, { headers })).json();
    const act = async (body) =>
      fetch(origin + "/api/action", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...body,
          operationId: randomUUID(),
          revision: (await get("/api/state")).state.revision,
        }),
      });
    assert.equal((await fetch(origin + "/api/day?date=" + today)).status, 403);
    assert.equal(
      (await fetch(origin + "/api/day?date=ayer", { headers })).status,
      400,
    );
    const day = (await get("/api/sales")).to;
    assert.equal(
      (
        await act({
          type: "setSaleValue",
          recipe: "r1",
          cents: 10000,
          from: day,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await act({
          type: "dailySales",
          date: day,
          lines: [{ product: "p4", sold: 0.8, waste: 0.2 }],
        })
      ).status,
      200,
    );
    let d = await get("/api/day?date=" + day);
    assert.equal(d.live.totals.soldCents, 8000);
    assert.equal(d.closed, false);
    assert.equal(
      (await act({ type: "confirmDay", date: day, realSaleCents: 8100 }))
        .status,
      200,
    );
    d = await get("/api/day?date=" + day);
    assert.deepEqual([d.closed, d.drift, d.difference], [true, false, 100]);
    const refused = await act({ type: "undoDailySales", date: day });
    assert.equal(refused.status, 400);
    assert.match((await refused.json()).error, /está cerrado. Reábrelo/);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
