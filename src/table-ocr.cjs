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
/** Líneas de la cuadrícula: filas y columnas donde más de la mitad son píxeles oscuros. */
async function findGrid(bytes) {
  const { data, info } = await greyPixels(bytes);
  const W = info.width,
    H = info.height;
  // Las líneas de una tabla son casi negras; una etiqueta azul o verde oscura no debe contar.
  const dark = (x, y) => data[y * W + x] < 80;
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
    if (n > W * 0.5) ys.push(y);
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
  const grid = await findGrid(bytes);
  if (!grid) return null;
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
  // La imagen se decodifica una vez; cada casilla se recorta de esos píxeles.
  const raw = await greyPixels(bytes);
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
      ms: Date.now() - started,
    };
  } finally {
    await worker.terminate();
  }
}

module.exports = { findGrid, readTable };
