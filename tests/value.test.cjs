const test = require("node:test");
const assert = require("node:assert/strict");
const {
  apply,
  seed,
  validate,
  recipeCost,
  saleValueOn,
  costPerKgOn,
  valueReport,
} = require("../build/domain.js");

// r1 «Gelato de chocolate» produce p4 con p2 (leche) y p10 (nata).
const recipe = (s) => s.recipes.find((r) => r.id === "r1");
const emptyTub = (s) => {
  const left = s.products.find((p) => p.id === "p4").stock;
  return left
    ? apply(s, { type: "count", product: "p4", value: 0, reason: "Prueba" })
    : s;
};
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

test("ejemplo del usuario: chocolate a 50 €/kg de coste y 100 €/kg de venta", () => {
  let s = emptyTub(seed());
  s = apply(s, { type: "setManualCost", recipe: "r1", cents: 5000 });
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 10000,
    from: "2026-09-01",
  });
  s = produce(s, 1, "2026-09-10");
  s = apply(s, {
    type: "dailySales",
    date: "2026-09-10",
    lines: [{ product: "p4", sold: 0.8, waste: 0.2, wasteReason: "expiry" }],
  });
  const r = valueReport(s, "2026-09-10", "2026-09-10");
  // Informe de VENTA: 800 g vendidos son 80 €; 200 g de merma son 20 € de venta perdida.
  assert.equal(r.sale.produced, 10000);
  assert.equal(r.sale.sold, 8000);
  assert.equal(r.sale.waste, 2000);
  // Informe de COSTE: 1 kg costó 50 €; los 200 g de merma son 10 € de coste perdido.
  assert.equal(r.cost.produced, 5000);
  assert.equal(r.cost.waste, 1000);
  assert.equal(r.cost.sold, 4000);
  assert.deepEqual(r.kg, { produced: 1, sold: 0.8, waste: 0.2, gift: 0 });
  assert.equal(r.rows[0].costSource, "manual");
  assert.deepEqual([r.missingValue, r.missingCost], [[], []]);
  validate(s);
});

test("el valor de venta tiene historial: cambiarlo hoy no toca los días pasados", () => {
  let s = emptyTub(seed());
  assert.equal(saleValueOn(s, "p4", "2026-09-10"), null, "sin valor todavía");
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 10000,
    from: "2026-09-01",
  });
  s = produce(s, 2, "2026-09-10");
  s = apply(s, {
    type: "dailySales",
    date: "2026-09-10",
    lines: [{ product: "p4", sold: 0.5 }],
  });
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 12000,
    from: "2026-09-12",
  });
  assert.match(s.activity[0].text, /120,00 € por kilo.*antes 100,00 €/);
  s = apply(s, {
    type: "dailySales",
    date: "2026-09-12",
    lines: [{ product: "p4", sold: 0.5 }],
  });
  assert.equal(saleValueOn(s, "p4", "2026-08-31"), null, "antes del primero");
  assert.equal(saleValueOn(s, "p4", "2026-09-11"), 10000);
  assert.equal(saleValueOn(s, "p4", "2026-09-12"), 12000);
  assert.equal(valueReport(s, "2026-09-10", "2026-09-10").sale.sold, 5000);
  assert.equal(valueReport(s, "2026-09-12", "2026-09-12").sale.sold, 6000);
  assert.equal(valueReport(s, "2026-09-10", "2026-09-12").sale.sold, 11000);
  // El mismo día se corrige, no se duplica.
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 11000,
    from: "2026-09-12",
  });
  assert.equal(recipe(s).saleValues.length, 2);
  assert.equal(saleValueOn(s, "p4", "2026-09-12"), 11000);
  // Editar la receta no borra el historial.
  const { id, saleValues, manualCost, ...fields } = recipe(s);
  s = apply(s, { type: "recipe", id, ...fields, name: "Chocolate intenso" });
  assert.equal(recipe(s).saleValues.length, 2);
});

