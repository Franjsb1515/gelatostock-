// Crea las fotos de prueba del Calendario (tests/fixtures/fotos-calendario/*.jpg) a partir de
// casos.cjs: dibuja el texto con fuentes del equipo en una ventana de Electron y lo estropea como
// una foto (ladeada, con ruido, borrosa). Son sintéticas: no sustituyen a fotos reales.
// Uso: node scripts/make-calendar-photos.cjs
const { _electron: electron } = require("playwright");
const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs");
const { cases } = require("../tests/fixtures/fotos-calendario/casos.cjs");
const dir = path.join(__dirname, "..", "tests", "fixtures", "fotos-calendario");
const esc = (v) =>
  String(v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function html(c) {
  const hand = c.style === "hand";
  const screen = c.style === "screen";
  const body = c.table
    ? `<h1>${esc(c.lines[0])}</h1><table>${c.lines
        .slice(1)
        .map(
          (l) =>
            `<tr>${l
              .split("|")
              .map((x) => `<td>${esc(x.trim())}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</table>`
    : c.lines
        .map((l, i) => (i === 0 ? `<h1>${esc(l)}</h1>` : `<p>${esc(l)}</p>`))
        .join("");
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:${screen ? "#1f2328" : "#f4f1ea"}}
    #card{display:inline-block;padding:48px 56px;min-width:720px;
      background:${screen ? "#2b3036" : hand ? "#fbf8ef" : "#ffffff"};
      color:${screen ? "#e9edf1" : hand ? "#1d2b6b" : "#111"};
      font-family:'${c.font}';font-size:${hand ? 34 : 26}px;line-height:1.5}
    ${hand ? "#card{background-image:repeating-linear-gradient(transparent 0 50px,#c9d6ee 50px 51px)}" : ""}
    h1{font-size:${hand ? 38 : 28}px;margin:0 0 18px;font-weight:${hand ? 400 : 700}}
    p{margin:0 0 6px}
    table{border-collapse:collapse}td{border:1px solid #999;padding:6px 12px}
  </style><div id="card">${body}</div>`;
}

async function degrade(png, style, i) {
  let img = sharp(png);
  const meta = await img.metadata();
  if (style === "blur")
    return sharp(await img.resize(Math.round(meta.width / 9)).toBuffer())
      .resize(meta.width)
      .blur(6)
      .jpeg({ quality: 60 })
      .toBuffer();
  if (style === "printed" || style === "screen")
    return img.jpeg({ quality: 85 }).toBuffer();
  // Foto de teléfono o papel a mano: algo ladeada, más oscura, con grano y JPEG.
  const angle = style === "hand" ? (i % 2 ? -2.2 : 1.8) : i % 2 ? 1.6 : -1.3;
  const turned = await img
    .rotate(angle, { background: "#8a8478" })
    .modulate({ brightness: 0.92 })
    .blur(0.7)
    .toBuffer({ resolveWithObject: true });
  const { width, height } = turned.info;
  const noise = Buffer.alloc(width * height * 4);
  let seed = 7 + i;
  for (let p = 0; p < width * height; p++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = seed % 255;
    noise[p * 4] = noise[p * 4 + 1] = noise[p * 4 + 2] = v;
    noise[p * 4 + 3] = 22;
  }
  return sharp(turned.data)
    .composite([{ input: noise, raw: { width, height, channels: 4 } }])
    .jpeg({ quality: 70 })
    .toBuffer();
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
  for (const [i, c] of cases.entries()) {
    await win.setContent(html(c));
    await win.evaluate(() => document.fonts.ready);
    const png = await win.locator("#card").screenshot();
    const jpg = await degrade(png, c.style, i);
    fs.writeFileSync(path.join(dir, c.file), jpg);
    console.log(c.file, Math.round(jpg.length / 1024) + " KB");
  }
  await app.close();
})().catch((e) => {
  console.error("FALLO", e);
  process.exit(1);
});
