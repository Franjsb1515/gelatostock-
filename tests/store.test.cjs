const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Store } = require("../build/store.js");
const { seed } = require("../build/domain.js");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
function fixture(fn) {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "sqlite-test-"));
  const stores = [];
  try {
    fn(dir, () => {
      const s = new Store(dir);
      stores.push(s);
      return s;
    });
  } finally {
    for (const s of stores)
      try {
        s.close();
      } catch {}
    assert.ok(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
test("migración conserva JSON, datos y fotografías en adjuntos separados", () =>
  fixture((dir, open) => {
    const legacy = seed();
    legacy.products[0].stock = 6.25;
    legacy.photos.push({
      id: "photo-1",
      name: "foto.png",
      note: "Referencia",
      at: new Date().toISOString(),
      data: png,
    });
    const raw = JSON.stringify(legacy);
    fs.writeFileSync(path.join(dir, "stock.json"), raw);
    const store = open();
    assert.equal(store.load().products[0].stock, 6.25);
    assert.equal(store.load().photos[0].data, undefined);
    assert.ok(store.load().photos[0].file);
    assert.equal(store.exportState().photos[0].data, png);
    assert.equal(fs.readFileSync(path.join(dir, "stock.json"), "utf8"), raw);
    assert.ok(
      fs
        .readdirSync(path.join(dir, "backups"))
        .some((x) => x.startsWith("antes-sqlite")),
    );
  }));
test("JSON inválido no se reemplaza por datos de ejemplo", () =>
  fixture((dir, open) => {
    fs.writeFileSync(path.join(dir, "stock.json"), "broken");
    assert.throws(open);
    assert.equal(
      fs.readFileSync(path.join(dir, "stock.json"), "utf8"),
      "broken",
    );
  }));
test("un fallo a mitad de transacción revierte stock, movimiento y operación", () =>
  fixture((dir, open) => {
    const s = open();
    const before = s.load();
    s.db.exec(
      "CREATE TRIGGER fail_movement BEFORE INSERT ON movements BEGIN SELECT RAISE(ABORT,'injected failure'); END",
    );
    assert.throws(() =>
      s.dispatch({
        type: "count",
        product: "p1",
        value: 7,
        operationId: "fault-test",
      }),
    );
    assert.deepEqual(s.load(), before);
  }));
test("dos conexiones detectan versión obsoleta y no pisan cambios", () =>
  fixture((dir, open) => {
    const a = open(),
      b = open();
    const revision = b.load().revision;
    a.dispatch({ type: "count", product: "p1", value: 8, revision });
    assert.throws(
      () => b.dispatch({ type: "count", product: "p1", value: 9, revision }),
      /cambiaron/,
    );
    assert.equal(b.load().products[0].stock, 8);
  }));
test("idempotencia persiste al reiniciar y rechaza reutilizar ID con otro contenido", () =>
  fixture((dir, open) => {
    let a = open();
    const command = {
      type: "movement",
      product: "p1",
      kind: "entry",
      value: 1,
      reason: "Compra",
      operationId: "entry-1",
    };
    a.dispatch(command);
    a.close();
    a = open();
    const expected = a.load();
    assert.deepEqual(a.dispatch(command), expected);
    assert.throws(() => a.dispatch({ ...command, value: 2 }), /otra operación/);
  }));
test("adjuntos se deduplican por contenido y las copias son portables", () =>
  fixture((dir, open) => {
    const s = open();
    s.dispatch({ type: "photo", name: "uno.png", data: png });
    s.dispatch({ type: "photo", name: "dos.png", data: png });
    assert.equal(fs.readdirSync(path.join(dir, "attachments")).length, 1);
    const backup = JSON.parse(fs.readFileSync(s.backup(), "utf8"));
    assert.ok(backup.photos.every((p) => p.data && !p.file));
    s.restore(backup, s.load().revision);
    assert.equal(s.load().photos.length, 2);
  }));
test("no acepta un archivo falso con extensión de imagen", () =>
  fixture((dir, open) => {
    const s = open();
    assert.throws(() =>
      s.dispatch({
        type: "photo",
        name: "fake.png",
        data: "data:image/png;base64,YWJj",
      }),
    );
    assert.equal(s.load().photos.length, 0);
  }));
test("restauración reemplaza relaciones en una sola transacción", () =>
  fixture((dir, open) => {
    const s = open();
    const backup = s.exportState();
    backup.suppliers[0].id = "new-supplier";
    for (const p of backup.products)
      if (p.supplier === "s1") p.supplier = "new-supplier";
    s.restore(backup, s.load().revision);
    assert.equal(s.load().products[0].supplier, "new-supplier");
    assert.deepEqual(s.db.prepare("PRAGMA foreign_key_check").all(), []);
  }));
test("terminación del proceso sin commit no deja cambios parciales", () =>
  fixture((dir, open) => {
    const s = open();
    const before = s.load().products[0].stock;
    s.close();
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec(\"BEGIN IMMEDIATE; UPDATE products SET stock_milli=123000,data=json_set(data,'$.stock',123) WHERE id='p1';\");process.exit(0)",
        path.join(dir, "gelatostock.sqlite"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const reopened = open();
    assert.equal(reopened.load().products[0].stock, before);
    assert.equal(
      reopened.db
        .prepare("SELECT stock_milli FROM products WHERE id='p1'")
        .get().stock_milli,
      Math.round(before * 1000),
    );
  }));
test("guardar un movimiento no reescribe el historial previo", () =>
  fixture((dir, open) => {
    const s = open();
    for (let i = 0; i < 30; i++)
      s.dispatch({ type: "count", product: "p1", value: i });
    const before = s.db.prepare("SELECT total_changes() AS n").get().n;
    s.dispatch({ type: "count", product: "p1", value: 31 });
    const changed =
      s.db.prepare("SELECT total_changes() AS n").get().n - before;
    assert.equal(changed, 4);
    assert.equal(s.load().movements[0].after, 31);
  }));

test("clasificación corregida y texto original persisten tras reinicio SQLite", () =>
  fixture((dir, open) => {
    const store = open();
    store.dispatch({
      type: "message",
      supplier: "s1",
      text: "Oferta de café",
      eventId: "persist-message",
    });
    store.dispatch({
      type: "relevance",
      id: "persist-message",
      relevance: "irrelevant",
      reason: "No lo utilizamos",
    });
    store.close();
    const m = open()
      .load()
      .messages.find((m) => m.id === "persist-message");
    assert.equal(m.relevance, "irrelevant");
    assert.equal(m.relevanceReason, "No lo utilizamos");
    assert.equal(m.text, "Oferta de café");
    assert.equal(m.priority, "low");
  }));