test("coste calculado con los precios de compra; instantánea en cada producción", () => {
  let s = emptyTub(seed());
  const milk = s.products.find((p) => p.id === "p2");
  const cream = s.products.find((p) => p.id === "p10");
  const c = recipeCost(s, recipe(s));
  // DERIVADO: Σ(cantidad × precio / presentación) / rendimiento.
  const expected =
    Math.round((0.5 * milk.price) / milk.pack) +
    Math.round((0.2 * cream.price) / cream.pack);
  assert.equal(c.calculated, expected);
  assert.equal(c.source, "calculated");
  s = produce(s, 2, "2026-09-10");
  const first = s.productions.find((p) => p.status === "applied");
  assert.equal(first.cost.source, "calculated");
  assert.equal(
    first.cost.cents,
    Math.round((1 * milk.price) / milk.pack) +
      Math.round((0.4 * cream.price) / cream.pack),
  );
  const perKg = costPerKgOn(s, "p4", "2026-09-10");
  assert.equal(perKg.from, "production");
  // Sube la leche: la producción ya aprobada conserva su coste.
  const { id, stock, category, unit, icon, ...card } = milk;
  s = apply(s, {
    type: "editProduct",
    product: "p2",
    ...card,
    price: milk.price * 2,
  });
  assert.equal(
    s.productions.find((p) => p.id === first.id).cost.cents,
    first.cost.cents,
  );
  assert.equal(costPerKgOn(s, "p4", "2026-09-10").cents, perKg.cents);
  assert.ok(recipeCost(s, recipe(s)).calculated > c.calculated);
  // Una producción anulada deja de contar.
  s = apply(s, { type: "voidProduction", id: first.id, reason: "Prueba" });
  assert.equal(valueReport(s, "2026-09-10", "2026-09-10").kg.produced, 0);
});

test("sin precio de compra el coste es «No disponible», salvo que se escriba a mano", () => {
  let s = emptyTub(seed());
  const milk = s.products.find((p) => p.id === "p2");
  const { id, stock, category, unit, icon, ...card } = milk;
  s = apply(s, { type: "editProduct", product: "p2", ...card, price: 0 });
  let c = recipeCost(s, recipe(s));
  assert.equal(c.calculated, null);
  assert.deepEqual(c.missing, [milk.name]);
  assert.equal(c.perKg, null);
  s = produce(s, 1, "2026-09-10");
  assert.equal(s.productions[0].cost, undefined);
  s = apply(s, {
    type: "dailySales",
    date: "2026-09-10",
    lines: [{ product: "p4", waste: 0.2 }],
  });
  let r = valueReport(s, "2026-09-10", "2026-09-10");
  assert.equal(r.cost.waste, null, "no se inventa un coste");
  assert.equal(r.sale.waste, null, "ni un valor de venta");
  assert.equal(r.missingCost.length, 1);
  assert.equal(r.missingValue.length, 1);
  s = apply(s, { type: "setManualCost", recipe: "r1", cents: 5000 });
  c = recipeCost(s, recipe(s));
  assert.deepEqual([c.perKg, c.source], [5000, "manual"]);
  r = valueReport(s, "2026-09-10", "2026-09-10");
  assert.equal(r.cost.waste, 1000);
  s = apply(s, { type: "setManualCost", recipe: "r1" });
  assert.equal(recipe(s).manualCost, undefined);
  assert.throws(
    () => apply(s, { type: "setManualCost", recipe: "r1" }),
    /no tiene coste escrito a mano/,
  );
});

test("el valor de venta exige que el gelato esté dado de alta para vender", () => {
  let s = seed();
  const { id, saleValues, manualCost, product, ...fields } = recipe(s);
  s = apply(s, { type: "recipe", ...fields, name: "Base blanca" });
  const base = s.recipes.find((r) => r.name === "Base blanca");
  assert.throws(
    () =>
      apply(s, {
        type: "setSaleValue",
        recipe: base.id,
        cents: 1000,
        from: "2026-09-01",
      }),
    /no está dado de alta para vender/,
  );
});

