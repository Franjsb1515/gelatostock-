// Lo que hace la app con una foto en cada área, en un solo sitio para que el servidor y la
// medición (scripts/evaluate-image-battery.cjs) usen exactamente lo mismo. Nada se guarda aquí:
// son propuestas que la persona revisa.
const { identifySupplier } = require("../build/identify.js");
const { readDayPhoto, rosterReading } = require("../build/dayphoto.js");
const { parseRoster, rosterRegions } = require("../build/roster.js");
const { recognizeLocal, imageBytes } = require("./ocr.cjs");
const { readTable } = require("./table-ocr.cjs");

/** El mismo consejo en todas las áreas cuando una foto no se deja leer. */
const RETAKE = "Si la repites: con más luz, más cerca y de frente.";
const letters = (t) => (t.match(/\p{L}/gu) || []).length;

/**
 * Documentos («Añadir un documento»): texto leído y proveedor propuesto. advice va cuando la foto
 * no se ha podido leer (o casi nada): se dice, en vez de callar y dejar «sin proveedor».
 */
async function readDocumentPhoto(state, data) {
  const result = await recognizeLocal(data);
  const unread = letters(result.text) < 12 || result.confidence < 55;
  // Lectura a medias (una sombra, un pliegue, un recorte): quedan líneas, pero con muy pocas
  // letras cada una. Medido en 0.61.0: un documento bien leído trae 9 letras o más por línea;
  // uno con media hoja en sombra, menos de 4. Se avisa; no se corrige nada.
  const lines = result.text.split("\n").filter((l) => l.trim()).length;
  const partial = !unread && lines >= 4 && letters(result.text) / lines < 6;
  return {
    ...result,
    detection: identifySupplier(state, { text: result.text }),
    ...(unread
      ? {
          advice: `La foto no se ha leído bien (o nada). Puedes guardarla igual y elegir el proveedor a mano. ${RETAKE}`,
        }
      : partial
        ? {
            advice: `Puede que falte parte del texto (una sombra, un pliegue o un recorte): comprueba el proveedor y el tipo antes de guardar. ${RETAKE}`,
          }
        : {}),
  };
}

/**
 * Calendario («Subir foto»): un cuadrante (foto con cuadrícula) se lee casilla por casilla; lo
 * demás, como texto, y las reglas proponen día y apartado. known: nombres de turno ya usados.
 * La foto se lee dos veces y las cifras que no coinciden no se usan (core/dayphoto.ts).
 */
async function readCalendarPhoto(state, data, today, known) {
  const bytes = imageBytes(data);
  const table = await readTable(bytes, {
    regions: (grid, cells) => rosterRegions(cells),
  }).catch(() => null);
  const roster = table
    ? parseRoster(
        table.cells,
        today,
        known,
        table.regions,
        table.inks,
        table.photo,
      )
    : null;
  if (roster)
    return { text: "", confidence: null, reading: rosterReading(roster) };
  const result = await recognizeLocal(data, { check: true });
  const reading = readDayPhoto(
    state,
    result.text,
    result.confidence,
    today,
    result.second,
  );
  return {
    text: result.text,
    confidence: result.confidence,
    reading,
    ...(reading.kind ? {} : { advice: RETAKE }),
  };
}

module.exports = { readDocumentPhoto, readCalendarPhoto };
