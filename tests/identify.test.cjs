const test = require("node:test");
const assert = require("node:assert/strict");
const { seed, apply } = require("../build/domain.js");
const { identifySupplier } = require("../build/identify.js");
const { recognizeLocal } = require("../src/ocr.cjs");
const fs = require("node:fs"),
  path = require("node:path");
test("nombre y alias completos identifican sin depender de tildes", () => {
  const s = seed();
  s.suppliers[0].aliases = "Tostadores del Norte";
  assert.equal(
    identifySupplier(s, { text: "Factura ORIGEN COFFEE" }).supplier,
    "s1",
  );
  assert.equal(
    identifySupplier(s, { text: "TOSTADORES DEL NÓRTE" }).supplier,
    "s1",
  );
  assert.equal(
    identifySupplier(s, { text: "Origen Coffeex" }).status,
    "unknown",
  );
});
test("varios nombres quedan por revisar y el NIF distingue al emisor", () => {
  const s = seed();
  const text = s.suppliers
    .slice(0, 2)
    .map((p) => p.name)
    .join(" ");
  assert.equal(identifySupplier(s, { text }).status, "review");
  assert.equal(identifySupplier(s, { text }).supplier, undefined);
  s.suppliers[0].taxId = "B12345678";
  assert.equal(
    identifySupplier(s, { text: text + " NIF B12345678" }).supplier,
    "s1",
  );
});
test("WhatsApp usa el remitente conocido y no una mención en el mensaje", () => {
  const s = seed();
  s.suppliers[1].whatsapp = "+34910000001";
  assert.equal(
    identifySupplier(s, {
      text: "Origen Coffee",
      sender: "+34 910 000 001",
      channel: "whatsapp",
    }).supplier,
    "s2",
  );
  assert.equal(
    identifySupplier(s, {
      text: "Origen Coffee",
      sender: "+34910000009",
      channel: "whatsapp",
    }).supplier,
    undefined,
  );
  s.suppliers[0].whatsapp = s.suppliers[1].whatsapp;
  assert.equal(
    identifySupplier(s, { sender: "+34910000001", channel: "whatsapp" }).status,
    "review",
  );
});
test("Makro se reconoce cuando existe una ficha local con ese nombre", () => {
  let s = seed();
  assert.equal(
    identifySupplier(s, { text: "FACTURA MAKRO" }).status,
    "unknown",
  );
  s = apply(s, {
    type: "supplier",
    name: "Makro",
    initials: "MK",
    category: "Mayorista",
    delivery: "Por confirmar",
    color: "sage",
  });
  assert.equal(
    identifySupplier(s, { text: "FACTURA MAKRO" }).supplier,
    s.suppliers.at(-1).id,
  );
});
test("el identificador no modifica el estado ni acepta entradas ilimitadas", () => {
  const s = seed(),
    before = structuredClone(s);
  identifySupplier(s, { text: "Origen Coffee" });
  assert.deepEqual(s, before);
  assert.throws(() => identifySupplier(s, { text: "x".repeat(20001) }));
  assert.throws(() =>
    apply(s, { type: "supplier", ...s.suppliers[0], whatsapp: "910000001" }),
  );
});
test("OCR real con idioma incluido y fetch bloqueado reconoce proveedor", async () => {
  const bytes = fs.readFileSync(
    path.join(__dirname, "fixtures", "factura-ocr.png"),
  );
  const result = await recognizeLocal(
    "data:image/png;base64," + bytes.toString("base64"),
  );
  assert.match(result.text, /ORIGEN COFFEE/);
  assert.equal(identifySupplier(seed(), { text: result.text }).supplier, "s1");
  await assert.rejects(() => recognizeLocal("https://example.com/image.png"));
  await assert.rejects(
    () => recognizeLocal("data:image/png;base64,eA=="),
    /imagen válida/,
  );
});
test("una letra confundida por la lectura (l por I) sigue proponiendo el proveedor, y vale menos que el nombre exacto", () => {
  const s = seed();
  const r = identifySupplier(s, { text: "FACTURA\nGelato ltalia S.L." });
  assert.equal(r.supplier, "s3");
  assert.match(r.reason, /confunde/);
  // Por WhatsApp no se usa: allí solo identifica el número del remitente.
  assert.equal(
    identifySupplier(s, { text: "Gelato ltalia", channel: "whatsapp" })
      .supplier,
    undefined,
  );
  // Dos lecturas, una exacta y otra confundida: gana la exacta.
  const both = identifySupplier(s, {
    text: "Fresco Mercado y Gelato ltalia",
  });
  assert.equal(both.supplier, "s2");
});
test("dos lecturas a la vez se leen las dos, en cola, sin rechazar ninguna", async () => {
  const bytes = fs.readFileSync(
    path.join(__dirname, "fixtures", "factura-ocr.png"),
  );
  const data = "data:image/png;base64," + bytes.toString("base64");
  const [a, b] = await Promise.all([
    recognizeLocal(data),
    recognizeLocal(data),
  ]);
  assert.match(a.text, /ORIGEN COFFEE/);
  assert.match(b.text, /ORIGEN COFFEE/);
  // Un archivo roto se rechaza con un mensaje claro, sin colgarse.
  await assert.rejects(
    () =>
      recognizeLocal(
        "data:image/png;base64," + bytes.subarray(0, 600).toString("base64"),
      ),
    /dañada o incompleta/,
  );
});
