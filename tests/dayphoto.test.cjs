const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const domain = require("../build/domain.js");
const { apply, seed } = domain;
const { readDayPhoto, findDates } = require("../build/dayphoto.js");
const { dayCard } = require("../build/calendar.js");
const { Store } = require("../build/store.js");
const { recognizeLocal } = require("../src/ocr.cjs");
const {
  today,
  cases,
  photoState,
  score,
} = require("./fixtures/fotos-calendario/casos.cjs");
const texts = require("./fixtures/fotos-calendario/textos.json");

const dir = path.join(__dirname, "fixtures", "fotos-calendario");
const read = (text, confidence = 90) =>
  readDayPhoto(photoState(domain), text, confidence, today);
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

test("fotos de prueba (texto leído guardado): ninguna propuesta inventa nada", () => {
  const s = photoState(domain);
  const results = cases.map((c) => {
    const t = texts[c.file];
    return {
      file: c.file,
      ...score(c, readDayPhoto(s, t.text, t.confidence, today)),
    };
  });
  assert.deepEqual(
    results.filter((r) => r.invented).map((r) => r.file),
    [],
  );
  // Las que ya se leen bien no deben empeorar (las demás fallan por la lectura de la foto:
  // puntos de relleno de un ticket y letra a mano imitada; ver el informe de la 0.50.0).
  assert.deepEqual(
    results.filter((r) => !r.ok).map((r) => r.file),
    [
      "03-horario-a-mano.jpg",
      "05-ventas-impreso.jpg",
      "06-ventas-a-mano.jpg",
      "09-nota-a-mano.jpg",
    ],
  );
});

test("lectura real de una foto ladeada con ruido: cuadrante de turnos de la semana", async () => {
  const bytes = fs.readFileSync(path.join(dir, "04-cuadrante-turnos.jpg"));
  const ocr = await recognizeLocal(
    "data:image/jpeg;base64," + bytes.toString("base64"),
  );
  const r = readDayPhoto(photoState(domain), ocr.text, ocr.confidence, today);
  assert.deepEqual(score(cases[3], r), {
    ok: true,
    problems: [],
    invented: false,
  });
});

test("fechas: escritas de varias formas; una fecha imposible o ausente no se adivina", () => {
  const d = (t) => findDates(t, today).map((x) => x.date);
  assert.deepEqual(d("Cierre 03/10/2026"), ["2026-10-03"]);
  assert.deepEqual(d("albarán 1-10-26"), ["2026-10-01"]);
  assert.deepEqual(d("lunes 6 de octubre de 2026"), ["2026-10-06"]);
  assert.deepEqual(d("semana del 12. al 18 de octubre"), [
    "2026-10-12",
    "2026-10-18",
  ]);
  assert.deepEqual(d("6 oct"), ["2026-10-06"]);
  assert.deepEqual(d("31/02/2026"), []);
  assert.deepEqual(d("Martes 11-23 Ana 10-17"), []);
  // Sin año: se propone el de hoy y se dice.
  assert.match(
    read("Nota\n6 de octubre\nLlamar al técnico").reasons.join(" "),
    /no dice el año/,
  );
  assert.equal(read("Recordatorio: pedir conos y vasos.").date, null);
});

test("horario: el día propuesto es el lunes de la semana; una hora rota no se convierte en turno", () => {
  const r = read(
    "Horario 8/10/2026\nLunes cerrado\nMartes 11:00-23:00 Ana 10:30-17 Luis 17-23:30\nMiércoles 11-23 Ana 1017 Marta 17-23",
  );
  assert.equal(r.kind, "schedule");
  assert.equal(r.date, "2026-10-05");
  assert.deepEqual(r.schedule[1], {
    weekday: 1,
    closed: false,
    open: "11:00",
    close: "23:00",
    shifts: [
      { person: "Ana", from: "10:30", to: "17:00" },
      { person: "Luis", from: "17:00", to: "23:30" },
    ],
  });
  assert.deepEqual(r.schedule[2].shifts, [
    { person: "Marta", from: "17:00", to: "23:00" },
  ]);
  assert.match(
    r.skipped.join(" "),
    /Miércoles: no se entiende «Ana 1017 Marta»/,
  );
});

