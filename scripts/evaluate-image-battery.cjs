// Mide el lector de fotos de cada área con la batería de 50 tipos de imagen
// (tests/fixtures/bateria-imagenes/casos.cjs; las imágenes las crea make-image-battery.cjs).
// Llama a las funciones reales de la app: la lectura local, las reglas de proveedor, tipo de
// documento, día y apartado, la lectura de cuadrantes y el archivado de adjuntos de WhatsApp
// (sin conectar WhatsApp). Por imagen: tiempo, memoria, cuánto del texto clave se leyó, qué
// propuso la app frente a la verdad y una clasificación:
//   EXACTA               propuso lo que dice la imagen
//   PARCIAL-Y-AVISADA    le falta algo, no propone nada falso y la app lo deja a la vista
//   NO LEÍDA-Y-DICHA     no se leyó (o no se admite) y la app lo dice
//   NO LEÍDA-SIN AVISO   no se leyó y la app no lo dice (hueco: no inventa, pero calla)
//   INVENTO              propuso con seguridad algo falso. Tiene que ser 0.
// «Texto clave leído» = proporción de las palabras clave del caso que aparecen en el texto leído,
// sin tildes ni mayúsculas.
// Uso: npm run build && node scripts/evaluate-image-battery.cjs [--fase antes|despues] [D01,C07…]
const fs = require("node:fs");
const path = require("node:path");
const domain = require("../build/domain.js");
const { guessDocType } = require("../build/documents.js");
const { identifySupplier } = require("../build/identify.js");
const { readDayPhoto } = require("../build/dayphoto.js");
const { recognizeLocal } = require("../src/ocr.cjs");
const { readPdfText } = require("../src/pdftext.cjs");
const {
  readDocumentPhoto,
  readCalendarPhoto,
} = require("../src/photo-read.cjs");
const { WhatsAppConnection } = require("../src/whatsapp.cjs");
const {
  photoState,
  score,
} = require("../tests/fixtures/fotos-calendario/casos.cjs");
const {
  today,
  contents,
  cases,
  cuadrante,
  plainText,
} = require("../tests/fixtures/bateria-imagenes/casos.cjs");
const version = require("../package.json").version;
const dir = path.join(__dirname, "..", "work", "bateria-imagenes");
const report = path.join(
  __dirname,
  "..",
  "reports",
  `bateria-imagenes-v${version.replaceAll(".", "")}.json`,
);
// ¿Dice Documentos que un adjunto se archivó sin texto leído? (src/ui/views-documents.js)
const SAYS_NO_TEXT = true;
const mimes = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};
const fold = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
const keyRatio = (c, text) => {
  const keys = [c.content, c.second]
    .filter(Boolean)
    .flatMap((k) => contents[k].keywords);
  if (!keys.length) return null;
  const t = fold(text);
  return (
    Math.round(
      (keys.filter((k) => t.includes(fold(k))).length / keys.length) * 100,
    ) / 100
  );
};

/** Documentos: proveedor y tipo propuestos frente a la verdad. */
function judgeDocument(c, text, supplier, docType, said) {
  const ratio = keyRatio(c, text);
  const t = c.truth;
  const wrong = [];
  if (supplier && supplier !== t.supplier)
    wrong.push(`proveedor ${supplier} (es ${t.supplier})`);
  if (docType && t.docType !== "cualquiera" && docType !== t.docType)
    wrong.push(`tipo ${docType} (es ${t.docType})`);
  const exact =
    supplier === t.supplier &&
    (t.docType === "cualquiera" || docType === t.docType) &&
    ratio >= 0.8;
  return {
    ratio,
    proposed: { proveedor: supplier, tipo: docType },
    truth: { proveedor: t.supplier, tipo: t.docType },
    problems: wrong,
    class: wrong.length
      ? "INVENTO"
      : ratio < 0.3
        ? said
          ? "NO LEÍDA-Y-DICHA"
          : "NO LEÍDA-SIN AVISO"
        : exact && c.ideal === "EXACTA"
          ? "EXACTA"
          : "PARCIAL-Y-AVISADA",
  };
}

