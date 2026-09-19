const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  apply,
  seed,
  validate,
  productionPlan,
  todayBrief,
  businessDay,
  localDate,
} = require("../build/domain.js");
const { createApp } = require("../src/server.cjs");

const now = new Date();
const today = businessDay(now, 5);
const shift = (n) => {
  const d = new Date(today + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDate(d);
};
// Una receta como las del usuario: creada por él, con su gelato dado de alta por la app.
const ownRecipe = (s) => {
  s = apply(s, {
    type: "recipe",
    name: "Chocoloco",
    family: "crema",
    yield: 1,
    ingredients: [{ product: "p2", quantity: 0.5 }],
    createProduct: true,
  });
  const r = s.recipes.find((x) => x.name === "Chocoloco");
  return { s, r, id: r.product };
};
const produce = (s, recipe, quantity, date) => {
  s = apply(s, { type: "produce", recipe, quantity, date });
  const p = s.productions.find((x) => x.status === "proposed");
  return apply(s, {
    type: "applyProduction",
    id: p.id,
    lines: p.lines,
    note: "",
  });
};

test("qué producir hoy: objetivo − stock, con la venta media reciente como dato", () => {
  let { s, r, id } = ownRecipe(seed());
  let row = productionPlan(s, today).rows.find((x) => x.product === id);
  assert.deepEqual(
    [row.target, row.suggest, row.avgSold, row.coverDays],
    [0, null, null, null],
    "sin objetivo ni cierres no se propone ni se inventa nada",
  );
  s = apply(s, { type: "setGoal", product: id, target: 6 });
  assert.match(s.activity[0].text, /Objetivo de Chocoloco: tener 6 kg/);
  row = productionPlan(s, today).rows.find((x) => x.product === id);
  assert.equal(row.suggest, 6);
  assert.equal(row.recipe, r.id);
  // Dos días con cierre en el periodo: 1,5 kg y 0,5 kg vendidos -> media 1 kg al día.
  s = produce(s, r.id, 4, shift(-3));
  s = apply(s, {
    type: "dailySales",
    date: shift(-3),
    lines: [{ product: id, sold: 1.5, waste: 0.25 }],
  });
  s = apply(s, {
    type: "dailySales",
    date: shift(-2),
    lines: [{ product: id, sold: 0.5, gift: 0.25 }],
  });
  // Una venta de hace un mes queda fuera del periodo; la de hoy también (el día no ha acabado).
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [{ product: id, sold: 0.5 }],
  });
  const plan = productionPlan(s, today);
  row = plan.rows.find((x) => x.product === id);
  assert.deepEqual(
    [plan.from, plan.to, plan.closeDays],
    [shift(-14), shift(-1), 2],
  );
  assert.equal(row.stock, 1);
  assert.deepEqual(
    [row.soldKg, row.avgSold, row.coverDays, row.suggest],
    [2, 1, 1, 5],
    "la merma y la invitación no cuentan como venta",
  );
  // Por encima del objetivo no falta nada.
  s = apply(s, { type: "setGoal", product: id, target: 0.5 });
  assert.equal(
    productionPlan(s, today).rows.find((x) => x.product === id).suggest,
    0,
  );
  // El objetivo es solo para gelatos de una receta, y nunca deja el mínimo por encima.
  assert.throws(
    () => apply(s, { type: "setGoal", product: "p2", target: 3 }),
    /gelatos de tus recetas/,
  );
  s = apply(s, { type: "setGoal", product: "p4", target: 2 });
  const p4 = s.products.find((p) => p.id === "p4");
  assert.deepEqual([p4.target, p4.min], [2, 2]);
  validate(s);
});

test("indicadores del día para el inicio: hechos de hoy y aviso de ayer sin confirmar", () => {
  let { s, r, id } = ownRecipe(seed());
  s = apply(s, { type: "setGoal", product: id, target: 3 });
  s = apply(s, {
    type: "setSaleValue",
    recipe: r.id,
    cents: 10000,
    from: shift(-5),
  });
  let b = todayBrief(s, now, 5);
  assert.equal(b.date, today);
  assert.equal(b.yesterdayPending, null);
  // La demo trae otro gelato (p4) con su propio objetivo; aquí se mira el de la receta propia.
  assert.deepEqual(
    b.toProduce.find((x) => x.name === "Chocoloco"),
    { name: "Chocoloco", suggest: 3 },
  );
  s = produce(s, r.id, 2, shift(-1));
  s = apply(s, {
    type: "dailySales",
    date: shift(-1),
    lines: [{ product: id, sold: 1 }],
  });
  s = produce(s, r.id, 1, today);
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [{ product: id, sold: 0.8, waste: 0.2 }],
  });
  b = todayBrief(s, now, 5);
  assert.equal(b.totals.produced, 1);
  assert.equal(b.totals.sold, 0.8);
  assert.equal(b.totals.waste, 0.2);
  assert.equal(b.totals.soldCents, 8000);
  assert.equal(b.yesterdayPending, shift(-1));
  s = apply(s, { type: "confirmDay", date: shift(-1) });
  assert.equal(todayBrief(s, now, 5).yesterdayPending, null);
  s = apply(s, { type: "confirmDay", date: today, realSaleCents: 8000 });
  b = todayBrief(s, now, 5);
  assert.equal(b.closed, true);
  assert.equal(b.totals.soldCents, 8000);
});

test("servidor: /api/plan y el día en el sobre de estado", async () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "plan-http-"));
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
    assert.equal((await fetch(origin + "/api/plan")).status, 403);
    const plan = await get("/api/plan");
    const p4 = plan.rows.find((r) => r.product === "p4");
    assert.equal(p4.suggest, Math.round((p4.target - p4.stock) * 1000) / 1000);
    const r = await fetch(origin + "/api/action", {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "setGoal",
        product: "p4",
        target: 20,
        operationId: randomUUID(),
        revision: (await get("/api/state")).state.revision,
      }),
    });
    assert.equal(r.status, 200);
    const envelope = await r.json();
    assert.equal(envelope.alerts.day.date, plan.today);
    assert.ok(
      envelope.alerts.day.toProduce.some((x) => x.suggest === 20 - p4.stock),
    );
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
