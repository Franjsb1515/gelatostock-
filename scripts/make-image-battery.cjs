// Crea las 50 imágenes de la batería del lector de fotos (tests/fixtures/bateria-imagenes/
// casos.cjs) en work/bateria-imagenes/, fuera de git: se pueden volver a crear cuando haga falta.
// Misma técnica que make-calendar-photos.cjs: el texto se dibuja con fuentes del equipo en una
// ventana de Electron y después se estropea como una foto (giro, ruido, desenfoque, moaré…).
// Son SINTÉTICAS: no sustituyen a fotos reales.
// Uso: node scripts/make-image-battery.cjs [D01,C07…]
const { _electron: electron } = require("playwright");
const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs");
const {
  contents,
  cases,
  cuadrante,
} = require("../tests/fixtures/bateria-imagenes/casos.cjs");
const out = path.join(__dirname, "..", "work", "bateria-imagenes");
const fixtures = path.join(
  __dirname,
  "..",
  "tests",
  "fixtures",
  "fotos-calendario",
);
const esc = (v) =>
  String(v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const themes = {
  light: ["#f4f1ea", "#ffffff", "#111111"],
  dark: ["#000000", "#111418", "#f2f2f2"],
  screen: ["#1f2328", "#2b3036", "#e9edf1"],
  lowcontrast: ["#e9e9e9", "#e4e4e4", "#a2a2a2"],
  paper: ["#8a8478", "#f3d98b", "#3b2a12"],
  hand: ["#8a8478", "#fbf8ef", "#1d2b6b"],
};
const flat = (l) => esc(l.replaceAll(" | ", "  "));
const cells = (l) =>
  l
    .split(" | ")
    .map((x) => `<td>${esc(x)}</td>`)
    .join("");

/** El contenido de un documento según la disposición pedida. */
function body(content, r) {
  const { lines, bullets } = contents[content];
  const head = `<h1>${esc(lines[0])}</h1>`;
  if (r.layout === "table")
    return `${head}<table class="ruled">${lines
      .slice(1)
      .map((l) => `<tr>${cells(l)}</tr>`)
      .join("")}</table>`;
  if (r.layout === "cols") {
    const info = lines.slice(1).filter((l) => !/\d,\d\d €$/.test(l));
    const items = lines.slice(1).filter((l) => /\d,\d\d €$/.test(l));
    return `${head}<div class="cols"><div>${info.map((l) => `<p>${flat(l)}</p>`).join("")}</div><div><p>Cliente: Heladería de prueba</p><p>Calle Mayor 1</p><p>07001 Palma</p></div></div><table class="plain">${items.map((l) => `<tr>${cells(l)}</tr>`).join("")}</table>`;
  }
  if (r.layout === "ticket")
    return lines
      .map((l, i) =>
        l.includes(" | ")
          ? `<p class="pair"><span>${esc(l.split(" | ")[0])}</span><span>${esc(l.split(" | ")[1])}</span></p>`
          : `<p class="${i < 4 || i === lines.length - 1 ? "mid" : ""}">${esc(l)}</p>`,
      )
      .join("");
  if (bullets)
    return `${head}<ul>${lines
      .slice(1)
      .map((l) => `<li>${esc(l)}</li>`)
      .join("")}</ul>`;
  return (
    head +
    lines
      .slice(1)
      .map((l) => `<p>${flat(l)}</p>`)
      .join("")
  );
}

const stampSvg = `<div class="stamp">PAGADO<br>05 OCT 2026</div><svg class="sign" viewBox="0 0 320 120"><path d="M8 82 C40 10 62 118 92 54 S128 22 150 74 190 96 214 40 250 60 310 28" fill="none" stroke="#1b3fa8" stroke-width="5" stroke-linecap="round"/><path d="M30 100 L300 86" fill="none" stroke="#1b3fa8" stroke-width="3"/></svg>`;
const objectSvg = `<svg width="900" height="700" viewBox="0 0 900 700"><defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a678"/><stop offset="1" stop-color="#8d6a43"/></linearGradient><radialGradient id="b" cx=".4" cy=".35"><stop offset="0" stop-color="#fff3f6"/><stop offset="1" stop-color="#e88aa5"/></radialGradient><radialGradient id="g" cx=".4" cy=".35"><stop offset="0" stop-color="#e7f3c8"/><stop offset="1" stop-color="#8fae4e"/></radialGradient></defs><rect width="900" height="700" fill="url(#w)"/><ellipse cx="470" cy="610" rx="170" ry="26" fill="#000" opacity=".25"/><path d="M360 330 L450 620 L540 330 Z" fill="#d9a55a" stroke="#a87530" stroke-width="6"/><circle cx="405" cy="270" r="92" fill="url(#g)"/><circle cx="505" cy="262" r="96" fill="url(#b)"/><circle cx="452" cy="170" r="84" fill="#f6ecd2"/></svg>`;

function rosterHtml() {
  const r = cuadrante;
  const row = (list) => list.map((v) => `<td>${esc(v)}</td>`).join("");
  return `<table class="roster"><tr><td>${esc(r.title)}</td><td></td>${row(r.weekdays)}</tr><tr><td></td><td></td>${row(r.numbers)}</tr>${r.people.map((p) => `<tr><td>${esc(p.role)}</td><td><b>${esc(p.name)}</b></td>${row(p.cells)}</tr>`).join("")}</table>`;
}

function html(c) {
  const r = c.render || {};
  const [page, paper, ink] = themes[r.theme || "light"];
  const size = r.size || 26;
  let inner;
  if (r.layout === "object") inner = objectSvg;
  else if (r.layout === "roster") inner = rosterHtml();
  else if (r.layout === "mobile") {
    const l = contents[c.content].lines;
    inner = `<div class="bar"><span>9:41</span><span>5G · 87 %</span></div><div class="who">${esc(l[0])}</div>${l
      .slice(1)
      .map((t, i) => `<p class="bubble ${i % 2 ? "me" : ""}">${esc(t)}</p>`)
      .join("")}`;
  } else if (r.layout === "two")
    inner = `<div class="two"><div class="sheet a">${body(c.content, {})}</div><div class="sheet b">${body(c.second, {})}</div></div>`;
  else inner = body(c.content, r) + (r.stamp ? stampSvg : "");
  const card =
    r.layout === "object" || r.layout === "two"
      ? "padding:0;background:transparent"
      : r.layout === "ticket"
        ? "padding:26px 18px;width:300px;min-width:0"
        : r.layout === "mobile"
          ? "padding:0 0 28px;width:390px;min-width:0"
          : r.layout === "roster"
            ? "padding:20px;min-width:0"
            : r.tight
              ? "padding:10px 12px;min-width:0"
              : `padding:${Math.round(size * 1.8)}px ${Math.round(size * 2.1)}px;min-width:${r.wide ? 1500 : Math.round(size * 27)}px`;
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:${page};zoom:${r.zoom || 1}}
    #stage{display:inline-block;padding:${r.tight ? 0 : r.perspective ? 70 : 28}px;background:${page}}
    #card{position:relative;display:inline-block;${card};background:${paper};color:${ink};
      font-family:'${r.font || "Arial"}';font-size:${size}px;line-height:1.5;
      ${r.italic ? "font-style:italic;" : ""}${r.upper ? "text-transform:uppercase;" : ""}${r.smallCaps ? "font-variant:small-caps;" : ""}
      ${r.perspective ? "transform:perspective(1300px) rotateY(24deg) rotateX(9deg);" : ""}}
    ${r.theme === "hand" ? "#card{background-image:repeating-linear-gradient(transparent 0 50px,#c9d6ee 50px 51px)}" : ""}
    ${r.theme === "paper" ? "#card{background-image:linear-gradient(112deg,rgba(0,0,0,.10) 0 9%,transparent 9% 27%,rgba(255,255,255,.35) 27% 29%,rgba(0,0,0,.12) 29% 41%,transparent 41% 63%,rgba(0,0,0,.09) 63% 66%,rgba(255,255,255,.3) 66% 68%,transparent 68%),linear-gradient(24deg,transparent 0 38%,rgba(0,0,0,.10) 38% 40%,transparent 40% 71%,rgba(0,0,0,.08) 71% 86%,transparent 86%)}" : ""}
    ${r.shadow ? "#card::after{content:'';position:absolute;inset:0;background:linear-gradient(128deg,rgba(0,0,0,.62) 0 30%,rgba(0,0,0,.25) 46%,rgba(0,0,0,0) 62%)}" : ""}
    h1{font-size:${Math.round(size * 1.08)}px;margin:0 0 ${Math.round(size * 0.7)}px;font-weight:${r.theme === "hand" ? 400 : 700};${r.titleFont ? `font-family:'${r.titleFont}';font-size:${Math.round(size * 1.5)}px;font-weight:400;` : ""}}
    p{margin:0 0 ${Math.round(size * 0.23)}px}
    ul{margin:0;padding-left:1.2em}
    table{border-collapse:collapse}td{padding:6px 14px}
    table.ruled td{border:1px solid #777}
    table.plain td:last-child,table.ruled td:last-child{text-align:right}
    .cols{display:flex;gap:90px;margin-bottom:22px}
    .pair{display:flex;justify-content:space-between;gap:10px}.mid{text-align:center}
    .stamp{position:absolute;left:38%;top:36%;transform:rotate(-14deg);border:5px solid rgba(196,28,36,.72);color:rgba(196,28,36,.72);font:700 30px Arial;padding:8px 20px;text-align:center;border-radius:10px}
    .sign{position:absolute;right:6%;bottom:4%;width:320px;opacity:.85}
    .two{display:flex;gap:26px;align-items:flex-start;padding:26px;background:#6f675c;font-size:20px}
    .sheet{background:#fff;padding:30px 34px;min-width:420px}.sheet.a{transform:rotate(-1.5deg)}.sheet.b{transform:rotate(2deg);margin-top:40px}
    .bar{display:flex;justify-content:space-between;padding:10px 22px;font:600 15px 'Segoe UI';background:#f1f1f1}
    .who{padding:14px 22px;font-weight:700;font-size:19px;border-bottom:1px solid #ddd;margin-bottom:16px}
    .bubble{font-size:17px;margin:0 60px 12px 16px;padding:10px 14px;background:#ececec;border-radius:14px}
    .bubble.me{margin:0 16px 12px 60px;background:#d6f5c8}
    table.roster{font:11px Arial}table.roster td{padding:5px 9px;text-align:center}
  </style><div id="stage"><div id="card">${inner}</div></div>`;
}

function noiseLayer(width, height, alpha, seed) {
  const noise = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    noise[p * 4] = noise[p * 4 + 1] = noise[p * 4 + 2] = seed % 255;
    noise[p * 4 + 3] = alpha;
  }
  return { input: noise, raw: { width, height, channels: 4 } };
}
/** Dos tramas finas casi iguales, superpuestas: las franjas que se ven al fotografiar una pantalla. */
function moireLayer(width, height) {
  const m = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = Math.sin((2 * Math.PI * x) / 3);
      const b = Math.sin((2 * Math.PI * (x * 0.985 + y * 0.17)) / 3.1);
      const v = Math.round(127 + 127 * a * b);
      const p = (y * width + x) * 4;
      m[p] = v;
      m[p + 1] = Math.round(v * 0.92);
      m[p + 2] = Math.min(255, Math.round(v * 1.1));
      m[p + 3] = 58;
    }
  return { input: m, raw: { width, height, channels: 4 } };
}

async function degrade(png, c, i) {
  const d = c.degrade || {};
  let buf = png;
  const meta = async () => sharp(buf).metadata();
  if (d.blurHard) {
    const m = await meta();
    buf = await sharp(
      await sharp(buf)
        .resize(Math.round(m.width / 9))
        .toBuffer(),
    )
      .resize(m.width)
      .blur(6)
      .png()
      .toBuffer();
  }
  if (d.crop) {
    // Se pierden las primeras letras de cada línea y media última línea.
    const m = await meta();
    buf = await sharp(buf)
      .extract({
        left: 34,
        top: 0,
        width: m.width - 34,
        height: m.height - 26,
      })
      .png()
      .toBuffer();
  }
  if (d.negate)
    buf = await sharp(buf).negate({ alpha: false }).png().toBuffer();
  if (d.scale) {
    const m = await meta();
    buf = await sharp(buf)
      .resize(Math.round(m.width * d.scale))
      .png()
      .toBuffer();
  }
  if (d.rotate)
    buf = await sharp(buf)
      .rotate(d.rotate, { background: "#8a8478" })
      .png()
      .toBuffer();
  if (d.width) buf = await sharp(buf).resize(d.width).png().toBuffer();
  if (d.blur)
    buf = await sharp(buf)
      .modulate({ brightness: 0.94 })
      .blur(d.blur)
      .png()
      .toBuffer();
  const layers = [];
  const m = await meta();
  if (d.noise) layers.push(noiseLayer(m.width, m.height, d.noise, 7 + i));
  if (d.moire) layers.push(moireLayer(m.width, m.height));
  let img = sharp(buf);
  if (layers.length) img = img.composite(layers);
  if (c.format === "jpg" || c.format === "pdf")
    return img
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: d.quality || 82 })
      .toBuffer();
  if (c.format === "webp") return img.webp({ quality: 80 }).toBuffer();
  return img.png().toBuffer();
}

/** Un PDF de una página que solo lleva una foto dentro: un «PDF escaneado», sin texto. */
async function imagePdf(jpg) {
  const { width, height } = await sharp(jpg).metadata();
  const parts = [];
  const offsets = [];
  let length = 0;
  const add = (b) => {
    const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1");
    parts.push(buf);
    length += buf.length;
  };
  const obj = (n, b) => {
    offsets[n] = length;
    add(`${n} 0 obj\n`);
    add(b);
    add("\nendobj\n");
  };
  add("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  obj(
    4,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
        "latin1",
      ),
      jpg,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
  const draw = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  const xref = length;
  add(
    `xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offsets[n]).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return Buffer.concat(parts);
}

/** Archivos que la app no admite: lo justo para que cada uno sea lo que dice ser. */
async function rawFile(kind) {
  if (kind === "empty") return Buffer.alloc(0);
  if (kind === "txt")
    return Buffer.from(
      "Esto es un archivo de texto con el nombre cambiado a .jpg.\n".repeat(40),
    );
  if (kind === "heic")
    return Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from("ftypheic", "latin1"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("mif1heic", "latin1"),
      Buffer.alloc(4000, 7),
    ]);
  if (kind === "gif")
    return sharp({
      create: { width: 320, height: 200, channels: 3, background: "#d9c7a1" },
    })
      .gif()
      .toBuffer();
  if (kind === "bmp") {
    const w = 200,
      h = 120,
      data = Buffer.alloc(w * h * 3, 200),
      head = Buffer.alloc(54);
    head.write("BM", 0, "latin1");
    head.writeUInt32LE(54 + data.length, 2);
    head.writeUInt32LE(54, 10);
    head.writeUInt32LE(40, 14);
    head.writeInt32LE(w, 18);
    head.writeInt32LE(h, 22);
    head.writeUInt16LE(1, 26);
    head.writeUInt16LE(24, 28);
    head.writeUInt32LE(data.length, 34);
    return Buffer.concat([head, data]);
  }
  // Más de 5 MB: una imagen de puntos al azar, que no se deja comprimir.
  const w = 1500,
    h = 1300,
    px = Buffer.alloc(w * h * 3);
  let seed = 11;
  for (let p = 0; p < px.length; p++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    px[p] = seed % 256;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const only = process.argv[2]?.split(",");
  const todo = cases.filter((c) => !only || only.includes(c.id));
  let app, win;
  const window = async () => {
    if (win) return win;
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      executablePath: require("electron"),
      args: [path.join(__dirname, "photo-render-main.cjs")],
      env,
    });
    return (win = await app.firstWindow());
  };
  for (const [i, c] of todo.entries()) {
    let bytes;
    if (c.raw) bytes = await rawFile(c.raw);
    else {
      let png;
      if (c.from) png = fs.readFileSync(path.join(fixtures, c.from));
      else {
        const w = await window();
        await w.setContent(html(c));
        await w.evaluate(() => document.fonts.ready);
        png = await w.locator("#stage").screenshot();
      }
      bytes = await degrade(png, c, i);
      if (c.format === "pdf") bytes = await imagePdf(bytes);
    }
    fs.writeFileSync(path.join(out, c.file), bytes);
    const meta =
      c.raw || c.format === "pdf" ? null : await sharp(bytes).metadata();
    console.log(
      c.file,
      Math.round(bytes.length / 1024) + " KB",
      meta ? `${meta.width}x${meta.height}` : "",
    );
  }
  if (app) await app.close();
})().catch((e) => {
  console.error("FALLO", e);
  process.exit(1);
});
