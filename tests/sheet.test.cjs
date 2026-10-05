const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { apply, seed } = require("../build/domain.js");
const { productionSheet } = require("../build/sheet.js");
const { Store } = require("../build/store.js");

// Días fijos del pasado: el lunes 7 de septiembre de 2026 y los siguientes.
const D = "2026-09-08"; // martes
const PREV = "2026-09-07"; // lunes
const NEXT = "2026-09-09";
const TODAY = "2026-09-13"; // domingo de esa semana
const weigh = (s, date, lines, unit = "kg") =>
  apply(s, { type: "setWeighings", date, unit, lines });
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
const row = (sheet, product = "p4") =>
  sheet.rows.find((r) => r.product === product);

test("pesadas: gramos y kilos se guardan en kg sin errores; lo imposible se rechaza", () => {
  let s = weigh(seed(), D, [{ product: "p4", value: 8000 }], "g");
  assert.equal(s.weighings[0].kg, 8);
  s = weigh(s, D, [{ product: "p4", value: 2.345 }]);
  assert.equal(
    s.weighings.length,
    1,
    "la misma pesada se sustituye, no se duplica",
  );
  assert.equal(s.weighings[0].kg, 2.345);
  s = weigh(s, D, [{ product: "p4", value: 1234 }], "g");
  assert.equal(s.weighings[0].kg, 1.234);
  assert.throws(
    () => weigh(s, D, [{ product: "p4", value: 12.5 }], "g"),
    /sin decimales/,
  );
  assert.throws(
    () => weigh(s, D, [{ product: "p4", value: 1.2345 }]),
    /tres decimales/,
  );
  assert.throws(() => weigh(s, D, [{ product: "p4", value: 600 }]), /500 kg/);
  assert.throws(
    () => weigh(s, D, [{ product: "p4", value: -1 }]),
    /Revisa los datos/,
  );
  assert.throws(
    () => weigh(s, "2099-01-01", [{ product: "p4", value: 1 }]),
    /no ha llegado/,
  );
  assert.throws(
    () => weigh(s, D, [{ product: "p2", value: 1 }]),
    /no es un gelato/,
  );
  // Pesar no cambia el stock.
  assert.equal(
    s.products.find((p) => p.id === "p4").stock,
    seed().products.find((p) => p.id === "p4").stock,
  );
  s = weigh(s, D, [{ product: "p4", value: null }]);
  assert.equal(s.weighings.length, 0);
});

test("venta estimada por sabor con cada componente, facturación con su precio y con el de referencia", () => {
  let s = seed();
  s = apply(s, {
    type: "setSaleValue",
    recipe: "r1",
    cents: 4000,
    from: "2026-01-01",
  });
  s = apply(s, { type: "setReferencePrice", cents: 5000, from: "2026-01-01" });
  s = weigh(s, D, [{ product: "p4", value: 5 }]);
  s = produce(s, 3, D);
  s = apply(s, {
    type: "dailySales",
    date: D,
    lines: [
      {
        product: "p4",
        sold: 1.5,
        waste: 0.2,
        gift: 0.1,
        wasteReason: "texture",
      },
    ],
  });
  s = weigh(s, NEXT, [{ product: "p4", value: 6 }]);
  const sheet = productionSheet(s, D, TODAY);
  const r = row(sheet);
  assert.deepEqual(
    [r.start, r.produced, r.end, r.waste, r.gift, r.moved, r.sold],
    [5, 3, 6, 0.2, 0.1, 0, 1.7],
  );
  // La venta apuntada va aparte y se dice la diferencia; no se suma a la estimación.
  assert.equal(r.registered, 1.5);
  assert.equal(r.difference, -0.2);
  assert.equal(r.soldCents, 6800);
  assert.equal(r.referenceCents, 8500);
  assert.equal(sheet.totals.gelato.sold, 1.7);
  assert.equal(sheet.totals.all.soldCents, 6800);
  assert.equal(sheet.totals.all.referenceCents, 8500);
  // Sin precio del sabor, su facturación es «No disponible», nunca 0.
  const noValue = productionSheet(
    weigh(produce(seed(), 3, D), D, [{ product: "p4", value: 5 }]),
    PREV,
    TODAY,
  );
  assert.equal(row(noValue).soldCents, null);
});