/** Un cuadrante leído casilla por casilla, frente a tests/fixtures/fotos-calendario/cuadrante.cjs. */
function judgeRoster(r) {
  const norm = (v) =>
    !v
      ? ""
      : (v.from ? `${v.from}-${v.to}` : "") +
        (v.label ? (v.from ? " " : "") + fold(v.label).toUpperCase() : "");
  const want = (text) => {
    const m = /(\d{2}):(\d{2}) A (\d{2}):(\d{2})/.exec(text);
    return m ? `${m[1]}:${m[2]}-${m[3]}:${m[4]}` : text;
  };
  const counts = { sureOk: 0, unsureOk: 0, unsureBad: 0, sureBad: 0 };
  const problems = [];
  const datesOk = JSON.stringify(r.dates) === JSON.stringify(cuadrante.dates);
  if (!datesOk)
    problems.push(`fechas ${r.dates[0]}… (son ${cuadrante.dates[0]}…)`);
  for (const p of cuadrante.people.filter((x) => x.name)) {
    const got = r.people.find(
      (x) => x.name.toUpperCase() === p.name.toUpperCase(),
    );
    if (!got) {
      problems.push(`falta ${p.name}`);
      continue;
    }
    p.cells.forEach((cell, i) => {
      const g = got.cells[i];
      const ok = norm(g?.value) === want(cell);
      counts[(g?.sure ? "sure" : "unsure") + (ok ? "Ok" : "Bad")]++;
      if (!ok && g?.sure)
        problems.push(
          `${p.name} día ${i + 1}: «${norm(g?.value)}» dado por seguro, es «${want(cell)}»`,
        );
    });
  }
  const extra = r.people.filter(
    (x) =>
      !cuadrante.people.some(
        (p) => p.name && p.name.toUpperCase() === x.name.toUpperCase(),
      ),
  );
  if (extra.length)
    problems.push(`personas de más: ${extra.map((x) => x.name).join(", ")}`);
  const total =
    counts.sureOk + counts.unsureOk + counts.unsureBad + counts.sureBad;
  return {
    proposed: {
      cuadrante: counts,
      fechas: datesOk ? "bien" : r.dates.length ? "mal" : "sin leer",
    },
    problems,
    class:
      counts.sureBad || (!datesOk && r.dates.length) || extra.length
        ? "INVENTO"
        : datesOk && counts.sureOk === total && !problems.length
          ? "EXACTA"
          : "PARCIAL-Y-AVISADA",
  };
}

/** Un cuadrante que la app no vio como tabla y leyó como texto: no puede sacar turnos falsos. */
function judgeRosterAsText(reading) {
  const problems = [];
  if (reading.kind === "schedule")
    for (const d of reading.schedule) {
      if (d.closed || d.open || d.close)
        problems.push(
          `día ${d.weekday}: horario de tienda que el cuadrante no dice`,
        );
      for (const s of d.shifts) {
        const p = cuadrante.people.find(
          (x) => x.name && fold(x.name) === fold(s.person),
        );
        const says = p
          ? [p.cells[d.weekday], p.cells[d.weekday + 7]].map((v) =>
              v.replace(" A ", "-"),
            )
          : [];
        if (!says.includes(`${s.from}-${s.to}`))
          problems.push(
            `día ${d.weekday}: turno ${s.person} ${s.from}-${s.to} que no está`,
          );
      }
    }
  if (reading.kind === "sales" && reading.sales.length)
    problems.push("ventas que no hay");
  if (reading.kind === "document" && reading.document?.supplier)
    problems.push("proveedor que no hay");
  if (reading.date)
    problems.push(`fecha ${reading.date} que no se propone así`);
  return {
    proposed: { apartado: reading.kind, fecha: reading.date },
    problems,
    class: problems.length
      ? "INVENTO"
      : reading.kind === null
        ? "NO LEÍDA-Y-DICHA"
        : "PARCIAL-Y-AVISADA",
  };
}

