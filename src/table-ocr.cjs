// Lectura de una foto con forma de tabla (un cuadrante de turnos): se buscan las líneas de la
// cuadrícula y se lee cada casilla por separado, ampliada y con varias preparaciones (normal,
// invertida para texto claro sobre color, varios umbrales). Todo en este equipo, sin red. Devuelve
// para cada casilla las lecturas candidatas; qué significan lo decide core/roster.ts.
const path = require("node:path");
const fs = require("node:fs");
const sharp = require("sharp");
const { createWorker, PSM } = require("tesseract.js");

const MAX_MS = 120000;
/**
 * La imagen en gris, de una vez. Una captura en modo oscuro (fondo negro, líneas y letras claras)
 * se invierte aquí para que el resto la vea como una tabla normal: medido con la batería de
 * imágenes (R04), sin cambio en los cuadrantes claros.
 */
async function greyPixels(bytes) {
  const { data, info } = await sharp(bytes)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i += 7) sum += data[i];
  if (sum / Math.ceil(data.length / 7) < 100)
    for (let i = 0; i < data.length; i++) data[i] = 255 - data[i];
  return { data, info };
}
/**
 * Inclinación de la foto en grados (entre −8 y 8): con cada ángulo se proyectan los píxeles
 * oscuros sobre filas inclinadas; las líneas de la tabla se juntan en pocas filas con el ángulo
 * bueno, así que gana el perfil más concentrado (suma de cuadrados). Se mira una muestra de
 * como mucho 800 píxeles de ancho.
 */
