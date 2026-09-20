const fs = require("node:fs");
const path = require("node:path");
const { createWorker } = require("tesseract.js");
let running = false;
async function recognizeLocal(data) {
  if (running)
    throw Error("Ya hay una lectura en curso. Esperá a que termine.");
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
  const langPath = path.join(
    path.dirname(require.resolve("@tesseract.js-data/spa/package.json")),
    "4.0.0",
  );
  if (!fs.existsSync(path.join(langPath, "spa.traineddata.gz")))
    throw Error("Falta el idioma OCR incluido. Reinstalá el paquete completo.");
  running = true;
  let worker,
    timer,
    expired = false;
  const work = (async () => {
    worker = await createWorker("spa", 1, {
      langPath,
      workerPath: path.join(__dirname, "ocr-worker.cjs"),
      cacheMethod: "none",
      gzip: true,
      errorHandler: () => {},
    });
    if (expired) {
      await worker.terminate();
      throw Error("Lectura cancelada por tiempo.");
    }
    const { data: result } = await worker.recognize(bytes);
    return { text: result.text.slice(0, 20000), confidence: result.confidence };
  })();
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(
            Error(
              "La lectura tardó demasiado. Prueba con una foto más pequeña o elige el proveedor a mano.",
            ),
          );
        }, 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (worker) await worker.terminate();
    running = false;
  }
}
module.exports = { recognizeLocal };
