// Crea cuadrantes de turnos SINTÉTICOS (nombres inventados) con el estilo de una hoja de cálculo
// con etiquetas de color, para probar la lectura de tablas: tests/fixtures/fotos-calendario/
// 13-cuadrante.png (captura pequeña, como un pantallazo) y 14-cuadrante-grande.png (el doble).
// Lo esperado de cada casilla está en tests/fixtures/fotos-calendario/cuadrante.cjs.
const { _electron: electron } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const roster = require("../tests/fixtures/fotos-calendario/cuadrante.cjs");
const dir = path.join(__dirname, "..", "tests", "fixtures", "fotos-calendario");
const colors = {
  APERTURA: ["#fde8b0", "#5a4300"],
  CIERRE: ["#0b5aa8", "#ffffff"],
  PARTIDO: ["#d7ecd0", "#1d5a2a"],
  LIBRE: ["#1f5f33", "#ffffff"],
  PRODUCCION: ["#bcd8f5", "#0b3f75"],
  "MISE EN PLACE": ["#f1c6ec", "#6b1f63"],
  LOGISTICA: ["#fde8b0", "#5a4300"],
};
const pill = (v) => {
  if (!v) return `<span class="pill empty"></span>`;
  const [bg, fg] =
    colors[v] ||
    (v.includes(":")
      ? v.startsWith("19")
        ? ["#0b5aa8", "#fff"]
        : ["#ffd5d5", "#a00"]
      : ["#eee", "#333"]);
  return `<span class="pill" style="background:${bg};color:${fg}">${v}</span>`;
};
function html(scale) {
  const days = roster.weekdays.map((w) => `<td class="h">${w}</td>`).join("");
  const nums = roster.numbers.map((n) => `<td class="n">${n}</td>`).join("");
  const rows = roster.people
    .map(
      (p) =>
        `<tr><td class="role">${p.role}</td><td class="name">${p.name}</td>${p.cells.map((c) => `<td${c === "LIBRE" ? ' class="off"' : ""}>${pill(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font-family:Arial;zoom:${scale}}
    table{border-collapse:collapse;margin:20px}
    td{border:1px solid #333;height:20px;min-width:74px;text-align:center;font-size:9px;padding:1px 3px}
    td.role{min-width:96px;font-weight:700;background:#9ac58a;font-size:9px}
    td.name{min-width:100px;font-weight:700;font-size:12px}
    td.h{font-weight:700;background:#fde3c8}
    td.n{font-style:italic;font-weight:700}
    td.off{background:#1f4d2a}
    .pill{display:inline-block;width:64px;border-radius:7px;font-size:7.5px;font-weight:700;padding:1px 0}
    .pill.empty{background:#e6e9ee;height:9px}
    .title{font-weight:700;font-size:13px}
  </style><table id="t"><tr><td class="title" colspan="2" rowspan="2">${roster.title}</td>${days}</tr><tr>${nums}</tr><tr><td colspan="2"><b>CRUCEROS</b></td>${roster.numbers.map((_, i) => `<td>${"O".repeat(1 + (i % 3))}</td>`).join("")}</tr>${rows}</table>`;
}
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [path.join(__dirname, "photo-render-main.cjs")],
    env,
  });
  const win = await app.firstWindow();
  for (const [file, scale] of [
    ["13-cuadrante.png", 1],
    ["14-cuadrante-grande.png", 2],
  ]) {
    await win.setContent(html(scale));
    await win.evaluate(() => document.fonts.ready);
    await win.locator("#t").screenshot({ path: path.join(dir, file) });
    console.log(
      file,
      Math.round(fs.statSync(path.join(dir, file)).size / 1024) + " KB",
    );
  }
  await app.close();
})().catch((e) => {
  console.error("FALLO", e);
  process.exit(1);
});
