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

test("crear proveedor crea carpeta estable y ficha aunque cambie el nombre", () =>
  fixture((dir, open) => {
    const s = open();
    const fields = {
      type: "supplier",
      name: "Nuevo / Café",
      initials: "NC",
      category: "Café",
      delivery: "Lunes",
      color: "sage",
    };
    const state = s.dispatch(fields);
    const p = state.suppliers.at(-1);
    const folder = s.supplierFolder(p.id);
    assert.ok(fs.statSync(path.join(folder, "fotos")).isDirectory());
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(folder, "proveedor.json"), "utf8"))
        .name,
      fields.name,
    );
    s.dispatch({ ...fields, id: p.id, name: "Nombre cambiado" });
    assert.equal(s.supplierFolder(p.id), folder);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(folder, "proveedor.json"), "utf8"))
        .name,
      "Nombre cambiado",
    );
    assert.equal(s.archiveWarning, undefined);
  }));
test("foto por proveedor y fecha se conserva al reclasificar y restaurar", () =>
  fixture((dir, open) => {
    const s = open();
    let state = s.dispatch({
      type: "photo",
      supplier: "s1",
      documentDate: "2026-09-01",
      name: "albarán.png",
      note: "",
      data: png,
    });
    const id = state.photos[0].id;
    const old = path.join(s.supplierFolder("s1"), "fotos", "2026-09-01");
    assert.equal(
      fs.readdirSync(old).filter((x) => x.endsWith(".png")).length,
      1,
    );
    s.dispatch({
      type: "organizePhoto",
      id,
      supplier: "s2",
      documentDate: "2026-09-02",
    });
    const dest = path.join(s.supplierFolder("s2"), "fotos", "2026-09-02");
    assert.equal(
      fs.readdirSync(dest).filter((x) => x.endsWith(".png")).length,
      1,
    );
    assert.ok(fs.existsSync(old));
    const backup = s.exportState();
    const child = new Store(path.join(dir, "restored"));
    try {
      child.restore(backup, child.load().revision);
      assert.equal(child.load().photos[0].supplier, "s2");
      assert.ok(
        fs.existsSync(
          path.join(child.supplierFolder("s2"), "fotos", "2026-09-02"),
        ),
      );
    } finally {
      child.close();
    }
  }));
test("fotos antiguas quedan sin proveedor y fechas inexistentes se rechazan", () =>
  fixture((dir, open) => {
    const s = open();
    const state = s.dispatch({
      type: "photo",
      name: "antes.png",
      note: "",
      data: png,
    });
    assert.ok(
      fs.existsSync(
        path.join(
          dir,
          "proveedores",
          "sin-proveedor",
          "fotos",
          state.photos[0].at.slice(0, 10),
        ),
      ),
    );
    assert.throws(() =>
      s.dispatch({
        type: "photo",
        name: "x.png",
        data: png,
        supplier: "no-existe",
      }),
    );
    assert.throws(() =>
      s.dispatch({
        type: "organizePhoto",
        id: state.photos[0].id,
        documentDate: "2026-02-30",
      }),
    );
    assert.throws(() =>
      s.dispatch({
        type: "organizePhoto",
        id: state.photos[0].id,
        documentDate: "../../x",
      }),
    );
  }));
test("fallo del archivo derivado avisa sin perder la transacción y permite recuperar", () =>
  fixture((dir, open) => {
    const s = open();
    const folder = s.supplierFolder("s1");
    // Obstruir una carpeta de una fecha nueva sin tocar los datos canónicos.
    const block = path.join(folder, "fotos", "2026-09-03");
    fs.writeFileSync(block, "ocupado");
    const result = s.dispatch({
      type: "photo",
      supplier: "s1",
      documentDate: "2026-09-03",
      name: "x.png",
      data: png,
    });
    assert.equal(result.photos[0].supplier, "s1");
    assert.match(s.archiveWarning, /no se pudo/);
    assert.ok(s.photo(result.photos[0].id).bytes.length > 0);
    fs.unlinkSync(block);
    s.syncArchive();
    assert.equal(s.archiveWarning, undefined);
    assert.ok(fs.statSync(block).isDirectory());
  }));

test("datos identificativos y OCR persisten y están en la copia portable", () =>
  fixture((dir, open) => {
    const s = open(),
      p = s.load().suppliers[0];
    s.dispatch({
      type: "supplier",
      ...p,
      taxId: "B12345678",
      aliases: "Origen Tostadores",
      whatsapp: "+34910000001",
    });
    s.dispatch({
      type: "photo",
      supplier: p.id,
      name: "x.png",
      data: png,
      ocrText: "ORIGEN COFFEE",
    });
    const saved = s.exportState();
    s.close();
    const restored = open().load();
    assert.equal(restored.suppliers[0].whatsapp, "+34910000001");
    assert.equal(restored.photos[0].ocrText, "ORIGEN COFFEE");
    assert.equal(saved.photos[0].ocrText, "ORIGEN COFFEE");
  }));

