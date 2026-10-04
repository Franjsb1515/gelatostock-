const test = require("node:test");
const assert = require("node:assert/strict");
const {
  apply,
  seed,
  needed,
  daySummary,
  localDate,
  weeklyReport,
  weekStart,
  recipeBalance,
  readPriceChange,
} = require("../build/domain.js");

// Auditoría 0.47.0: cada prueba reproduce un fallo encontrado y comprueba su arreglo.
const dayOffset = (n) =>
  localDate(new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000));
const today = dayOffset(0);
const yesterday = dayOffset(-1);
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

test("«Revertir» no deshace una línea de un día cerrado ni la salida de una producción", () => {
  let s = seed();
  s = produce(s, 1, today);
  s = apply(s, {
    type: "dailySales",
    date: today,
    lines: [{ product: "p4", sold: 2, waste: 0, gift: 0 }],
  });
  s = apply(s, { type: "confirmDay", date: today });
  const sale = s.movements.find((m) => m.reason.startsWith("Venta del día"));
  // Antes se aceptaba y el día cerrado dejaba de cuadrar con su instantánea.
  assert.throws(
    () => apply(s, { type: "reverse", id: sale.id, reason: "prueba" }),
    /línea del cierre del día/,
  );
  const output = s.movements.find((m) => m.kind === "output");
  assert.throws(
    () => apply(s, { type: "reverse", id: output.id, reason: "prueba" }),
    /gelato hecho en una producción/,
  );
  assert.equal(daySummary(s, today).drift, false);
  // Un movimiento suelto de Inventario se sigue pudiendo revertir.
  const milk = stock(s, "p2");
  s = apply(s, {
    type: "movement",
    product: "p2",
    kind: "exit",
    value: 1,
    reason: "prueba",
  });
  const exit = s.movements.find((m) => m.kind === "exit" && m.product === "p2");
  s = apply(s, { type: "reverse", id: exit.id, reason: "me equivoqué" });
  assert.equal(stock(s, "p2"), milk);
});

test("cerrar ayer pesando la cubeta resta de lo que había ayer, no del stock de hoy", () => {
  let s = seed();
  const had = stock(s); // 7,5 kg al acabar ayer
  s = produce(s, 2, today); // hoy se producen 2 kg más
  s = apply(s, {
    type: "dailySales",
    date: yesterday,
    lines: [{ product: "p4", remaining: 1, waste: 0, gift: 0 }],
  });
  const sale = s.movements.find((m) =>
    m.reason.startsWith("Venta del día " + yesterday),
  );
  // Antes: 9,5 − 1 = 8,5 kg vendidos y «queda para mañana» negativo.
  assert.equal(-sale.delta, Math.round((had - 1) * 1000) / 1000);
});

test("pedido sugerido: 2,1 kg en paquetes de 0,7 son 3 paquetes, no 4", () => {
  const s = { orders: [] };
  assert.equal(needed(s, { id: "x", target: 3, stock: 0.9, pack: 0.7 }), 3);
});

test("la Semana no suma kilos, litros y unidades de merma", () => {
  let s = seed();
  s = apply(s, {
    type: "movement",
    product: "p2",
    kind: "waste",
    value: 3,
    reason: "",
    wasteReason: "expiry",
  });
  s = apply(s, {
    type: "movement",
    product: "p6",
    kind: "waste",
    value: 10,
    reason: "",
    wasteReason: "accident",
  });
  s = apply(s, {
    type: "movement",
    product: "p1",
    kind: "waste",
    value: 0.5,
    reason: "",
    wasteReason: "expiry",
  });
  const r = weeklyReport(s, weekStart(new Date()));
  // Antes: 13,5 «kg».
  assert.equal(r.totals.waste, 0.5);
  assert.deepEqual(r.totals.wasteOther, [
    { unit: "L", quantity: 3 },
    { unit: "ud", quantity: 10 },
  ]);
  assert.equal(
    r.days.reduce((n, d) => n + d.waste, 0),
    0.5,
  );
});

test("cambiar el motivo de una merma de gelato conserva el detalle escrito", () => {
  let s = seed();
  s = apply(s, {
    type: "movement",
    product: "p4",
    kind: "waste",
    value: 0.2,
    reason: "cambio de turno tarde",
    wasteReason: "expiry",
    date: today,
  });
  const waste = s.movements.find(
    (m) => m.kind === "waste" && m.product === "p4",
  );
  s = apply(s, {
    type: "editCloseLine",
    id: waste.id,
    quantity: 0.2,
    wasteReason: "texture",
  });
  const edited = s.movements.find(
    (m) =>
      m.kind === "waste" &&
      m.product === "p4" &&
      !m.reverses &&
      m.id !== waste.id,
  );
  assert.match(
    edited.reason,
    /^Merma del día \d{4}-\d{2}-\d{2} · Textura o cristalización · cambio de turno tarde$/,
  );
});

test("precio en un mensaje: con porcentaje o con miles no se propone nada equivocado", () => {
  assert.equal(readPriceChange("El precio de 12 € sube un 5 %"), undefined);
  assert.equal(readPriceChange("El precio sube el 5 por ciento"), undefined);
  assert.equal(readPriceChange("Nuevo precio 1.250,00 €"), undefined);
  assert.deepEqual(readPriceChange("La nata cuesta 3,40 €"), {
    to: 340,
    hint: "3,40 €",
  });
});

test("equilibrio: un dato que falta en la ficha no cuenta como 0", () => {
  const s = seed();
  const r = s.recipes[0];
  const p = s.products.find((x) => x.id === r.ingredients[0].product);
  p.composition = { sugars: p.composition?.sugars ?? 5 };
  const b = recipeBalance(s, r);
  assert.equal(b.complete, false);
  assert.equal(b.flags.find((f) => f.key === "fat").status, "unknown");
});
