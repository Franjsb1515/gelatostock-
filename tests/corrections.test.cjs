const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { apply, seed, salesHistory } = require("../build/domain.js");
const { createApp } = require("../src/server.cjs");

const stock = (s, id) => s.products.find((p) => p.id === id).stock;
const stocks = (s) =>
  Object.fromEntries(s.products.map((p) => [p.id, p.stock]));
// Produce and approve N kg of the demo recipe; returns the state and the production id.
function produced(s, quantity, date = "2026-09-08") {
  s = apply(s, { type: "produce", recipe: s.recipes[0].id, quantity, date });
  const p = s.productions[0];
  s = apply(s, { type: "applyProduction", id: p.id, lines: p.lines, note: "" });
  return [s, p.id];
}

test("fase 1: anular una producción duplicada devuelve todo a su sitio y deja rastro", () => {
  const start = seed();
  const before = stocks(start);
  const out = start.recipes[0].product;
  let [s, first] = produced(start, 2);
  let second;
  [s, second] = produced(s, 2);
  assert.equal(stock(s, out), before[out] + 4);
  const moves = s.movements.length;
  s = apply(s, { type: "voidProduction", id: second, reason: "duplicada" });
  assert.equal(
    stock(s, out),
    before[out] + 2,
    "sale solo lo de la producción anulada",
  );
  const voided = s.productions.find((p) => p.id === second);
  assert.equal(voided.status, "discarded");
  assert.ok(voided.voidedAt);
  assert.equal(voided.voidReason, "duplicada");
  assert.ok(
    s.movements.length > moves,
    "se compensa: los movimientos originales se conservan",
  );
  assert.match(s.activity[0].text, /anulada: duplicada/);
  // Anular también la primera deja el inventario exactamente como al empezar.
  s = apply(s, { type: "voidProduction", id: first });
  assert.deepEqual(stocks(s), before);
  assert.throws(
    () => apply(s, { type: "voidProduction", id: first }),
    /Solo se anula una producción aprobada/,
  );
});

test("fase 1: corregir una producción deja una propuesta igual; lo ya vendido bloquea con explicación", () => {
  const start = seed();
  const out = start.recipes[0].product;
  const base = stock(start, out);
  let [s, id] = produced(start, 3);
  s = apply(s, { type: "voidProduction", id, redo: true });
  const again = s.productions[0];
  assert.deepEqual(
    [again.status, again.quantity, again.date],
    ["proposed", 3, "2026-09-08"],
  );
  assert.equal(stock(s, out), base, "mientras se corrige, nada cuenta");
  // Se aprueba con el peso bueno: 2,5 kg en lugar de 3.
  s = apply(s, {
    type: "applyProduction",
    id: again.id,
    lines: again.lines,
    output: 2.5,
    note: "peso corregido",
  });
  assert.equal(stock(s, out), base + 2.5);
  // Se vende casi todo: ya no quedan los 2,5 kg, así que anular corrompería el stock.
  s = apply(s, {
    type: "dailySales",
    date: "2026-09-08",
    lines: [{ product: out, remaining: 1 }],
  });
  const snapshot = JSON.stringify(stocks(s));
  assert.throws(
    () => apply(s, { type: "voidProduction", id: again.id }),
    /ya solo quedan 1\. Parte se vendió o se tiró/,
  );
  assert.equal(JSON.stringify(stocks(s)), snapshot, "un bloqueo no toca nada");
  // Deshaciendo el cierre, la anulación vuelve a ser posible.
  s = apply(s, { type: "undoDailySales", date: "2026-09-08" });
  s = apply(s, { type: "voidProduction", id: again.id });
  assert.equal(stock(s, out), base);
});

test("fase 1: corregir y eliminar una línea del cierre recalcula stock, día e historial", () => {
  const out = seed().recipes[0].product;
  const base = stock(seed(), out);
  let s = apply(seed(), {
    type: "dailySales",
    date: "2026-09-08",
    lines: [{ product: out, sold: 1, waste: 0.25, wasteReason: "texture" }],
  });
  let day = salesHistory(s, "2026-09-08", "2026-09-08").days[0];
  assert.deepEqual(
    day.lines.map((l) => [l.kind, l.quantity, l.reason]).sort(),
    [
      ["sale", 1, ""],
      ["waste", 0.25, "Textura o cristalización"],
    ],
  );
  // El ejemplo del usuario: la balanza marcaba 150 g, no 250 g.
  const waste = day.lines.find((l) => l.kind === "waste");
  s = apply(s, { type: "editCloseLine", id: waste.id, quantity: 0.15 });
  assert.equal(
    stock(s, out),
    Math.round((base - 1.15) * 1000) / 1000,
    "el stock recupera los 100 g",
  );
  assert.match(
    s.activity[0].text,
    /Merma corregida: .* de 0.25 a 0.15 kg \(2026-09-08\)\. Stock disponible/,
  );
  day = salesHistory(s, "2026-09-08", "2026-09-08").days[0];
  assert.deepEqual([day.sold, day.waste, day.wastePct], [1, 0.15, 13]);
  assert.equal(
    day.lines.find((l) => l.kind === "waste").reason,
    "Textura o cristalización",
    "el motivo se conserva",
  );
  assert.equal(
    day.lines.length,
    2,
    "ninguna pantalla sigue viendo la línea vieja",
  );
  // Cambiar también el motivo.
  s = apply(s, {
    type: "editCloseLine",
    id: day.lines.find((l) => l.kind === "waste").id,
    quantity: 0.15,
    wasteReason: "accident",
  });
  day = salesHistory(s, "2026-09-08", "2026-09-08").days[0];
  assert.equal(
    day.lines.find((l) => l.kind === "waste").reason,
    "Caída o rotura",
  );
  // Eliminar la venta: solo queda la merma.
  s = apply(s, {
    type: "undoCloseLine",
    id: day.lines.find((l) => l.kind === "sale").id,
  });
  day = salesHistory(s, "2026-09-08", "2026-09-08").days[0];
  assert.deepEqual([day.sold, day.waste, day.lines.length], [0, 0.15, 1]);
  assert.equal(stock(s, out), Math.round((base - 0.15) * 1000) / 1000);
  // Lo que no cuadra se rechaza; una línea ya compensada o ajena no se toca.
  const live = day.lines[0].id;
  assert.throws(
    () => apply(s, { type: "editCloseLine", id: live, quantity: 999 }),
    /es más de lo que había/,
  );
  assert.throws(() =>
    apply(s, { type: "editCloseLine", id: live, quantity: 0 }),
  );
  assert.throws(
    () => apply(s, { type: "undoCloseLine", id: waste.id }),
    /no pertenece a un cierre vigente/,
  );
  const manual = apply(s, {
    type: "movement",
    product: out,
    kind: "exit",
    value: 0.1,
    reason: "Salida manual",
  });
  assert.throws(
    () => apply(manual, { type: "undoCloseLine", id: manual.movements[0].id }),
    /no pertenece a un cierre vigente/,
  );
});

test("fase 1: el cambio de día de negocio se guarda, se valida y viaja a la interfaz", async () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "fase1-http-"));
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
    const post = (body) =>
      fetch(origin + "/api/maintenance", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    const state = await (
      await fetch(origin + "/api/state", { headers })
    ).json();
    assert.equal(state.dayChangeHour, 5, "por defecto, las 5:00");
    assert.equal((await post({ type: "dayChange", hour: 9 })).status, 400);
    assert.equal((await post({ type: "dayChange", hour: 2.5 })).status, 400);
    const saved = await (await post({ type: "dayChange", hour: 3 })).json();
    assert.equal(saved.dayChangeHour, 3);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
