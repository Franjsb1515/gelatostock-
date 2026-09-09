// Evaluation uses synthetic fixtures only, never the business database.
// Modes: (none) documents corpus 1 · --quick 3 cases · --docs2 both corpora with rules/model/combined
// · --replies supplier replies · --chat guide questions.
const fs = require("node:fs");
const path = require("node:path");
const { LocalAI } = require("../src/ai.cjs");
const { classifyDocument } = require("../src/ai-review.cjs");
const samples = require("../tests/fixtures/ai-documents.json");
const manifest = require("../runtime/ai-model.json");
const tag = "v" + require("../package.json").version.replace(/\./g, "");
const save = (name, result) => {
  fs.writeFileSync(
    path.join(__dirname, "../reports", name),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify({ ...result, rows: undefined }));
};
(async () => {
  const ai = new LocalAI();
  const rows = [];
  let peak = process.memoryUsage().rss;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 250);
  const base = () => ({
    at: new Date().toISOString(),
    synthetic: true,
    model: manifest.label + " " + manifest.dtype.toUpperCase(),
    peakProcessRSSMiB: Math.round(peak / 1048576),
  });
  try {
    if (process.argv.includes("--replies")) {
      const replies = require("../tests/fixtures/ai-replies.json");
      const { interpretReply } = require("../src/domain.cjs");
      for (const sample of replies) {
        const r = await ai.readReply(sample.text);
        const rules = interpretReply(sample.text, new Date().toISOString());
        const pass = r.category === sample.expected;
        rows.push({
          id: sample.id,
          expected: sample.expected,
          model: r.category,
          status: r.status,
          rules: rules.category,
          rulesPass: rules.category === sample.expected,
          milliseconds: r.milliseconds,
          pass,
        });
        console.log(
          (pass ? "PASS: " : "FAIL: ") +
            sample.id +
            " · reglas " +
            (rules.category === sample.expected ? "ok" : rules.category) +
            " · " +
            r.milliseconds +
            " ms",
        );
      }
      const result = {
        ...base(),
        kind: "replies",
        cases: rows.length,
        passed: rows.filter((r) => r.pass).length,
        rulesPassed: rows.filter((r) => r.rulesPass).length,
        rows,
      };
      save("ai-replies-" + tag + ".json", result);
      if (result.passed !== result.cases) process.exitCode = 1;
      return;
    }
    if (process.argv.includes("--chat")) {
      const questions = require("../tests/fixtures/ai-chat.json");
      for (const q of questions) {
        const r = await ai.chat({
          messages: [{ role: "user", content: q.question }],
        });
        const answer = r.answer.toLowerCase();
        const expectOk = q.expect.every((e) => new RegExp(e, "i").test(answer));
        const forbidOk = !q.forbid.some((e) => new RegExp(e, "i").test(answer));
        const pass = expectOk && forbidOk;
        rows.push({
          id: q.id,
          question: q.question,
          answer: r.answer,
          source: r.source,
          modelPass: pass && r.source === "model",
          expectOk,
          forbidOk,
          milliseconds: r.milliseconds,
          pass,
        });
        console.log(
          (pass ? "PASS: " : "FAIL: ") +
            q.id +
            " · " +
            r.milliseconds +
            " ms · " +
            r.source +
            " · " +
            r.answer.replace(/\s+/g, " ").slice(0, 110),
        );
      }
      const result = {
        ...base(),
        kind: "chat",
        cases: rows.length,
        passed: rows.filter((r) => r.pass).length,
        modelPassed: rows.filter((r) => r.modelPass).length,
        bySource: rows.reduce(
          (n, r) => ((n[r.source] = (n[r.source] || 0) + 1), n),
          {},
        ),
        meanMilliseconds: Math.round(
          rows.reduce((n, r) => n + r.milliseconds, 0) / rows.length,
        ),
        rows,
      };
      save("ai-chat-" + tag + ".json", result);
      if (result.passed !== result.cases) process.exitCode = 1;
      return;
    }
    const docs2 = process.argv.includes("--docs2");
    const selected = docs2
      ? [...samples, ...require("../tests/fixtures/ai-documents-2.json")]
      : process.argv.includes("--quick")
        ? samples.filter((s) =>
            ["proforma", "peticion_factura", "total_incoherente"].includes(
              s.id,
            ),
          )
        : samples;
    for (const sample of selected) {
      const r = await ai.analyze({ text: sample.text, mode: "careful" });
      const rules = classifyDocument(sample.text);
      const pass =
        !r.invalid &&
        r.tipo === sample.expected &&
        (!sample.arithmetic || r.arithmetic?.status === sample.arithmetic);
      rows.push({
        id: sample.id,
        expected: sample.expected,
        tipo: r.tipo,
        modelType: r.modelType,
        modelPass: r.modelType === sample.expected,
        rulesType: rules.tipo,
        rulesConfidence: rules.confidence,
        rulesPass: rules.tipo === sample.expected,
        invalid: !!r.invalid,
        needsAttention: r.needsAttention,
        verification: r.verification,
        arithmetic: r.arithmetic?.status,
        milliseconds: r.milliseconds,
        pass,
      });
      console.log(
        (pass ? "PASS: " : "FAIL: ") +
          sample.id +
          " · modelo " +
          (r.modelType === sample.expected ? "ok" : r.modelType) +
          " · reglas " +
          (rules.tipo === sample.expected ? "ok" : rules.tipo) +
          " · " +
          r.milliseconds +
          " ms",
      );
    }
    const result = {
      ...base(),
      kind: docs2 ? "documents-both-corpora" : "documents",
      cases: rows.length,
      passed: rows.filter((r) => r.pass).length,
      modelPassed: rows.filter((r) => r.modelPass).length,
      rulesPassed: rows.filter((r) => r.rulesPass).length,
      meanMilliseconds: Math.round(
        rows.reduce((n, r) => n + r.milliseconds, 0) / rows.length,
      ),
      rows,
    };
    save(
      docs2
        ? "ai-evaluation-" + tag + "-docs2.json"
        : process.argv.includes("--quick")
          ? "ai-evaluation-" + tag + "-quick.json"
          : "ai-evaluation-" + tag + ".json",
      result,
    );
    if (result.passed !== result.cases) process.exitCode = 1;
  } finally {
    clearInterval(sampler);
    await ai.cancel();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
