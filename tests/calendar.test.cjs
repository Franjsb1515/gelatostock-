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

const monday = (day) => {
  const d = new Date(day + "T12:00:00Z");
  const x = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return x.toISOString().slice(0, 10);
};
const plus = (day, n) =>
  new Date(Date.parse(day + "T12:00:00Z") + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
const week = (start, edit = {}) =>
  Array.from({ length: 7 }, (_, i) => ({
    date: plus(start, i),
    closed: false,
    shifts: [],
    ...(edit[i] || {}),
  }));

test("horario de la semana: valida, guarda solo los días con algo y reemplaza la semana", () => {
  const w = monday("2026-10-07");
  assert.equal(w, "2026-10-05");
  let s = seed();
  const before = s.products.map((p) => p.stock);
  assert.throws(
    () =>
      apply(s, {
        type: "setWeekSchedule",
        week: plus(w, 1),
        days: week(plus(w, 1)),
      }),
    /empieza en lunes/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "setWeekSchedule",
        week: w,
        days: week(w, {
          0: {
            closed: true,
            shifts: [{ person: "Ana", from: "10:00", to: "14:00" }],
          },
        }),
      }),
    /cerrado/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "setWeekSchedule",
        week: w,
        days: week(w, { 1: { open: "11:00" } }),
      }),
    /abrir y la de cerrar/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "setWeekSchedule",
        week: w,
        days: week(w, { 1: { open: "25:00", close: "23:00" } }),
      }),
    /Hora inválida/,
  );
  s = apply(s, {
    type: "setWeekSchedule",
    week: w,
    days: week(w, {
      0: { closed: true },
      1: {
        open: "11:00",
        close: "00:30",
        shifts: [
          { person: "Ana", from: "10:30", to: "17:00" },
          { person: "Luis", from: "17:00", to: "00:30" },
        ],
      },
    }),
  });
  assert.equal(s.schedule.length, 2);
  assert.deepEqual(
    s.products.map((p) => p.stock),
    before,
  );
  const m = calendarMonth(s, "2026-10", 5, "2026-10-01");
  assert.deepEqual(m.days.find((d) => d.date === w).hours, {
    closed: true,
    open: null,
    close: null,
    shifts: 0,
  });
  assert.equal(m.days.find((d) => d.date === plus(w, 1)).hours.shifts, 2);
  assert.equal(dayCard(s, plus(w, 1)).schedule.shifts[1].person, "Luis");
  // Volver a guardar la semana sin el lunes lo quita: la semana se reemplaza entera.
  s = apply(s, {
    type: "setWeekSchedule",
    week: w,
    days: week(w, { 2: { open: "12:00", close: "22:00" } }),
  });
  assert.deepEqual(
    s.schedule.map((d) => d.date),
    [plus(w, 2)],
  );
});

test("vacaciones por persona: sin solapes, se quitan y avisan si hay turno", () => {
  const w = "2026-10-05";
  let s = apply(seed(), {
    type: "addVacation",
    person: "Ana",
    from: plus(w, 1),
    to: plus(w, 3),
    note: "",
  });
  assert.throws(
    () =>
      apply(s, {
        type: "addVacation",
        person: "ana ",
        from: plus(w, 3),
        to: plus(w, 9),
        note: "",
      }),
    /ya tiene vacaciones/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "addVacation",
        person: "Luis",
        from: plus(w, 3),
        to: plus(w, 1),
        note: "",
      }),
    /hasta/,
  );
  s = apply(s, {
    type: "setWeekSchedule",
    week: w,
    days: week(w, {
      2: {
        open: "11:00",
        close: "23:00",
        shifts: [{ person: "ANA", from: "11:00", to: "17:00" }],
      },
      4: { shifts: [{ person: "Luis", from: "09:00", to: "12:00" }] },
    }),
  });
  const c = dayCard(s, plus(w, 2), 5, "2026-10-01");
  assert.equal(c.vacations[0].person, "Ana");
  assert.deepEqual(
    c.alerts.map((a) => a.text),
    ["ANA tiene turno y está de vacaciones."],
  );
  const m = calendarMonth(s, "2026-10", 5, "2026-10-01");
  assert.deepEqual(m.days.find((d) => d.date === plus(w, 1)).away, ["Ana"]);
  assert.deepEqual(
    m.alerts.map((a) => [a.date, a.text]),
    [
      [plus(w, 2), "ANA tiene turno y está de vacaciones."],
      [plus(w, 4), "Hay turnos pero falta el horario de apertura."],
    ],
  );
  s = apply(s, { type: "removeVacation", id: s.vacations[0].id });
  assert.equal(dayCard(s, plus(w, 2), 5, "2026-10-01").alerts.length, 0);
  assert.throws(
    () => apply(s, { type: "removeVacation", id: "nada" }),
    /ya no están/,
  );
});

