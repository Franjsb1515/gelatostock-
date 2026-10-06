const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { apply, seed } = require("../build/domain.js");
const { parseRoster } = require("../build/roster.js");
const { dayCard } = require("../build/calendar.js");
const { readTable } = require("../src/table-ocr.cjs");
const expected = require("./fixtures/fotos-calendario/cuadrante.cjs");

const dir = path.join(__dirname, "fixtures", "fotos-calendario");
const saved = (name) =>
  JSON.parse(fs.readFileSync(path.join(dir, name + ".lecturas.json"), "utf8"));
const text = (v) =>
  !v
    ? ""
    : [v.from ? `${v.from}-${v.to}` : "", v.label ?? ""]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase();
const want = (t) => t.replace(/(\d{2}:\d{2}) A (\d{2}:\d{2})/, "$1-$2");
/** Casillas bien y seguras, y las que salen MAL dadas por seguras (no puede haber ninguna). */
function score(r) {
  let ok = 0,
    sureBad = 0,
    flagged = 0;
  for (const p of expected.people.filter((x) => x.name)) {
    const got = r.people.find((x) => x.name.toUpperCase() === p.name);
    assert.ok(got, "falta " + p.name);
    p.cells.forEach((cell, i) => {
      const c = got.cells[i];
      const right = text(c.value) === want(cell);
      if (c.sure && right) ok++;
      else if (c.sure) sureBad++;
      else flagged++;
    });
  }
  return { ok, sureBad, flagged };
}

test("cuadrante (lecturas guardadas): fechas, año deducido por los días de la semana y personas", () => {
  for (const name of ["13-cuadrante", "14-cuadrante-grande"]) {
    const t = saved(name);
    const r = parseRoster(t.cells, "2026-10-05", [], t.regions, t.inks);
    assert.deepEqual(r.dates, expected.dates, name);
    assert.equal(r.month, 11);
    assert.match(r.yearReason, /días de la semana/);
    assert.deepEqual(
      r.people.map((p) => p.name),
      ["Lucia", "Pablo", "Sara", "Ivan"],
      name,
    );
    // Ninguna casilla mal leída se da por segura.
    assert.equal(score(r).sureBad, 0, name);
  }
  // La captura grande se lee entera; la pequeña deja marcado lo que no ve bien.
  const big = saved("14-cuadrante-grande");
  assert.deepEqual(
    score(parseRoster(big.cells, "2026-10-05", [], big.regions, big.inks)),
    { ok: 56, sureBad: 0, flagged: 0 },
  );
  const small = saved("13-cuadrante");
  const s = score(
    parseRoster(small.cells, "2026-10-05", [], small.regions, small.inks),
  );
  assert.ok(s.ok >= 45, JSON.stringify(s));
});

test("cuadrante: reglas de casillas (letras mal leídas, horas dudosas, tinta sin leer)", () => {
  const c = (text, conf = 90) => [{ text, conf }];
  const grid = [
    [[], [], c("LUNES"), c("MARTES"), c("MIERCOLES"), c("JUEVES")],
    [c("ENERO 2027"), [], c("4"), c("5"), c("6"), c("7")],
    [
      c("SALA"),
      c("ANA"),
      c("PRODNCCION"),
      [
        { text: "19:00 A 00:00", conf: 85 },
        { text: "18:00 A 00:00", conf: 88 },
      ],
      c("11:00 A 16:09"),
      [{ text: "", conf: 0 }],
    ],
    [c("CRUCEROS"), [], c("OO"), c("O"), c("OOO"), c("O")],
  ];
  const r = parseRoster(
    grid,
    "2026-10-05",
    [],
    [],
    [[], [], [0, 0, 9, 9, 9, 9]],
  );
  assert.deepEqual(r.dates, [
    "2027-01-04",
    "2027-01-05",
    "2027-01-06",
    "2027-01-07",
  ]);
  assert.match(r.yearReason, /escrito/);
  assert.equal(r.people.length, 1, "la fila de cruceros no es una persona");
  const [prod, time, odd, unread] = r.people[0].cells;
  assert.deepEqual([prod.value, prod.sure], [{ label: "Producción" }, true]);
  // Dos lecturas con horas distintas: se propone una, pero a revisar.
  assert.equal(time.sure, false);
  assert.deepEqual(time.options.sort(), ["18:00-00:00", "19:00-00:00"]);
  // Minutos raros (16:09): a revisar.
  assert.equal(odd.sure, false);
  // Con tinta y sin leer: vacío pero a revisar, nunca «vacío seguro».
  assert.deepEqual([unread.value, unread.sure], [null, false]);
  assert.equal(parseRoster([[c("hola")]], "2026-10-05"), null);
});