test("servidor: la receta trae su coste con fórmula y /api/sales los dos informes", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { randomUUID } = require("node:crypto");
  const { createApp } = require("../src/server.cjs");
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "value-http-"));
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
    const act = async (body) => {
      const r = await fetch(origin + "/api/action", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...body,
          operationId: randomUUID(),
          revision: (await get("/api/state")).state.revision,
        }),
      });
      assert.equal(r.status, 200, JSON.stringify(body));
    };
    let state = (await get("/api/state")).state;
    assert.equal(state.recipes[0].cost.source, "calculated");
    assert.ok(state.recipes[0].cost.lines.length > 0, "fórmula a la vista");
    const today = (await get("/api/sales")).to;
    await act({ type: "setManualCost", recipe: "r1", cents: 5000 });
    await act({
      type: "setSaleValue",
      recipe: "r1",
      cents: 10000,
      from: today,
    });
    await act({
      type: "dailySales",
      date: today,
      lines: [{ product: "p4", sold: 0.8, waste: 0.2 }],
    });
    const h = await get("/api/sales");
    assert.equal(h.value.sale.sold, 8000);
    assert.equal(h.value.sale.waste, 2000);
    assert.equal(h.value.cost.waste, 1000);
    // Persistido en SQLite: el historial de valores sobrevive a una recarga.
    state = (await get("/api/state")).state;
    assert.equal(state.recipes[0].saleValues[0].cents, 10000);
    assert.equal(state.recipes[0].cost.manual, 5000);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("una receta nueva da de alta su gelato sola: ya admite valor, ventas y mermas", () => {
  let s = seed();
  const suppliers = s.suppliers.length;
  s = apply(s, {
    type: "recipe",
    name: "Chocoloco",
    family: "crema",
    yield: 1,
    ingredients: [{ product: "p2", quantity: 0.5 }],
    createProduct: true,
  });
  const r = s.recipes.find((x) => x.name === "Chocoloco");
  const made = s.products.find((p) => p.id === r.product);
  assert.deepEqual(
    [made.name, made.unit, made.stock, made.min, made.target, made.price],
    ["Chocoloco", "kg", 0, 0, 0, 0],
  );
  assert.equal(
    s.suppliers.length,
    suppliers + 1,
    "proveedor «Elaboración propia»",
  );
  assert.match(s.activity[0].text, /queda dado de alta como gelato en stock/);
  // Nunca se propone comprarlo: mínimo y objetivo 0.
  s = apply(s, { type: "suggest" });
  assert.ok(!s.cart.some((l) => l.product === made.id));
  // El camino completo que fallaba: valor, producción, venta y merma.
  s = apply(s, {
    type: "setSaleValue",
    recipe: r.id,
    cents: 10000,
    from: "2026-09-01",
  });
  s = apply(s, {
    type: "produce",
    recipe: r.id,
    quantity: 1,
    date: "2026-09-10",
  });
  const p = s.productions.find((x) => x.status === "proposed");
  s = apply(s, { type: "applyProduction", id: p.id, lines: p.lines, note: "" });
  s = apply(s, {
    type: "dailySales",
    date: "2026-09-10",
    lines: [{ product: made.id, sold: 0.8, waste: 0.2 }],
  });
  const v = valueReport(s, "2026-09-10", "2026-09-10");
  assert.deepEqual([v.sale.sold, v.sale.waste], [8000, 2000]);
  // Una receta ya existente sin gelato se activa igual; la segunda vez no duplica nada.
  const { id, saleValues, manualCost, ...fields } = r;
  const again = apply(s, {
    type: "recipe",
    id,
    ...fields,
    createProduct: true,
  });
  assert.equal(again.products.length, s.products.length);
  assert.equal(again.suppliers.length, s.suppliers.length);
  validate(again);
});