async function runCase(c, s) {
  const bytes = fs.readFileSync(path.join(dir, c.file));
  const data = `data:${c.mime || mimes[c.format]};base64,${bytes.toString("base64")}`;
  if (c.area === "formatos") {
    try {
      const r = await recognizeLocal(data);
      return {
        class: "INVENTO",
        problems: ["se aceptó un archivo que no se admite"],
        said: [],
        text: r.text,
      };
    } catch (e) {
      return {
        class: "NO LEÍDA-Y-DICHA",
        problems: [],
        said: [e.message],
        proposed: { rechazada: true },
      };
    }
  }
  if (c.area === "documentos") {
    const r = await readDocumentPhoto(s, data);
    return {
      ...judgeDocument(
        c,
        r.text,
        r.detection.supplier ?? null,
        guessDocType(r.text) ?? null,
        !!r.advice,
      ),
      confidence: Math.round(r.confidence),
      said: [r.advice, r.detection.reason].filter(Boolean),
      text: r.text,
    };
  }
  if (c.area === "whatsapp") {
    // El mismo camino que un adjunto recibido: importDocument, con la lectura real y un almacén
    // de mentira que solo recoge lo que se archivaría. No se conecta nada.
    const saved = [];
    const log = [];
    await WhatsAppConnection.prototype.importDocument.call(
      {
        mainStore: { dispatch: (a) => saved.push(a) },
        ocr: recognizeLocal,
        pdfText: readPdfText,
        log: (m) => log.push(m),
      },
      c.truth.supplier,
      "+34 600 000 000",
      { name: c.file, at: today + "T10:00:00.000Z" },
      bytes,
      c.mime || mimes[c.format],
    );
    const text = saved[0]?.ocrText || "";
    const j = judgeDocument(
      { ...c, truth: { ...c.truth, supplier: null } },
      text,
      null,
      guessDocType(text) ?? null,
      SAYS_NO_TEXT && !!saved[0] && !text,
    );
    return {
      ...j,
      proposed: { archivado: !!saved[0], tipo: j.proposed.tipo },
      truth: { archivado: true, tipo: c.truth.docType },
      problems: saved[0] ? j.problems : [...j.problems, "no se archivó"],
      class: saved[0] ? j.class : "INVENTO",
      said: log,
      text,
    };
  }
  const r = await readCalendarPhoto(s, data, today, []);
  const reading = r.reading;
  if (c.area === "cuadrante") {
    const j = reading.roster
      ? judgeRoster(reading.roster)
      : judgeRosterAsText(reading);
    return {
      ...j,
      proposed: { ...j.proposed, vistoComoTabla: !!reading.roster },
      confidence: r.confidence === null ? null : Math.round(r.confidence),
      said: reading.reasons,
      text: r.text,
    };
  }
  const result = score(c, reading);
  return {
    ratio: keyRatio(c, r.text),
    proposed: {
      apartado: reading.kind,
      fecha: reading.date,
      ...(reading.kind === "document"
        ? { proveedor: reading.document?.supplier ?? null }
        : {}),
      ...(reading.roster ? { cuadrante: true } : {}),
    },
    truth: { apartado: c.expect.kind, fecha: c.expect.date },
    problems: result.problems,
    class: result.invented
      ? "INVENTO"
      : reading.kind === null
        ? "NO LEÍDA-Y-DICHA"
        : result.ok && c.ideal === "EXACTA"
          ? "EXACTA"
          : "PARCIAL-Y-AVISADA",
    confidence: r.confidence === null ? null : Math.round(r.confidence),
    said: reading.reasons,
    skipped: reading.skipped,
    text: r.text,
  };
}

/** Las reglas con el texto perfecto: separa lo que falla por la lectura de lo que falla después. */
function perfect(c, s) {
  if (!c.content) return null;
  const text = plainText(c);
  if (c.area === "calendario") {
    const r = score(c, readDayPhoto(s, text, 95, today));
    return r.ok ? "bien" : r.problems.join(" · ");
  }
  if (c.area === "documentos" || c.area === "whatsapp") {
    const j = judgeDocument(
      c.area === "whatsapp"
        ? { ...c, truth: { ...c.truth, supplier: null } }
        : c,
      text,
      c.area === "whatsapp"
        ? null
        : (identifySupplier(s, { text }).supplier ?? null),
      guessDocType(text) ?? null,
      true,
    );
    return j.problems.length ? j.problems.join(" · ") : "bien";
  }
  return null;
}

const stats = (list) => {
  const v = [...list].sort((a, b) => a - b);
  if (!v.length) return null;
  return {
    media: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    p95: v[Math.min(v.length - 1, Math.ceil(v.length * 0.95) - 1)],
    peor: v.at(-1),
  };
};

