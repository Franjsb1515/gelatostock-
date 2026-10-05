const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, seed } = require("../build/domain.js");
const { productionSheet } = require("../build/sheet.js");

const D = "2026-10-05";
const stock = (s, id) => s.products.find((p) => p.id === id).stock;
/** Una base blanca (receta de familia «base» con su producto) y un sabor que la usa. */
function withBase() {
  let s = apply(seed(), {
    type: "recipe",
    name: "Base blanca",
    family: "base",
    yield: 1,
    createProduct: true,
    ingredients: [
      { product: "p2", quantity: 0.6 },
      { product: "p10", quantity: 0.2 },
    ],
  });
  const base = s.recipes.find((r) => r.name === "Base blanca");
  s = apply(s, {
    type: "recipe",
    name: "Fior di panna",
    family: "crema",
    yield: 1,
    createProduct: true,
    ingredients: [
      { product: base.product, quantity: 0.86 },
      { product: "p10", quantity: 0.1 },
    ],
  });
  const fior = s.recipes.find((r) => r.name === "Fior di panna");
  return { s, base, fior };
}

test("«Hecho» registra la tanda en un paso: consumo de la receta y gelato hecho", () => {
  let s = seed();
  const milk = stock(s, "p2");
  s = apply(s, { type: "produceNow", recipe: "r1", quantity: 4, date: D });
  const p = s.productions[0];
  assert.equal(p.status, "applied");
  assert.equal(s.productions.filter((x) => x.status === "proposed").length, 0);
  assert.equal(stock(s, "p2"), Math.round((milk - 2) * 1000) / 1000);
  assert.equal(
    stock(s, "p4"),
    seed().products.find((x) => x.id === "p4").stock + 4,
  );
  assert.match(s.activity[0].text, /^Hecho: 4 kg/);
  // Con lo que de verdad se usó (menos leche).
  s = apply(s, {
    type: "produceNow",
    recipe: "r1",
    quantity: 1,
    date: D,
    lines: [
      { product: "p2", quantity: 0.4 },
      { product: "p10", quantity: 0.2 },
    ],
  });
  assert.equal(s.productions[0].lines[0].quantity, 0.4);
  assert.throws(
    () =>
      apply(s, {
        type: "produceNow",
        recipe: "r1",
        quantity: 1,
        date: D,
        lines: [{ product: "p1", quantity: 1 }],
      }),
    /ingredientes de la receta/,
  );
});

test("si la app no tiene bastante, la producción se registra y el ingrediente queda en negativo con aviso; vender no puede", () => {
  let s = seed();
  s = apply(s, { type: "produceNow", recipe: "r1", quantity: 40, date: D });
  assert.ok(stock(s, "p2") < 0, "la leche queda en negativo");
  assert.match(s.activity[0].text, /queda en negativo: Leche entera/);
  // Una salida, una venta o una merma siguen sin poder dejar negativos.
  assert.throws(
    () =>
      apply(s, {
        type: "movement",
        product: "p1",
        kind: "exit",
        value: 999,
        reason: "x",
      }),
    /negativo/,
  );
  assert.throws(() =>
    apply(s, {
      type: "dailySales",
      date: D,
      lines: [{ product: "p4", sold: 9999, waste: 0, gift: 0 }],
    }),
  );
});

test("bases: de la cámara se descuenta su stock; «hacerla ahora» la produce y la gasta en el momento", () => {
  let { s, base, fior } = withBase();
  // De la cámara, sin base hecha: la base queda en negativo (aviso).
  let a = apply(s, {
    type: "produceNow",
    recipe: fior.id,
    quantity: 1,
    date: D,
    bases: [{ product: base.product, mode: "stock" }],
  });
  assert.equal(stock(a, base.product), -0.86);
  // Hacerla ahora: se produce la base que pide la tanda (0,86 kg) y se gasta; la leche baja.
  const milk = stock(s, "p2");
  s = apply(s, {
    type: "produceNow",
    recipe: fior.id,
    quantity: 1,
    date: D,
    bases: [{ product: base.product, mode: "now" }],
  });
  assert.equal(stock(s, base.product), 0);
  assert.equal(stock(s, "p2"), Math.round((milk - 0.86 * 0.6) * 1000) / 1000);
  assert.equal(s.productions.filter((p) => p.status === "applied").length, 2);
  assert.match(s.activity[0].text, /Base hecha ahora: Base blanca 0.86 kg/);
  // La base no es un gelato de venta: no sale en la ficha de producción del día.
  const sheet = productionSheet(s, D, D);
  assert.equal(
    sheet.rows.some((r) => r.name === "Base blanca"),
    false,
  );
  assert.equal(
    sheet.rows.some((r) => r.name === "Fior di panna"),
    true,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "produceNow",
        recipe: fior.id,
        quantity: 1,
        date: D,
        bases: [{ product: "p2", mode: "now" }],
      }),
    /no es una base/,
  );
});

test("tandas por receta: se guardan ordenadas y sin repetir, y editar la receta no las borra", () => {
  let s = apply(seed(), {
    type: "setBatches",
    recipe: "r1",
    batches: [8, 1, 4, 4, 55],
  });
  assert.deepEqual(s.recipes[0].batches, [1, 4, 8, 55]);
  const { id, saleValues, batches, manualCost, ...fields } = s.recipes[0];
  s = apply(s, {
    type: "recipe",
    id,
    ...fields,
    name: "Gelato de chocolate negro",
  });
  assert.deepEqual(s.recipes[0].batches, [1, 4, 8, 55]);
});

test("orden de preparación: se guarda por receta, editar la receta no lo borra y quita el ingrediente que ya no está", () => {
  let s = apply(seed(), {
    type: "setProcess",
    recipe: "r1",
    steps: [
      { product: "p10", text: "Calentar a 45 °C" },
      { text: "Pasteurizar a 85 °C" },
      { product: "p2" },
    ],
  });
  assert.deepEqual(
    s.recipes[0].process.map((x) => x.product || x.text),
    ["p10", "Pasteurizar a 85 °C", "p2"],
  );
  // Un ingrediente que no es de la receta, o repetido, se rechaza.
  assert.throws(
    () =>
      apply(s, {
        type: "setProcess",
        recipe: "r1",
        steps: [{ product: "p1" }],
      }),
    /no está en la receta/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "setProcess",
        recipe: "r1",
        steps: [{ product: "p2" }, { product: "p2", text: "otra vez" }],
      }),
    /solo puede ir en un paso/,
  );
  // Editar la receta quitando la nata: su paso conserva la instrucción y pierde el ingrediente.
  const { id, saleValues, batches, manualCost, process, ...fields } =
    s.recipes[0];
  s = apply(s, {
    type: "recipe",
    id,
    ...fields,
    ingredients: [{ product: "p2", quantity: 0.5 }],
  });
  assert.deepEqual(s.recipes[0].process, [
    { text: "Calentar a 45 °C" },
    { text: "Pasteurizar a 85 °C" },
    { product: "p2", text: "" },
  ]);
  // No mueve stock ni cambia la receta; vacío = sin orden propio.
  s = apply(s, { type: "setProcess", recipe: "r1", steps: [] });
  assert.equal(s.recipes[0].process, undefined);
});
