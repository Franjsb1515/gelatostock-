// Mide la lectura de fotos del Calendario con las fotos de prueba: lectura local real (tesseract)
// y propuesta por reglas (core/dayphoto.ts). Cuenta aciertos y, aparte, si alguna propuesta
// inventa algo (fecha, cantidad, turno o proveedor distinto de lo que dice la foto).
// Uso: npm run build && node scripts/evaluate-calendar-photos.cjs
const fs = require("node:fs");
const path = require("node:path");
const domain = require("../build/domain.js");
const { readDayPhoto } = require("../build/dayphoto.js");
const { recognizeLocal } = require("../src/ocr.cjs");
const {
  today,
  cases,
  photoState,
  score,
} = require("../tests/fixtures/fotos-calendario/casos.cjs");
const version = require("../package.json").version;
const dir = path.join(__dirname, "..", "tests", "fixtures", "fotos-calendario");

(async () => {
  const s = photoState(domain);
  const rows = [];
  for (const c of cases) {
    const bytes = fs.readFileSync(path.join(dir, c.file));
    const started = Date.now();
    const ocr = await recognizeLocal(
      "data:image/jpeg;base64," + bytes.toString("base64"),
    );
    const reading = readDayPhoto(s, ocr.text, ocr.confidence, today);
    const result = score(c, reading);
    rows.push({
      file: c.file,
      style: c.style,
      ms: Date.now() - started,
      confidence: Math.round(ocr.confidence),
      ...result,
      kind: reading.kind,
      date: reading.date,
      text: ocr.text,
    });
    console.log(
      `${result.ok ? "OK  " : "FALLA"} ${c.file} (${c.style}, confianza ${Math.round(ocr.confidence)})${result.problems.length ? " · " + result.problems.join(" · ") : ""}${result.invented ? " · INVENTA" : ""}`,
    );
  }
  const ok = rows.filter((r) => r.ok).length;
  const invented = rows.filter((r) => r.invented).length;
  const byStyle = {};
  for (const r of rows) {
    byStyle[r.style] ??= { total: 0, ok: 0 };
    byStyle[r.style].total++;
    if (r.ok) byStyle[r.style].ok++;
  }
  const summary = { version, today, total: rows.length, ok, invented, byStyle };
  console.log(JSON.stringify(summary));
  fs.writeFileSync(
    path.join(
      __dirname,
      "..",
      "reports",
      `fotos-calendario-v${version.replaceAll(".", "")}.json`,
    ),
    JSON.stringify({ summary, rows }, null, 2),
  );
})().catch((e) => {
  console.error("FALLO", e);
  process.exit(1);
});
