// Evaluation uses synthetic fixtures only, never the business database.
const fs = require("node:fs");
const path = require("node:path");
const { LocalAI } = require("../src/ai.cjs");
const samples = require("../tests/fixtures/ai-documents.json");
const manifest = require("../runtime/ai-model.json");
const tag = "v" + require("../package.json").version.replace(/\./g, "");
(async () => {
  const ai = new LocalAI();
  const rows = [];
  let peak = process.memoryUsage().rss;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 250);
  const selected = process.argv.includes("--quick")
    ? samples.filter((s) =>
        ["proforma", "peticion_factura", "total_incoherente"].includes(s.id),
      )
    : samples;
  try {
    for (const sample of selected) {
      const r = await ai.analyze({ text: sample.text, mode: "careful" });
      const pass =
        !r.invalid &&
        r.tipo === sample.expected &&
        (!sample.arithmetic || r.arithmetic?.status === sample.arithmetic);
      rows.push({
        id: sample.id,
        expected: sample.expected,
        tipo: r.tipo,
        invalid: !!r.invalid,
        needsAttention: r.needsAttention,
        verification: r.verification,
        arithmetic: r.arithmetic?.status,
        milliseconds: r.milliseconds,
        pass,
      });
      console.log((pass ? "PASS: " : "FAIL: ") + sample.id);
    }
  } finally {
    clearInterval(sampler);
    await ai.cancel();
  }
  const result = {
    at: new Date().toISOString(),
    synthetic: true,
    model: manifest.label + " " + manifest.dtype.toUpperCase(),
    cases: rows.length,
    passed: rows.filter((r) => r.pass).length,
    peakProcessRSSMiB: Math.round(peak / 1048576),
    rows,
  };
  const name = process.argv.includes("--quick")
    ? "ai-evaluation-" + tag + "-quick.json"
    : "ai-evaluation-" + tag + ".json";
  fs.writeFileSync(
    path.join(__dirname, "../reports", name),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  if (result.passed !== result.cases) process.exitCode = 1;
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