test("si falta una pesada no hay estimación: se dice cuál falta; un sabor sin datos no cuenta", () => {
  let s = apply(seed(), {
    type: "quickFlavors",
    family: "sorbete",
    names: ["Limone"],
  });
  s = weigh(s, D, [{ product: "p4", value: 5 }]);
  const sheet = productionSheet(s, D, TODAY);
  const r = row(sheet);
  assert.equal(r.sold, null);
  assert.match(r.missing.join(" "), /pesada de la mañana del 09\/09\/2026/);
  assert.equal(sheet.totals.all.sold, null);
  assert.deepEqual(sheet.totals.all.missing, ["Chocolate 70 %"]);
  const limone = sheet.rows.find((x) => x.name === "Limone");
  assert.equal(limone.family, "sorbetto");
  assert.equal(limone.noData, true);
  assert.equal(sheet.totals.sorbetto.sold, 0);
  // Hoy: la pesada de mañana aún no ha llegado.
  const today = productionSheet(s, D, D);
  assert.match(row(today).missing.join(" "), /aún no ha llegado/);
});

test("un conteo no entra en la cuenta; una cuenta negativa se marca como imposible", () => {
  const { businessDay } = require("../build/domain.js");
  const hoy = businessDay(new Date());
  let s = weigh(seed(), hoy, [{ product: "p4", value: 2 }]);
  // Un conteo de hoy (el libro dice 9 kg) no cambia lo vendido: la cubeta no se movió.
  s = apply(s, { type: "count", product: "p4", value: 9, reason: "Conteo" });
  const counted = row(productionSheet(s, hoy, hoy));
  assert.equal(counted.counted, true);
  assert.equal(counted.moved, 0);
  // Una pesada del día siguiente mayor que lo que había sin producir: imposible.
  s = weigh(s, D, [{ product: "p4", value: 2 }]);
  s = weigh(s, NEXT, [{ product: "p4", value: 3 }]);
  const r = row(productionSheet(s, D, TODAY));
  assert.equal(r.sold, -1);
  assert.equal(r.impossible, true);
});

test("resúmenes: día anterior, semana de lunes a domingo e histórico desde el primer dato", () => {
  let s = seed();
  s = weigh(s, PREV, [{ product: "p4", value: 4 }]);
  s = produce(s, 2, PREV);
  s = weigh(s, D, [{ product: "p4", value: 5 }]);
  s = produce(s, 3, D);
  s = weigh(s, NEXT, [{ product: "p4", value: 6 }]);
  const sheet = productionSheet(s, D, TODAY);
  assert.equal(sheet.previous.produced, 2);
  assert.equal(sheet.previous.sold, 1); // 4 + 2 − 5
  assert.deepEqual(
    [sheet.week.from, sheet.week.to, sheet.week.produced, sheet.week.sold],
    [PREV, TODAY, 5, 3], // 1 el lunes y 2 el martes (5 + 3 − 6)
  );
  // El miércoles tiene pesada (dato) pero no producción ni pesada del jueves.
  assert.equal(sheet.week.daysProduced, 2);
  assert.equal(sheet.week.daysZero, 1);
  assert.equal(sheet.week.daysMissing, 1);
  assert.equal(sheet.week.daysNoData, 4);
  assert.equal(sheet.history.from, PREV);
  assert.equal(sheet.history.to, D);
  assert.equal(sheet.history.produced, 5);
});