test("avisos del día: días pasados sin cierre o sin ventas, marca con producción y venta real lejos", () => {
  const twoAgo = dayOffset(-2);
  let s = apply(seed(), {
    type: "setSaleValue",
    recipe: "r1",
    cents: 4000,
    from: dayOffset(-30),
  });
  s = produce(s, 2, twoAgo);
  s = sell(s, twoAgo, 1);
  // Pasado con gelato y sin cierre confirmado.
  assert.deepEqual(
    dayCard(s, twoAgo).alerts.map((a) => a.text),
    ["Día pasado con gelato apuntado y sin cierre confirmado."],
  );
  // Ayer: después de la primera venta, sin ventas ni marca.
  assert.deepEqual(
    dayCard(s, yesterday).alerts.map((a) => a.text),
    ["Día pasado sin ventas apuntadas ni marca «La tienda no abrió»."],
  );
  // Antes de la primera venta no se pide nada; hoy tampoco.
  assert.equal(dayCard(s, dayOffset(-3)).alerts.length, 0);
  assert.equal(dayCard(s, today).alerts.length, 0);
  // La venta real lejos de la estimada (más de un 10 %) avisa al confirmar.
  const estimated = dayCard(s, twoAgo).summary.live.totals.soldCents;
  assert.ok(estimated > 0);
  s = apply(s, {
    type: "confirmDay",
    date: twoAgo,
    realSaleCents: Math.round(estimated * 0.5),
  });
  assert.match(
    dayCard(s, twoAgo)
      .alerts.map((a) => a.text)
      .join(" "),
    /más de un 10 %/,
  );
  // Ayer marcado sin abrir: el aviso de «sin ventas» se va; con producción, avisa.
  s = apply(s, { type: "markNotOpened", date: yesterday, reason: "" });
  assert.equal(dayCard(s, yesterday).alerts.length, 0);
  s = produce(s, 1, yesterday);
  assert.deepEqual(
    dayCard(s, yesterday).alerts.map((a) => a.text),
    [
      "Día pasado con gelato apuntado y sin cierre confirmado.",
      "Marcado «La tienda no abrió», pero tiene gelato hecho o mermado ese día.",
    ],
  );
});

test("stock al terminar el día: el de ahora menos lo de días posteriores; un día futuro no lo tiene", () => {
  let s = produce(seed(), 2, yesterday);
  s = produce(s, 1, today);
  const gelato = s.products.find((p) => p.id === "p4");
  const at = (date) =>
    dayCard(s, date).stock.find((p) => p.name === gelato.name);
  assert.equal(at(today).quantity, gelato.stock);
  assert.equal(
    at(yesterday).quantity,
    Math.round((gelato.stock - 1) * 1000) / 1000,
  );
  assert.equal(at(today).gelato, true);
  assert.equal(dayCard(s, dayOffset(1)).stock, null);
});

test("horario y vacaciones se guardan en la base y vuelven al abrirla", () => {
  const dir = fs.mkdtempSync(path.join(__dirname, "..", "work", "cal-"));
  try {
    let store = new Store(dir);
    store.dispatch({
      type: "setWeekSchedule",
      week: "2026-10-05",
      days: week("2026-10-05", { 3: { open: "11:00", close: "23:00" } }),
      revision: store.load().revision,
    });
    store.dispatch({
      type: "addVacation",
      person: "Ana",
      from: "2026-10-10",
      to: "2026-10-12",
      note: "Boda",
      revision: store.load().revision,
    });
    store.close();
    store = new Store(dir);
    const s = store.load();
    assert.equal(s.schedule[0].date, "2026-10-08");
    assert.equal(s.vacations[0].note, "Boda");
    store.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
