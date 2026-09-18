const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  apply,
  seed,
  salesHistory,
  weeklyReport,
  weekStart,
} = require("../build/domain.js");
const { createApp } = require("../src/server.cjs");

const stock = (s, id) => s.products.find((p) => p.id === id).stock;
// p4 is the demo's finished product (a gelato in kg produced by the sample recipe).
const close = (s, date, lines) => apply(s, { type: "dailySales", date, lines });

test("cierre del día: vendido, o lo que queda, con motivo de merma", () => {
  const start = stock(seed(), "p4");
  let s = close(seed(), "2026-09-08", [
    { product: "p4", sold: 1.5, waste: 0.25, wasteReason: "texture" },
  ]);
  assert.equal(stock(s, "p4"), start - 1.75);
  const waste = s.movements.find((m) => m.kind === "waste");
  assert.equal(
    waste.reason,
    "Merma del día 2026-09-08 · Textura o cristalización",
  );
  assert.match(
    s.activity[0].text,
    /merma 0.25 kg \(textura o cristalización\)/,
  );
  // Pesando lo que queda: lo vendido es lo que falta y no se tiró.
  const left = Math.round((stock(s, "p4") - 1) * 1000) / 1000;
  s = close(s, "2026-09-09", [{ product: "p4", remaining: 1, waste: 0.5 }]);
  assert.equal(stock(s, "p4"), 1);
  const sale = s.movements.find((m) => m.reason === "Venta del día 2026-09-09");
  assert.equal(sale.delta, -Math.round((left - 0.5) * 1000) / 1000);
  assert.equal(
    s.movements.find((m) => m.kind === "waste").reason,
    "Merma del día 2026-09-09",
    "el motivo es opcional",
  );
  // Queda todo: no se vendió nada, solo hubo merma.
  s = close(s, "2026-09-10", [{ product: "p4", remaining: 0.8, waste: 0.2 }]);
  assert.equal(stock(s, "p4"), 0.8);
  assert.ok(!s.movements.some((m) => m.reason === "Venta del día 2026-09-10"));
  // Lo que no cuadra se rechaza sin tocar nada.
  assert.throws(
    () => close(s, "2026-09-11", [{ product: "p4", remaining: 5 }]),
    /queda más de lo que había/,
  );
  assert.throws(
    () =>
      close(s, "2026-09-11", [{ product: "p4", remaining: 0.7, waste: 0.5 }]),
    /queda más de lo que había/,
  );
  assert.throws(
    () => close(s, "2026-09-11", [{ product: "p4", sold: 0.5, waste: 0.5 }]),
    /más que el stock/,
  );
  assert.throws(
    () =>
      close(s, "2026-09-11", [{ product: "p4", sold: 0.1, remaining: 0.1 }]),
    /no las dos cosas/,
  );
  assert.throws(() =>
    close(s, "2026-09-11", [
      { product: "p4", sold: 0.1, wasteReason: "porque sí" },
    ]),
  );
  assert.throws(
    () => close(s, "2026-09-11", [{ product: "p4", remaining: 0.8 }]),
    /al menos/,
  );
});

