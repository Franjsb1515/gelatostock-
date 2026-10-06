// Lectura local del texto de una foto (tesseract, en este equipo y sin red). Una foto se lee de
// más de una manera y se queda la lectura que más texto saca con seguridad:
//   · como un bloque de texto y con análisis de página (este último lee tablas con líneas y fotos
//     tumbadas, que el primero deja en blanco);
//   · si aun así sale poco o dudoso: quitando sombras y fondo, y dándole la vuelta.
// Medido con la batería de 50 tipos de imagen (scripts/evaluate-image-battery.cjs). Lo que no se
// lee, no se inventa: la confianza baja se devuelve tal cual y quien llama lo dice en pantalla.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { createWorker, PSM } = require("tesseract.js");

const MAX_MS = 30000; // límite de una lectura completa
const SOFT_MS = 12000; // pasado este tiempo no se empiezan más pasadas
const MAX_WAITING = 6; // lecturas en cola como mucho
let chain = Promise.resolve();
let waiting = 0;

/** Bytes de una imagen JPG, PNG o WebP en data URL, comprobando que lo es (máx. 5 MB). */
function imageBytes(data) {
  if (
    typeof data !== "string" ||
    data.length > 8000000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)
  )
    throw Error("Usa una imagen JPG, PNG o WebP de hasta 5 MB.");
  const bytes = Buffer.from(data.split(",")[1], "base64");
  if (!bytes.length || bytes.length > 5000000)
    throw Error("La imagen supera 5 MB.");
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (
    !(data.startsWith("data:image/png;")
      ? png
      : data.startsWith("data:image/jpeg;")
        ? jpg
        : webp)
  )
    throw Error("El contenido no corresponde a una imagen válida.");
  return bytes;
}

const DAMAGED =
  "No se ha podido abrir la imagen: parece dañada o incompleta. Prueba a hacer la foto otra vez.";

/** Una pasada. score: letras y cifras de las palabras leídas con seguridad (lo que se compara). */
async function pass(worker, image, psm) {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(
    image,
    {},
    { text: true, blocks: true },
  );
  let score = 0;
  for (const b of data.blocks || [])
    for (const p of b.paragraphs)
      for (const l of p.lines)
        for (const w of l.words)
          if (w.confidence >= 60)
            score += (w.text.match(/[\p{L}\d]/gu) || []).length;
  return { text: data.text, confidence: data.confidence, score, psm, image };
}
/**
 * ¿Lee b claramente más que a? En caso de duda se queda la primera: el análisis de página lee
 * a veces una tabla por columnas (más texto, pero sin pareja día-horas), y la primera pasada,
 * por filas. Umbral medido con las fotos de prueba del Calendario (01-horario-impreso).
 */
const better = (a, b) =>
  (b.score > a.score * 1.3 && b.score - a.score >= 4) ||
  (poor(a) &&
    b.score >= Math.max(a.score, 8) &&
    b.confidence > a.confidence + 15);
const poor = (r) => r.confidence < 70 || r.score < 30;
// Sin nada que parezca texto (una foto de un objeto, un borrón) no merece la pena insistir.
const hopeless = (r) => r.score < 8;

/** Sin sombras ni fondo: cada punto, dividido por la luz que tiene alrededor. */
async function flatten(image) {
  const { data, info } = await sharp(image)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const light = await sharp(image)
    .greyscale()
    .blur(Math.max(8, Math.round(info.width / 40)))
    .raw()
    .toBuffer();
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < out.length; i++)
    out[i] = Math.min(255, Math.round((data[i] * 235) / Math.max(1, light[i])));
  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toBuffer();
}