test("recetas y producciones persisten en SQLite y sobreviven al reinicio", () =>
  fixture((dir, open) => {
    let store = open();
    store.dispatch({
      type: "recipe",
      name: "Gelato de pistacho",
      product: "p3",
      yield: 2,
      ingredients: [{ product: "p2", quantity: 1 }],
    });
    let s = store.load();
    const recipe = s.recipes.find((r) => r.name === "Gelato de pistacho");
    s = store.dispatch({
      type: "produce",
      recipe: recipe.id,
      quantity: 4,
      date: "2026-09-08",
    });
    s = store.dispatch({
      type: "applyProduction",
      id: s.productions[0].id,
      lines: s.productions[0].lines,
    });
    store.close();
    store = open();
    const again = store.load();
    assert.equal(again.recipes.length, 2);
    assert.equal(again.productions[0].status, "applied");
    assert.equal(again.products.find((p) => p.id === "p2").stock, 6);
    assert.equal(again.products.find((p) => p.id === "p3").stock, 7.2);
    assert.equal(again.movements.filter((m) => m.production).length, 2);
    assert.equal(
      Number(store.db.prepare("PRAGMA user_version").get().user_version),
      5,
    );
  }));

test("corte brusco del proceso a mitad de escrituras deja la base íntegra y consistente", () =>
  fixture((dir) => {
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `
        const { Store } = require(process.argv[1]);
        const s = new Store(process.argv[2]);
        let rev = s.load().revision;
        setTimeout(() => process.kill(process.pid, "SIGKILL"), 250);
        for (let i = 0; ; i++) {
          const st = s.dispatch({ type: "count", product: "p" + (1 + (i % 10)), value: i % 7, revision: rev, operationId: "k" + i });
          rev = st.revision;
        }
        `,
        path.resolve(__dirname, "../build/store.js"),
        dir,
      ],
      { encoding: "utf8", timeout: 20000 },
    );
    assert.notEqual(child.status, 0);
    const store = new Store(dir);
    try {
      assert.equal(
        store.db.prepare("PRAGMA quick_check").get().quick_check,
        "ok",
      );
      const s = store.load();
      assert.ok(Number.isInteger(s.revision) && s.revision > 0);
      assert.equal(s.processed.length, s.revision);
      for (const p of s.products) assert.ok(p.stock >= 0);
    } finally {
      store.close();
    }
  }));

test("las frases aprendidas persisten y la base pasa a versión 3 sin perder datos", () =>
  fixture((dir, open) => {
    let store = open();
    let s = store.dispatch({
      type: "message",
      supplier: "s2",
      text: "Cerramos por reforma",
    });
    s = store.dispatch({
      type: "correctReading",
      id: s.messages[0].id,
      category: "closed",
    });
    store.close();
    store = open();
    const again = store.load();
    assert.equal(again.learned.length, 1);
    assert.equal(again.learned[0].category, "closed");
    assert.equal(
      Number(store.db.prepare("PRAGMA user_version").get().user_version),
      5,
    );
  }));

test("un PDF se almacena por huella, se sirve con su tipo y se archiva por proveedor", () =>
  fixture((dir, open) => {
    const store = open();
    const pdf =
      "data:application/pdf;base64," +
      Buffer.from("%PDF-1.4\n%prueba\n").toString("base64");
    const s = store.dispatch({
      type: "photo",
      name: "factura.pdf",
      data: pdf,
      supplier: "s2",
      documentDate: "2026-09-09",
    });
    const doc = s.photos[0];
    assert.equal(doc.mime, "application/pdf");
    const served = store.photo(doc.id);
    assert.equal(served.mime, "application/pdf");
    assert.ok(served.bytes.subarray(0, 5).toString() === "%PDF-");
    const archive = JSON.parse(
      fs.readFileSync(path.join(dir, "proveedores", "indice.json"), "utf8"),
    );
    const folder = path.join(
      dir,
      "proveedores",
      archive.find((x) => x.id === "s2").carpeta,
      "fotos",
      "2026-09-09",
    );
    assert.ok(fs.readdirSync(folder).some((f) => f.endsWith(".pdf")));
    assert.throws(
      () =>
        store.dispatch({
          type: "photo",
          name: "x.pdf",
          data:
            "data:application/pdf;base64," +
            Buffer.from("no es pdf").toString("base64"),
        }),
      /PDF/,
    );
  }));

test("historial de precios persiste en SQLite (user_version 5) y sobrevive a reabrir", () => {
  const dir = fs.mkdtempSync(
    path.join(path.resolve(__dirname, "../work"), "store-prices-"),
  );
  try {
    let store = new Store(dir);
    store.dispatch({
      type: "editProduct",
      product: "p2",
      name: "Leche entera",
      detail: "",
      min: 12,
      target: 30,
      pack: 6,
      price: 760,
      supplier: "s2",
    });
    store.close();
    store = new Store(dir);
    const s = store.load();
    assert.equal(s.prices.length, 1);
    assert.equal(s.prices[0].to, 760);
    assert.equal(store.db.prepare("PRAGMA user_version").get().user_version, 5);
    store.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