test("lectura real de un cuadrante sintético grande: cuadrícula y casillas", async () => {
  const t = await readTable(
    fs.readFileSync(path.join(dir, "14-cuadrante-grande.png")),
  );
  assert.equal(t.grid.rows.length - 1, 8);
  assert.equal(t.grid.cols.length - 1, 16);
  const r = parseRoster(t.cells, "2026-10-05", [], t.regions, t.inks);
  assert.equal(score(r).sureBad, 0);
});

test("turnos con nombre y horas opcionales; un cuadrante se guarda por días sin tocar el horario de apertura", () => {
  let s = apply(seed(), {
    type: "setWeekSchedule",
    week: "2026-11-02",
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-0${2 + i}`,
      closed: i === 6,
      ...(i === 0 ? { open: "11:00", close: "23:00" } : {}),
      shifts:
        i === 0
          ? [
              { person: "Sara", label: "Cierre" },
              { person: "Iván", from: "11:00", to: "16:00" },
            ]
          : [],
    })),
  });
  assert.throws(
    () =>
      apply(s, {
        type: "setScheduleDays",
        days: [{ date: "2026-11-03", shifts: [{ person: "Sara" }] }],
      }),
    /tipo o unas horas/,
  );
  s = apply(s, {
    type: "setScheduleDays",
    days: [
      {
        date: "2026-11-02",
        shifts: [
          { person: "Sara", label: "Apertura" },
          { person: "Pablo", label: "Libre" },
        ],
      },
      {
        date: "2026-11-03",
        shifts: [
          { person: "Sara", label: "Cierre", from: "17:00", to: "23:30" },
        ],
      },
    ],
  });
  const lunes = s.schedule.find((d) => d.date === "2026-11-02");
  assert.equal(lunes.open, "11:00", "el horario de apertura se conserva");
  assert.deepEqual(
    lunes.shifts.map((t) => t.label),
    ["Apertura", "Libre"],
  );
  // En un día cerrado no se ponen turnos de trabajo (un «Libre» sí).
  assert.throws(
    () =>
      apply(s, {
        type: "setScheduleDays",
        days: [
          {
            date: "2026-11-08",
            shifts: [{ person: "Sara", label: "Apertura" }],
          },
        ],
      }),
    /cerrado/,
  );
  // Quien libra no cuenta como turno: vacaciones de Pablo ese día no avisan.
  s = apply(s, {
    type: "addVacation",
    person: "Pablo",
    from: "2026-11-02",
    to: "2026-11-02",
    note: "",
  });
  assert.deepEqual(dayCard(s, "2026-11-02", 5, "2026-11-30").alerts, []);
});

test("cuadrante de una foto enderezada, borrosa o ampliada: lo dudoso nunca sale seguro", () => {
  const c = (text, conf = 90) => [{ text, conf }];
  const grid = [
    [[], [], c("LUNES"), c("MARTES"), c("MIERCOLES"), c("JUEVES")],
    [c("ENERO 2027"), [], c("4"), c("5"), c("6"), c("7")],
    [c("SALA"), c("ANA"), c("PRODUCCION"), c("LIBRE"), [], c("CIERRE")],
  ];
  const cells = (photo) =>
    parseRoster(grid, "2026-10-05", [], [], [], photo).people[0].cells;
  // Foto normal: la casilla sin tinta es «vacía y segura».
  assert.deepEqual(
    cells({}).map((x) => x.sure),
    [true, true, true, true],
  );
  // Girada y enderezada: misma lectura, y se dice.
  const turned = parseRoster(grid, "2026-10-05", [], [], [], { angle: 2.5 });
  assert.deepEqual(
    turned.people[0].cells.map((x) => x.sure),
    [true, true, true, true],
  );
  assert.ok(turned.problems.some((p) => /girada 2,5°: se enderezó/.test(p)));
  // Borrosa (líneas claras): la tinta engaña, así que la vacía queda para revisar.
  assert.deepEqual(
    cells({ blurry: true }).map((x) => x.sure),
    [true, true, false, true],
  );
  // Pequeña y ampliada: ninguna casilla es segura.
  assert.deepEqual(
    cells({ enlarged: 2 }).map((x) => x.sure),
    [false, false, false, false],
  );
});
