const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { apply, seed, localDate, todayBrief } = require("../build/domain.js");
const {
  calendarMonth,
  calendarYear,
  dayCard,
} = require("../build/calendar.js");
const { Store } = require("../build/store.js");

const dayOffset = (n) =>
  localDate(new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000));
const today = dayOffset(0);
const yesterday = dayOffset(-1);
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
const sell = (s, date, sold, waste = 0) =>
  apply(s, {
    type: "dailySales",
    date,
    lines: [
      {
        product: "p4",
        sold,
        waste,
        gift: 0,
        ...(waste ? { wasteReason: "expiry" } : {}),
      },
    ],
  });

test("calendario: el mes y el año suman lo mismo que los cierres, por día de negocio", () => {
  let s = produce(seed(), 2, today);
  s = sell(s, today, 0.8, 0.2);
  const m = calendarMonth(s, today.slice(0, 7));
  const d = m.days.find((x) => x.date === today);
  assert.equal(
    m.days.length,
    new Date(+today.slice(0, 4), +today.slice(5, 7), 0).getDate(),
  );
  assert.deepEqual([d.produced, d.sold, d.waste], [2, 0.8, 0.2]);
  assert.equal(m.totals.daysWithSales, 1);
  // Un día sin nada sale vacío, no estimado.
  const other = m.days.find((x) => x.date !== today);
  assert.deepEqual([other.sold, other.produced, other.notOpened], [0, 0, null]);
  const y = calendarYear(s, +today.slice(0, 4));
  const month = y.months.find((x) => x.month === today.slice(0, 7));
  assert.equal(y.months.length, 12);
  assert.deepEqual([month.sold, month.produced, month.waste], [0.8, 2, 0.2]);
  // Deshacer el cierre lo quita del calendario: un movimiento compensado no cuenta.
  s = apply(s, { type: "undoDailySales", date: today });
  assert.equal(calendarMonth(s, today.slice(0, 7)).totals.sold, 0);
  assert.throws(() => calendarMonth(s, "2026-13"), /Mes inválido/);
});

test("ficha del día: cierre, mermas por motivo, producciones y pedidos", () => {
  let s = produce(seed(), 1, today);
  s = sell(s, today, 0.5, 0.1);
  const c = dayCard(s, today);
  assert.equal(c.summary.date, today);
  assert.equal(c.productions.length, 1);
  assert.equal(c.waste.length, 1);
  assert.equal(c.waste[0].quantity, 0.1);
  assert.notEqual(c.waste[0].reason, "Sin motivo");
  assert.equal(c.notOpened, null);
  assert.throws(() => dayCard(s, "2026-02-31"), /Día inválido/);
});

test("la tienda no abrió: se marca y se quita sin tocar el stock, y bloquea apuntar ventas", () => {
  let s = seed();
  const before = s.products.map((p) => p.stock);
  s = apply(s, {
    type: "markNotOpened",
    date: yesterday,
    reason: "Vacaciones",
  });
  assert.deepEqual(
    s.products.map((p) => p.stock),
    before,
  );
  assert.equal(dayCard(s, yesterday).notOpened.reason, "Vacaciones");
  assert.ok(
    calendarMonth(s, yesterday.slice(0, 7)).days.find(
      (d) => d.date === yesterday,
    ).notOpened,
  );
  assert.throws(
    () => apply(s, { type: "markNotOpened", date: yesterday, reason: "" }),
    /ya está marcado/,
  );
  s = produce(s, 1, yesterday);
  assert.throws(() => sell(s, yesterday, 0.5), /no abrió/);
  // El aviso de «ayer sin cerrar» no salta en un día marcado.
  assert.equal(todayBrief(s, new Date()).yesterdayPending, null);
  s = apply(s, { type: "unmarkNotOpened", date: yesterday });
  assert.equal(todayBrief(s, new Date()).yesterdayPending, yesterday);
  s = sell(s, yesterday, 0.5);
  // Con ventas apuntadas no se puede marcar.
  assert.throws(
    () => apply(s, { type: "markNotOpened", date: yesterday, reason: "" }),
    /ventas apuntadas/,
  );
  assert.throws(
    () => apply(s, { type: "unmarkNotOpened", date: today }),
    /no estaba marcado/,
  );
});

test("la marca se guarda en la base y vuelve al abrirla", () => {
  const dir = fs.mkdtempSync(path.join(__dirname, "..", "work", "cal-"));
  try {
    let store = new Store(dir);
    store.dispatch({
      type: "markNotOpened",
      date: today,
      reason: "Avería",
      revision: store.load().revision,
    });
    store.close();
    store = new Store(dir);
    assert.equal(store.load().closures[0].reason, "Avería");
    store.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