async function skewAngle(raw) {
  // Reducida (no muestreada): una línea fina se queda gris en vez de desaparecer.
  const { data, info } = await sharp(raw.data, {
    raw: { width: raw.info.width, height: raw.info.height, channels: 1 },
  })
    .resize({ width: 800, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    C = info.channels;
  const pts = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (data[(y * W + x) * C] < 110) pts.push(x, y);
  let best = { angle: 0, score: -1 };
  for (let a = -8; a <= 8.001; a += 0.25) {
    const t = Math.tan((a * Math.PI) / 180);
    const shift = Math.ceil(W * 0.15) + 1;
    const bins = new Float64Array(H + 2 * shift);
    for (let i = 0; i < pts.length; i += 2) {
      const row = Math.round(pts[i + 1] - pts[i] * t) + shift;
      if (row >= 0 && row < bins.length) bins[row]++;
    }
    let score = 0;
    for (const b of bins) score += b * b;
    if (score > best.score) best = { angle: a, score };
  }
  return Math.round(best.angle * 100) / 100;
}
/** Gira la imagen en gris (fondo claro) para dejarla recta; lo que entra por los bordes es blanco. */
async function rotatePixels({ data, info }, angle) {
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .rotate(-angle, { background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({
      data: info.channels === 1 ? data : firstChannel(data, info.channels),
      info: { width: info.width, height: info.height },
    }));
}
/** Amplía la imagen en gris (una foto pequeña: líneas de un píxel y letras de pocos píxeles). */
async function enlargePixels({ data, info }, factor) {
  const { data: out, info: o } = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .resize({ width: info.width * factor, kernel: "lanczos3" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: o.channels === 1 ? out : firstChannel(out, o.channels),
    info: { width: o.width, height: o.height },
  };
}
function firstChannel(data, channels) {
  const out = Buffer.alloc(data.length / channels);
  for (let i = 0; i < out.length; i++) out[i] = data[i * channels];
  return out;
}
/**
 * La cuadrícula y los píxeles de los que sale. Primero, como siempre (líneas casi negras). Si no
 * sale: se endereza la foto (si está girada medio grado o más) y se aceptan líneas menos oscuras
 * (una foto desenfocada o comprimida las aclara); una foto pequeña se amplía al doble. Lo que se lee
 * después sale de esa misma imagen enderezada y ampliada.
 */
async function prepareGrid(bytes) {
  const raw = await greyPixels(bytes);
  const first = gridIn(raw, 80);
  if (first) return { grid: first, raw, angle: 0, dark: 80, enlarged: 1 };
  const angle = await skewAngle(raw);
  let straight = Math.abs(angle) >= 0.5 ? await rotatePixels(raw, angle) : raw;
  const enlarged = straight.info.width < 1000 ? 2 : 1;
  if (enlarged > 1) straight = await enlargePixels(straight, enlarged);
  // Rescate: una línea de fila tiene que cruzar casi toda la tabla (85 %); así el borde de una
  // fila de etiquetas de color, que con líneas más claras también cuenta, no parte una fila en dos.
  for (const dark of [80, 120, 160, 200]) {
    const grid = gridIn(straight, dark, 0.85);
    if (grid && evenDays(grid) && wholeWidth(straight, grid, dark))
      return { grid, raw: straight, angle, dark, enlarged };
  }
  return null;
}
/**
 * Las columnas de los días de un cuadrante miden casi lo mismo; la más ancha (los nombres) no
 * cuenta. Si una sale el doble, falta una línea y los días quedarían corridos: esa cuadrícula no
 * vale (medido: foto reducida al 50 % y JPG fuerte, con líneas claras).
 */
function evenDays(grid) {
  const widths = grid.cols.slice(1).map((v, i) => v - grid.cols[i]);
  widths.splice(widths.indexOf(Math.max(...widths)), 1);
  const sorted = [...widths].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return widths.every((w) => w >= median * 0.6 && w <= median * 1.5);
}
/**
 * Las columnas llegan hasta donde llegan las líneas de las filas: si las últimas líneas de columna
 * salen demasiado claras y se pierden, faltarían días al final (medido: foto reducida al 50 % y
 * JPG fuerte). Se mira el tramo oscuro más largo de cada línea de fila (con huecos de hasta 3
 * píxeles) y la mediana de sus extremos.
 */
function wholeWidth({ data, info }, grid, limit) {
  const W = info.width;
  const ends = grid.rows.map((y) => {
    let best = [0, 0],
      start = -1,
      gap = 0;
    for (let x = 0; x <= W; x++) {
      if (x < W && data[y * W + x] < limit) {
        if (start < 0) start = x;
        gap = 0;
      } else if (start >= 0 && (++gap > 3 || x === W)) {
        const end = x - gap;
        if (end - start > best[1] - best[0]) best = [start, end];
        start = -1;
        gap = 0;
      }
    }
    return best;
  });
  const mid = (list) => [...list].sort((a, b) => a - b)[list.length >> 1];
  const left = mid(ends.map((e) => e[0])),
    right = mid(ends.map((e) => e[1]));
  const widths = grid.cols.slice(1).map((v, i) => v - grid.cols[i]);
  const step = mid(widths);
  return (
    Math.abs(grid.cols[0] - left) <= step * 0.5 &&
    Math.abs(grid.cols.at(-1) - right) <= step * 0.5
  );
}
/** Líneas de la cuadrícula en la imagen tal como se lee hoy (sin enderezar). */
async function findGrid(bytes) {
  return gridIn(await greyPixels(bytes), 80);
}
/**
 * Líneas de la cuadrícula: filas donde más de rowCover del ancho y columnas donde más de la mitad
 * del alto de la tabla son píxeles más oscuros que `limit`.
 */
function gridIn({ data, info }, limit, rowCover = 0.5) {
  const W = info.width,
    H = info.height;
  // Las líneas de una tabla son casi negras; una etiqueta azul o verde oscura no debe contar.
  const dark = (x, y) => data[y * W + x] < limit;
  const merge = (list) => {
    const out = [];
    for (const v of list) {
      const last = out.at(-1);
      if (last && v - last[1] <= 2) last[1] = v;
      else out.push([v, v]);
    }
    // Una línea es fina: una franja oscura de más de 5 píxeles es una fila de etiquetas de color.
    return out
      .filter(([a, b]) => b - a <= 5)
      .map(([a, b]) => Math.round((a + b) / 2));
  };
  const ys = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (dark(x, y)) n++;
    if (n > W * rowCover) ys.push(y);
  }
  const rows = merge(ys);
  if (rows.length < 4) return null;
  const top = rows[0],
    bottom = rows.at(-1);
  const xs = [];
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = top; y <= bottom; y++) if (dark(x, y)) n++;
    if (n > (bottom - top) * 0.5) xs.push(x);
  }
  const cols = merge(xs);
  // Casillas demasiado finas (bordes dobles) no son casillas.
  const clean = (lines) =>
    lines.filter((v, i) => i === 0 || v - lines[i - 1] >= 8);
  const r = clean(rows),
    c = clean(cols);
  if (r.length < 4 || c.length < 5) return null;
  return { width: W, height: H, rows: r, cols: c };
}

// Preparaciones, de la más útil a la menos (medido con un cuadrante real): recorte ajustado sin
// umbral (quita los bordes redondeados de las etiquetas de color), después con umbral, normal e
// invertida (texto claro sobre color).
const variants = [
  { inset: 0.16, invert: false, threshold: 0 },
  { inset: 0.16, invert: true, threshold: 0 },
  { inset: 0.03, invert: false, threshold: 140 },
  { inset: 0.03, invert: true, threshold: 140 },
  { inset: 0.1, invert: false, threshold: 140 },
  { inset: 0.16, invert: false, threshold: 140 },
  { inset: 0.03, invert: false, threshold: 0 },
  { inset: 0.1, invert: true, threshold: 100 },
];
const alnum = (t) => (t.match(/[\p{L}\d]/gu) || []).length;
const key = (t) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9:]/g, "");
/** Dos preparaciones distintas leen lo mismo: basta (si es una hora, no: ver core/roster.ts). */
const agreed = (found) => {
  const seen = new Map();
  for (const c of found) {
    const k = key(c.text);
    if (k.length < 2 || c.conf < 60) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return (
    [...seen.entries()].some(([k, n]) => n >= 2 && !/\d:\d/.test(k)) ||
    [...seen.entries()].some(([k, n]) => n >= 3 && /\d:\d/.test(k))
  );
};

/**
 * Lee la tabla. good(lecturas) dice si ya basta con las lecturas de esa casilla para no probar
 * más preparaciones (por defecto: dos coinciden; tres si es una hora). regions(grid, cells) puede
 * pedir zonas de varias casillas para leerlas de una vez (un título en casillas combinadas que la
 * cuadrícula parte). null si no hay cuadrícula.
 */
async function readTable(bytes, { good = agreed, regions } = {}) {
  const prepared = await prepareGrid(bytes);
  if (!prepared) return null;
  const { grid } = prepared;
  const langPath = path.join(
    path.dirname(require.resolve("@tesseract.js-data/spa/package.json")),
    "4.0.0",
  );
  if (!fs.existsSync(path.join(langPath, "spa.traineddata.gz")))
    throw Error(
      "Falta el idioma de lectura incluido. Reinstala el paquete completo.",
    );
  const worker = await createWorker("spa", 1, {
    langPath,
    workerPath: path.join(__dirname, "ocr-worker.cjs"),
    cacheMethod: "none",
    gzip: true,
    errorHandler: () => {},
  });
  const started = Date.now();
  // Las casillas se recortan de la imagen ya enderezada (y ampliada si era pequeña).
  const raw = prepared.raw;
  const pixels = () =>
    sharp(raw.data, {
      raw: { width: raw.info.width, height: raw.info.height, channels: 1 },
    });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const cells = [];
    const inks = [];
    const inkOf = (X, Y, W, H) => {
      const ix = Math.max(2, Math.round(W * 0.16)),
        iy = Math.max(2, Math.round(H * 0.2));
      const RW = raw.info.width;
      let s = 0,
        n = 0;
      for (let y = Y + iy; y < Y + H - iy; y++)
        for (let x = X + ix; x < X + W - ix - 1; x++) {
          s += Math.abs(raw.data[y * RW + x + 1] - raw.data[y * RW + x]);
          n++;
        }
      return n ? s / n : 0;
    };
    for (let r = 0; r < grid.rows.length - 1; r++) {
      const line = [];
      const inkLine = [];
      for (let c = 0; c < grid.cols.length - 1; c++) {
        const X = grid.cols[c],
          Y = grid.rows[r];
        const W = grid.cols[c + 1] - X,
          H = grid.rows[r + 1] - Y;
        const x0 = X + 2,
          y0 = Y + 2,
          w = W - 4,
          h = H - 4;
        const found = [];
        if (w < 6 || h < 6) {
          line.push(found);
          inkLine.push(0);
          continue;
        }
        // «Tinta»: cambios bruscos de color en el centro de la casilla (letras). Una casilla sin
        // tinta (vacía o con una etiqueta en blanco) no se lee; medido con un cuadrante real:
        // vacías 0, con texto 7 o más.
        const ink = inkOf(X, Y, W, H);
        inkLine.push(ink);
        if (ink < 1.5) {
          line.push(found);
          continue;
        }
        // Que la letra quede de unos 40 píxeles de alto: ni más pequeña ni enorme.
        const scale = Math.max(1, Math.min(8, Math.round(130 / H)));
        let empties = 0;
        for (const v of variants) {
          const ix = Math.max(2, Math.round(W * v.inset)),
            iy = Math.max(
              2,
              Math.min(Math.round(H * v.inset * 1.6), Math.floor(H / 3)),
            );
          if (Date.now() - started > MAX_MS)
            throw Error(
              "La lectura de la tabla tardó demasiado. Prueba con una foto más pequeña o recortada al cuadrante.",
            );
          let img = sharp(
            await pixels()
              .extract({
                left: X + ix,
                top: Y + iy,
                width: W - 2 * ix,
                height: H - 2 * iy,
              })
              .resize({ width: (W - 2 * ix) * scale, kernel: "lanczos3" })
              .png()
              .toBuffer(),
          ).greyscale();
          if (v.invert) img = img.negate();
          img = img.normalise();
          if (v.threshold) img = img.threshold(v.threshold);
          const png = await img
            .extend({
              top: 24,
              bottom: 24,
              left: 24,
              right: 24,
              background: "#ffffff",
            })
            .png()
            .toBuffer();
          const { data } = await worker.recognize(png);
          const text = data.text.trim().replace(/\s+/g, " ");
          const conf = Math.round(data.confidence);
          found.push({ text, conf });
          if (good(found)) break;
          if (alnum(text) < 2 && ++empties >= 3 && ink < 6) break;
        }
        line.push(found);
      }
      cells.push(line);
      inks.push(inkLine);
    }
    // Zonas de varias casillas (por ejemplo, el título con el mes), leídas como un bloque.
    const readRegion = async ({ r0, r1, c0, c1 }) => {
      const X = grid.cols[c0],
        Y = grid.rows[r0];
      const W = grid.cols[c1] - X,
        H = grid.rows[r1] - Y;
      const rowH = Math.max(8, Math.round(H / Math.max(1, r1 - r0)));
      const scale = Math.max(1, Math.min(6, Math.round(110 / rowH)));
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const out = [];
      for (const v of [variants[2], variants[0], variants[3]]) {
        const png = await sharp(
          await pixels()
            .extract({ left: X + 2, top: Y + 2, width: W - 4, height: H - 4 })
            .resize({ width: (W - 4) * scale, kernel: "lanczos3" })
            .png()
            .toBuffer(),
        )
          .greyscale()
          [v.invert ? "negate" : "normalise"]()
          .normalise()
          .threshold(v.threshold || 128)
          .extend({
            top: 24,
            bottom: 24,
            left: 24,
            right: 24,
            background: "#ffffff",
          })
          .png()
          .toBuffer();
        const { data } = await worker.recognize(png);
        out.push({
          text: data.text.trim().replace(/\s+/g, " "),
          conf: Math.round(data.confidence),
        });
      }
      return out;
    };
    const zones = regions ? regions(grid, cells) : [];
    const regionTexts = [];
    for (const z of zones) regionTexts.push(await readRegion(z));
    return {
      grid,
      cells,
      inks,
      regions: regionTexts,
      // Cómo se preparó la foto (core/roster.ts, RosterPhoto): grados enderezados, líneas claras
      // (foto borrosa o comprimida) y veces que se amplió.
      photo: {
        angle: prepared.angle,
        blurry: prepared.dark > 80,
        enlarged: prepared.enlarged,
      },
      ms: Date.now() - started,
    };
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  findGrid,
  prepareGrid,
  skewAngle,
  gridIn,
  greyPixels,
  rotatePixels,
  enlargePixels,
  readTable,
};