test("ventas: gramos a kilos, merma e invitación aparte, y lo dudoso se dice sin apuntarlo", () => {
  const r = read(
    "Ventas 3/10/2026\nPistacho 2,5 kg\nStracciatella 900 g\nFior di latte 1 kg merma 0,2 kg invitación 0,1 kg\nChocolate 70% 275 kg\nMango 1 kg\nGelato de chocolate",
  );
  assert.equal(r.kind, "sales");
  assert.equal(r.date, "2026-10-03");
  assert.deepEqual(
    r.sales.map((l) => [l.name, l.sold, l.waste, l.gift]),
    [
      ["Pistacho", 2.5, 0, 0],
      ["Stracciatella", 0.9, 0, 0],
      ["Fior di latte", 1, 0.2, 0.1],
    ],
  );
  assert.deepEqual(r.unknown, ["Mango 1 kg"]);
  assert.equal(r.skipped.length, 2);
  assert.match(r.skipped[0], /parece mal leída/);
  assert.match(r.skipped[1], /no se lee la cantidad/);
});

test("documento de proveedor y foto ilegible", () => {
  const doc = read(
    "FACTURA F-1\nGelato Italia S.L.\nFecha: 02/10/2026\nTOTAL 99,00",
  );
  assert.equal(doc.kind, "document");
  assert.equal(doc.document.supplier, "s3");
  assert.equal(doc.date, "2026-10-02");
  const none = read("~ - ] E", 20);
  assert.equal(none.kind, null);
  assert.equal(none.note, "");
});

test("foto del Calendario: se guarda en su día con su nota, fuera de Documentos, y no toca el stock", () => {
  let s = seed();
  const stock = s.products.map((p) => p.stock);
  s = apply(s, {
    type: "calendarPhoto",
    date: "2026-10-06",
    name: "nota.png",
    data: png,
    ocrText: "Viene el técnico",
    note: "Viene el técnico a las 10",
  });
  assert.deepEqual(
    s.products.map((p) => p.stock),
    stock,
  );
  assert.equal(s.photos[0].calendarDate, "2026-10-06");
  assert.equal(s.photos[0].supplier, undefined);
  const card = dayCard(s, "2026-10-06", 5, "2026-10-10");
  assert.equal(card.notes.length, 1);
  assert.equal(card.notes[0].photo, s.photos[0].id);
  // Quitar la nota de una foto quita el texto; la foto se queda.
  s = apply(s, { type: "removeDayNote", id: card.notes[0].id });
  assert.equal(s.dayNotes[0].text, "");
  assert.equal(s.photos.length, 1);
  s = apply(s, { type: "addDayNote", date: "2026-10-06", text: "Llamar" });
  s = apply(s, { type: "removeDayNote", id: s.dayNotes[0].id });
  assert.equal(s.dayNotes.length, 1);
  assert.throws(
    () =>
      apply(s, {
        type: "calendarPhoto",
        date: "2026-10-06",
        name: "x.pdf",
        data: "data:application/pdf;base64,JVBERi0=",
      }),
    /se suben fotos/,
  );
});

test("la foto del Calendario se guarda como archivo y vuelve al abrir la base", () => {
  const tmp = fs.mkdtempSync(path.join(__dirname, "..", "work", "calfoto-"));
  try {
    let store = new Store(tmp);
    store.dispatch({
      type: "calendarPhoto",
      date: "2026-10-06",
      name: "nota.png",
      data: png,
      note: "Prueba",
      revision: store.load().revision,
    });
    store.close();
    store = new Store(tmp);
    const s = store.load();
    assert.equal(s.photos[0].calendarDate, "2026-10-06");
    assert.ok(s.photos[0].file);
    assert.equal(s.dayNotes[0].text, "Prueba");
    store.close();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