/** Casos que no son un tipo de imagen sino un comportamiento: se comprueban con la lectura real. */
async function extras() {
  const sharp = require("sharp");
  const d02 = fs.readFileSync(path.join(dir, "D02.jpg"));
  const url = (b) => "data:image/jpeg;base64," + b.toString("base64");
  const out = {};
  // Foto de móvil guardada tumbada con la marca de orientación (EXIF 6): debe leerse derecha.
  const exif = await sharp(d02)
    .rotate(270)
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const r1 = await recognizeLocal(url(exif));
  out.exif = {
    leido: keyRatio(
      cases.find((c) => c.id === "D02"),
      r1.text,
    ),
    confianza: Math.round(r1.confidence),
  };
  // Un JPG cortado a la mitad: mensaje claro, sin colgarse.
  const t0 = Date.now();
  out.roto = await recognizeLocal(url(d02.subarray(0, 3000))).then(
    (r) => ({ aceptado: true, texto: r.text.slice(0, 40) }),
    (e) => ({ rechazado: e.message, ms: Date.now() - t0 }),
  );
  // Dos fotos a la vez: las dos se leen (en cola), ninguna se rechaza.
  const t1 = Date.now();
  const both = await Promise.allSettled([
    recognizeLocal(url(d02)),
    recognizeLocal(url(d02)),
  ]);
  out.dosALaVez = {
    resultados: both.map((b) =>
      b.status === "fulfilled" ? "leída" : b.reason.message,
    ),
    ms: Date.now() - t1,
  };
  return out;
}

(async () => {
  const args = process.argv.slice(2);
  const phase = args.includes("--fase")
    ? args[args.indexOf("--fase") + 1]
    : "despues";
  const only = args.find((a) => /^[A-Z]\d\d/.test(a))?.split(",");
  const s = photoState(domain);
  const rows = [];
  for (const c of cases.filter((x) => !only || only.includes(x.id))) {
    const before = process.memoryUsage().rss;
    let peak = before;
    const watch = setInterval(
      () => (peak = Math.max(peak, process.memoryUsage().rss)),
      20,
    );
    const started = Date.now();
    let r;
    try {
      r = await runCase(c, s);
    } catch (e) {
      if (e instanceof TypeError || e instanceof ReferenceError) throw e;
      // Un fallo de la lectura con mensaje es «no leída y dicha»; nada se propuso.
      r = {
        class: "NO LEÍDA-Y-DICHA",
        problems: [],
        said: [e.message],
        proposed: { error: true },
      };
    }
    clearInterval(watch);
    const row = {
      id: c.id,
      area: c.area,
      tipo: c.tipo,
      file: c.file,
      ms: Date.now() - started,
      memoryMb: Math.round(
        (Math.max(peak, process.memoryUsage().rss) - before) / 1048576,
      ),
      rssMb: Math.round(peak / 1048576),
      ideal: c.ideal,
      rules: perfect(c, s),
      ...r,
    };
    rows.push(row);
    console.log(
      `${row.id} ${row.class.padEnd(18)} ${String(row.ms).padStart(6)} ms  ${row.confidence == null ? "  -" : String(row.confidence).padStart(3)}  ${row.ratio == null ? "  - " : row.ratio.toFixed(2)}  ${row.tipo}${row.problems.length ? " · " + row.problems.slice(0, 3).join(" · ") : ""}`,
    );
  }
  const count = (list) => {
    const out = {};
    for (const r of list) out[r.class] = (out[r.class] || 0) + 1;
    return out;
  };
  const areas = [...new Set(rows.map((r) => r.area))];
  const read = rows.filter((r) => r.area !== "formatos");
  const summary = {
    version,
    phase,
    today,
    total: rows.length,
    classes: count(rows),
    invented: rows.filter((r) => r.class === "INVENTO").length,
    asIdeal: rows.filter((r) => r.class === r.ideal).length,
    byArea: Object.fromEntries(
      areas.map((a) => [a, count(rows.filter((r) => r.area === a))]),
    ),
    ms: stats(read.map((r) => r.ms)),
    msText: stats(read.filter((r) => r.area !== "cuadrante").map((r) => r.ms)),
    msRoster: stats(
      rows.filter((r) => r.area === "cuadrante").map((r) => r.ms),
    ),
    msRejected: stats(
      rows.filter((r) => r.area === "formatos").map((r) => r.ms),
    ),
    memoryMb: stats(read.map((r) => r.memoryMb)),
    rssPeakMb: Math.max(...rows.map((r) => r.rssMb)),
  };
  // Extras fuera de los 50 tipos: orientación de la cámara, archivo roto y dos fotos a la vez.
  summary.extras = only ? null : await extras();
  console.log(JSON.stringify(summary, null, 1));
  if (only) return;
  const all = fs.existsSync(report)
    ? JSON.parse(fs.readFileSync(report, "utf8"))
    : {};
  all[phase] = { summary, rows };
  fs.writeFileSync(report, JSON.stringify(all, null, 2));
})().catch((e) => {
  console.error("FALLO", e);
  process.exit(1);
});
