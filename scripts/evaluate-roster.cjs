// Mide la lectura de cuadrantes (tabla persona × día) con la lectura local real: casillas bien y
// seguras, bien pero marcadas para revisar, mal pero marcadas, y mal dadas por seguras (lo único
// que no puede pasar). Usa los cuadrantes sintéticos de tests/fixtures/fotos-calendario; con
// --real también work/cuadrante-real.png y work/cuadrante-real.esperado.json (fuera de git).
// Uso: npm run build && node scripts/evaluate-roster.cjs [--real]
const fs = require("node:fs");
const path = require("node:path");
const { readTable } = require("../src/table-ocr.cjs");
const { parseRoster, rosterRegions } = require("../build/roster.js");
const expected = require("../tests/fixtures/fotos-calendario/cuadrante.cjs");
const version = require("../package.json").version;
const dir = path.join(__dirname, "..", "tests", "fixtures", "fotos-calendario");

const norm = (v) =>
  !v
    ? ""
    : (v.from ? `${v.from}-${v.to}` : "") +
      (v.label
        ? (v.from ? " " : "") +
          v.label.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
        : "");
const want = (text) => {
  const m = /(\d{2}):(\d{2}) A (\d{2}):(\d{2})/.exec(text);
  return m ? `${m[1]}:${m[2]}-${m[3]}:${m[4]}` : text;
};

async function measure(file, truth) {
  const started = Date.now();
  const t = await readTable(fs.readFileSync(file), {
    regions: (g, cells) => rosterRegions(cells),
  });
  const r = t
    ? parseRoster(t.cells, "2026-10-05", [], t.regions, t.inks)
    : null;
  const out = {
    file: path.basename(file),
    ms: Date.now() - started,
    dates: r?.dates ?? [],
    counts: { sureOk: 0, unsureOk: 0, unsureBad: 0, sureBad: 0 },
    wrong: [],
  };
  if (!r) return { ...out, error: "no se reconoce como cuadrante" };
  out.datesOk = JSON.stringify(r.dates) === JSON.stringify(truth.dates);
  for (const p of truth.people.filter((x) => x.name)) {
    const got = r.people.find(
      (x) => x.name.toUpperCase() === p.name.toUpperCase(),
    );
    if (!got) {
      out.wrong.push(`falta la persona ${p.name}`);
      continue;
    }
    p.cells.forEach((cell, i) => {
      const c = got.cells[i];
      const ok = norm(c?.value) === want(cell);
      const key = (c?.sure ? "sure" : "unsure") + (ok ? "Ok" : "Bad");
      out.counts[key]++;
      if (!ok)
        out.wrong.push(
          `${p.name} ${truth.dates[i]}: leído «${norm(c?.value)}», es «${want(cell)}»${c?.sure ? " (DADO POR SEGURO)" : ""}`,
        );
    });
  }
  out.extraPeople = r.people
    .filter(
      (x) =>
        !truth.people.some(
          (p) => p.name && p.name.toUpperCase() === x.name.toUpperCase(),
        ),
    )
    .map((x) => x.name);
  return out;
}

(async () => {
  const runs = [
    [path.join(dir, "13-cuadrante.png"), expected],
    [path.join(dir, "14-cuadrante-grande.png"), expected],
  ];
  if (process.argv.includes("--real")) {
    const real = path.join(__dirname, "..", "work", "cuadrante-real.png");
    const truth = path.join(
      __dirname,
      "..",
      "work",
      "cuadrante-real.esperado.json",
    );
    if (fs.existsSync(real) && fs.existsSync(truth))
      runs.push([real, JSON.parse(fs.readFileSync(truth, "utf8"))]);
  }
  const results = [];
  for (const [file, truth] of runs) {
    const r = await measure(file, truth);
    results.push(r);
    console.log(
      `${r.file}: ${r.ms} ms · fechas ${r.datesOk ? "bien" : "MAL"} · seguras bien ${r.counts.sureOk} · a revisar (bien) ${r.counts.unsureOk} · a revisar (mal) ${r.counts.unsureBad} · MAL Y SEGURAS ${r.counts.sureBad}${r.extraPeople?.length ? " · personas de más: " + r.extraPeople.join(", ") : ""}${r.error ? " · " + r.error : ""}`,
    );
    for (const w of r.wrong) console.log("   " + w);
  }
  fs.writeFileSync(
    path.join(
      __dirname,
      "..",
      "reports",
      `cuadrantes-v${version.replaceAll(".", "")}.json`,
    ),
    // Del cuadrante real solo se guardan las cifras: lleva nombres de personas.
    JSON.stringify(
      results.map((r) =>
        r.file === "cuadrante-real.png"
          ? { file: r.file, ms: r.ms, datesOk: r.datesOk, counts: r.counts }
          : r,
      ),
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error("FALLO", e);
  process.exit(1);
});
