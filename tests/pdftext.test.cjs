const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readPdfText } = require("../src/pdftext.cjs");
const { guessDocType, documentTotalCents } = require("../src/domain.cjs");
const fixture = (name) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name));
const asData = (buf) => "data:application/pdf;base64," + buf.toString("base64");
// Los dos PDF de prueba los imprimió Chromium (work/make-pdf-fixture.cjs): uno con texto
// dentro y otro que solo lleva una imagen, como un escaneo.
test("el texto de un PDF sale del propio archivo, sin OCR", async () => {
  const read = await readPdfText(asData(fixture("factura-texto.pdf")));
  assert.equal(read.pages, 1);
  assert.equal(read.truncated, false);
  assert.equal(read.reason, "");
  assert.match(read.text, /FACTURA F-2026-114/);
  assert.match(read.text, /Lacteos Mediterraneo SL/);
  assert.match(read.text, /Leche entera pasteurizada 12 L 0,95 EUR/);
  assert.match(read.text, /Total: 121,00 EUR/);
  // Las reglas que ya existen leen ese texto igual que el de una foto.
  assert.equal(guessDocType(read.text), "factura");
  assert.equal(documentTotalCents(read.text), 12100);
  assert.match(read.text, /GS-014/);
});
test("un PDF escaneado no trae texto y la app lo dice en vez de inventarlo", async () => {
  const read = await readPdfText(asData(fixture("escaneo-sin-texto.pdf")));
  assert.equal(read.text, "");
  assert.equal(read.pages, 1);
  assert.match(read.reason, /no trae texto dentro/);
  assert.match(read.reason, /haz una foto/);
});
test("acepta el archivo tal cual y rechaza lo que no es un PDF", async () => {
  const read = await readPdfText(fixture("factura-texto.pdf"));
  assert.match(read.text, /FACTURA F-2026-114/);
  await assert.rejects(
    () => readPdfText(asData(fixture("factura-ocr.png"))),
    /no es un PDF válido/,
  );
  await assert.rejects(
    () => readPdfText("data:image/png;base64,AAAA"),
    /Usa un archivo PDF/,
  );
  await assert.rejects(() => readPdfText(Buffer.alloc(0)), /supera 10 MB|PDF/);
});