test("alta rápida de sabores: sin ingredientes, se producen y su coste es «No disponible»", () => {
  let s = apply(seed(), {
    type: "quickFlavors",
    family: "crema",
    names: ["Fior di panna", "Pistacho siciliano", "fior di panna"],
  });
  const fior = s.recipes.find((r) => r.name === "Fior di panna");
  assert.deepEqual(fior.ingredients, []);
  assert.equal(
    s.recipes.filter((r) => r.name.toLowerCase() === "fior di panna").length,
    1,
  );
  // «Pistacho siciliano» ya era un ingrediente: no se crea otro con el mismo nombre.
  assert.equal(
    s.recipes.some((r) => r.name === "Pistacho siciliano"),
    false,
  );
  s = apply(s, { type: "produce", recipe: fior.id, quantity: 4, date: D });
  const p = s.productions.find((x) => x.status === "proposed");
  s = apply(s, { type: "applyProduction", id: p.id, lines: p.lines, note: "" });
  assert.equal(s.products.find((x) => x.id === fior.product).stock, 4);
  assert.equal(s.productions.find((x) => x.id === p.id).cost, undefined);
  assert.throws(
    () =>
      apply(s, {
        type: "quickFlavors",
        family: "crema",
        names: ["Fior di panna"],
      }),
    /ya existían/,
  );
});

test("pesadas y precio de referencia se guardan y vuelven al abrir la base", () => {
  const dir = fs.mkdtempSync(path.join(__dirname, "..", "work", "sheet-"));
  try {
    let store = new Store(dir);
    store.dispatch({
      type: "setWeighings",
      date: D,
      unit: "g",
      lines: [{ product: "p4", value: 8000 }],
      revision: store.load().revision,
    });
    store.dispatch({
      type: "setReferencePrice",
      cents: 3800,
      from: "2026-09-01",
      revision: store.load().revision,
    });
    store.close();
    store = new Store(dir);
    const s = store.load();
    assert.equal(s.weighings[0].kg, 8);
    assert.equal(s.referencePrices[0].cents, 3800);
    assert.equal(productionSheet(s, D, TODAY).rows[0].start, 8);
    store.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("igualar el stock a la pesada de hoy: conteo solo en sabores sin movimientos hoy", () => {
  const { businessDay } = require("../build/domain.js");
  const hoy = businessDay(new Date());
  let s = apply(seed(), {
    type: "quickFlavors",
    family: "crema",
    names: ["Yogurt"],
  });
  const yogurt = s.recipes.find((r) => r.name === "Yogurt").product;
  s = weigh(s, hoy, [
    { product: yogurt, value: 5 },
    { product: "p4", value: 7 },
  ]);
  // Chocolate ya se movió hoy (una producción): no se toca.
  s = produce(s, 1, hoy);
  const before = productionSheet(s, hoy, hoy);
  assert.equal(before.rows.find((r) => r.product === yogurt).book, 0);
  s = apply(s, { type: "weighingCounts", date: hoy });
  assert.equal(s.products.find((p) => p.id === yogurt).stock, 5);
  assert.equal(s.movements[0].kind, "count");
  assert.match(
    s.activity[0].text,
    /ya tuvieron movimientos hoy: Chocolate 70 %/,
  );
  assert.throws(
    () => apply(s, { type: "weighingCounts", date: "2026-09-08" }),
    /Solo la pesada de hoy/,
  );
});

test("tras igualar el stock a la pesada, la app y la pesada coinciden y se puede seguir el día", () => {
  const { businessDay } = require("../build/domain.js");
  const hoy = businessDay(new Date());
  let s = apply(seed(), {
    type: "quickFlavors",
    family: "crema",
    names: ["Yogurt"],
  });
  const yogurt = s.recipes.find((r) => r.name === "Yogurt").product;
  s = weigh(s, hoy, [{ product: yogurt, value: 5 }]);
  assert.equal(
    productionSheet(s, hoy, hoy).rows.find((r) => r.product === yogurt).book,
    0,
  );
  s = apply(s, { type: "weighingCounts", date: hoy });
  const r = productionSheet(s, hoy, hoy).rows.find((x) => x.product === yogurt);
  assert.equal(r.book, 5);
  assert.equal(r.start, 5);
});