test("cierre del día: deshacer compensa todo el día y el historial no cuenta lo deshecho", () => {
  const start = stock(seed(), "p4");
  let s = close(seed(), "2026-09-08", [
    { product: "p4", sold: 1, waste: 0.5, wasteReason: "expiry" },
  ]);
  s = close(s, "2026-09-09", [
    { product: "p4", sold: 0.75, waste: 0.25, wasteReason: "tasting" },
  ]);
  s = close(s, "2026-09-09", [{ product: "p4", sold: 0.25 }]);
  let h = salesHistory(s, "2026-09-01", "2026-09-30");
  assert.deepEqual(
    h.days.map((d) => [d.date, d.sold, d.waste, d.wastePct]),
    [
      ["2026-09-09", 1, 0.25, 20],
      ["2026-09-08", 1, 0.5, 33.3],
    ],
  );
  assert.deepEqual(h.totals, { sold: 2, waste: 0.75, wastePct: 27.3 });
  assert.deepEqual(h.byReason, [
    { reason: "Fin de vida útil", waste: 0.5 },
    { reason: "Degustación o invitación", waste: 0.25 },
  ]);
  assert.deepEqual(
    h.byProduct.map((p) => [p.product, p.sold, p.waste]),
    [["p4", 2, 0.75]],
  );
  assert.equal(salesHistory(s, "2026-09-09", "2026-09-09").days.length, 1);
  // Deshacer el día 9: tres movimientos compensados, el stock vuelve y el día desaparece.
  const before = s.movements.length;
  s = apply(s, { type: "undoDailySales", date: "2026-09-09" });
  assert.equal(s.movements.length, before + 3, "los originales se conservan");
  assert.equal(stock(s, "p4"), start - 1.5);
  h = salesHistory(s, "2026-09-01", "2026-09-30");
  assert.deepEqual(
    h.days.map((d) => d.date),
    ["2026-09-08"],
  );
  assert.deepEqual(h.byReason, [{ reason: "Fin de vida útil", waste: 0.5 }]);
  assert.throws(
    () => apply(s, { type: "undoDailySales", date: "2026-09-09" }),
    /por deshacer/,
  );
  assert.throws(
    () => apply(s, { type: "undoDailySales", date: "2026-09-01" }),
    /por deshacer/,
  );
  // Se puede volver a cerrar el día bien.
  s = close(s, "2026-09-09", [{ product: "p4", sold: 0.5 }]);
  assert.equal(salesHistory(s, "2026-09-09", "2026-09-09").days[0].sold, 0.5);
  // Una merma antigua sin motivo cuenta como «Sin motivo».
  s = close(s, "2026-09-10", [{ product: "p4", waste: 0.1 }]);
  assert.ok(
    salesHistory(s, "2026-09-10", "2026-09-10").byReason.some(
      (r) => r.reason === "Sin motivo",
    ),
  );
});

test("resumen semanal: cuenta por día de negocio y no cuenta lo deshecho", () => {
  // El cierre del lunes 7 se apunta hoy; debe caer en su semana, no en la del día en que se tecleó.
  let s = close(seed(), "2026-09-07", [{ product: "p4", sold: 1, waste: 0.5 }]);
  let week = weeklyReport(s, weekStart(new Date("2026-09-07T12:00:00")));
  assert.equal(week.totals.sales, 1);
  assert.equal(week.totals.waste, 0.5);
  assert.equal(week.days.find((d) => d.date === "2026-09-07").sales, 1);
  s = apply(s, { type: "undoDailySales", date: "2026-09-07" });
  week = weeklyReport(s, weekStart(new Date("2026-09-07T12:00:00")));
  assert.equal(
    week.totals.sales,
    0,
    "antes el resumen seguía contando una venta deshecha",
  );
  assert.equal(week.totals.waste, 0);
});

test("cierre del día: ruta del historial con permisos y motivos", async () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "sales-http-"));
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
    assert.equal((await fetch(origin + "/api/sales")).status, 403);
    let h = await get("/api/sales?days=14");
    assert.equal(h.days.length, 0);
    assert.equal(h.reasons.expiry, "Fin de vida útil");
    assert.equal(
      h.tomorrow,
      null,
      "sin datos de cruceros no hay pista de mañana",
    );
    const state = (await get("/api/state")).state;
    const finished = state.products.find((p) =>
      state.recipes.some((r) => r.product === p.id),
    );
    const today = h.to;
    const act = (body) =>
      fetch(origin + "/api/action", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, operationId: randomUUID() }),
      });
    let r = await act({
      type: "dailySales",
      date: today,
      lines: [
        {
          product: finished.id,
          remaining: finished.stock - 1,
          waste: 0.25,
          wasteReason: "display",
        },
      ],
      revision: state.revision,
    });
    assert.equal(r.status, 200);
    h = await get("/api/sales");
    assert.deepEqual(
      [h.days[0].date, h.days[0].sold, h.days[0].waste],
      [today, 0.75, 0.25],
    );
    assert.deepEqual(h.byReason, [
      { reason: "Vitrina o temperatura", waste: 0.25 },
    ]);
    r = await act({
      type: "undoDailySales",
      date: today,
      revision: (await get("/api/state")).state.revision,
    });
    assert.equal(r.status, 200);
    assert.equal((await get("/api/sales")).days.length, 0);
    assert.equal(
      (await get("/api/state")).state.products.find((p) => p.id === finished.id)
        .stock,
      finished.stock,
    );
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