async function read(bytes, { check }) {
  const langPath = path.join(
    path.dirname(require.resolve("@tesseract.js-data/spa/package.json")),
    "4.0.0",
  );
  if (!fs.existsSync(path.join(langPath, "spa.traineddata.gz")))
    throw Error(
      "Falta una parte de la aplicación (el idioma de lectura). Vuelve a instalarla.",
    );
  let worker,
    timer,
    expired = false;
  const started = Date.now();
  const late = () => expired || Date.now() - started > SOFT_MS;
  const work = (async () => {
    // Una foto de móvil puede venir tumbada con una marca de «gírame»: se endereza antes.
    let image = bytes;
    let meta;
    try {
      meta = await sharp(bytes).metadata();
      if ((meta.orientation || 1) !== 1)
        image = await sharp(bytes).rotate().png().toBuffer();
    } catch {
      throw Error(DAMAGED);
    }
    worker = await createWorker("spa", 1, {
      langPath,
      workerPath: path.join(__dirname, "ocr-worker.cjs"),
      cacheMethod: "none",
      gzip: true,
      errorHandler: () => {},
    });
    if (expired) throw Error("Lectura cancelada por tiempo.");
    let best;
    try {
      best = await pass(worker, image, PSM.SINGLE_BLOCK);
    } catch {
      throw Error(DAMAGED);
    }
    const tryPass = async (make, psm) => {
      if (late()) return;
      try {
        const r = await pass(worker, await make(), psm);
        if (better(best, r)) best = r;
      } catch {
        // Una preparación que falla no estropea la lectura que ya hay.
      }
    };
    // El análisis de página solo hace falta si la primera pasada no es claramente buena: una
    // tabla con líneas o una foto tumbada dejan la primera casi en blanco o con poca confianza.
    if (!(best.confidence >= 85 && best.score >= 60))
      await tryPass(() => image, PSM.AUTO);
    if (poor(best) && !hopeless(best))
      await tryPass(() => flatten(image), PSM.SINGLE_BLOCK);
    if (poor(best) && !hopeless(best))
      await tryPass(() => sharp(image).rotate(180).png().toBuffer(), PSM.AUTO);
    const result = {
      text: best.text.slice(0, 20000),
      confidence: best.confidence,
    };
    // Segunda lectura de la misma foto con otros píxeles (ampliada o reducida), para que quien
    // propone cifras solo use las que salen iguales las dos veces (core/dayphoto.ts).
    if (check && /\d/.test(best.text) && !hopeless(best) && !late()) {
      try {
        const { width } = await sharp(best.image).metadata();
        const second = await pass(
          worker,
          await sharp(best.image)
            .greyscale()
            .resize({
              width: Math.round(width * (width > 2200 ? 0.75 : 1.5)),
              kernel: "lanczos3",
            })
            .png()
            .toBuffer(),
          best.psm,
        );
        result.second = second.text.slice(0, 20000);
      } catch {
        result.second = "";
      }
    }
    return result;
  })();
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(
            Error(
              "La lectura tardó demasiado. Prueba con una foto más pequeña o recortada a lo que quieres leer.",
            ),
          );
        }, MAX_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    work.catch(() => {});
    if (worker) await worker.terminate().catch(() => {});
  }
}

/**
 * Lee el texto de una imagen (data URL). Devuelve { text, confidence } y, con check: true, también
 * second: una segunda lectura independiente para contrastar las cifras. Las lecturas van de una en
 * una: si llega otra mientras tanto (dos fotos seguidas, un adjunto de WhatsApp), espera su turno.
 */
function recognizeLocal(data, { check = false } = {}) {
  let bytes;
  try {
    bytes = imageBytes(data);
  } catch (e) {
    return Promise.reject(e);
  }
  if (waiting >= MAX_WAITING)
    return Promise.reject(
      Error("Hay varias fotos esperando a leerse. Espera a que terminen."),
    );
  waiting++;
  const run = chain.then(() => read(bytes, { check }));
  chain = run.then(
    () => {
      waiting--;
    },
    () => {
      waiting--;
    },
  );
  return run;
}
module.exports = { recognizeLocal, imageBytes };
