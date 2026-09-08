const { Worker } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { z } = require("zod");
const inputSchema = z
  .object({ text: z.string().trim().min(3).max(4000) })
  .strict();
const resultSchema = z
  .object({
    tipo: z.enum([
      "factura",
      "albaran",
      "lista_precios",
      "oferta",
      "mensaje",
      "otro",
    ]),
    evidencia: z.string().min(3).max(500),
  })
  .strict();
function parseResult(raw, original) {
  try {
    const parsed = resultSchema.parse(
      JSON.parse(
        raw
          .trim()
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, ""),
      ),
    );
    const index = original
      .toLowerCase()
      .indexOf(parsed.evidencia.toLowerCase());
    const evidence = original.slice(index, index + parsed.evidencia.length);
    if (index < 0 || evidence.toLowerCase() !== parsed.evidencia.toLowerCase())
      throw Error("Evidencia ausente del original.");
    return { ...parsed, evidencia: evidence, review: true };
  } catch {
    return {
      tipo: "otro",
      evidencia: "",
      reason:
        "El modelo no produjo una lectura verificable. Revisa el documento original.",
      review: true,
      invalid: true,
    };
  }
}
class LocalAI {
  constructor() {
    this.job = null;
    this.verified = false;
  }
  async verify() {
    if (this.verified) return;
    const manifest = require("../runtime/ai-model.json");
    for (const [name, expected] of Object.entries(manifest.files)) {
      if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.includes(".."))
        throw Error("Manifiesto del modelo inválido.");
      const file = path.join(
        __dirname,
        "..",
        "runtime",
        "models",
        "qwen3",
        name,
      );
      const hash = createHash("sha256");
      try {
        for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
      } catch {
        throw Error(
          "Faltan archivos del modelo local. Reinstala el paquete completo.",
        );
      }
      if (hash.digest("hex") !== expected)
        throw Error("El modelo local no supera la comprobación de integridad.");
    }
    this.verified = true;
  }
  async analyze(data) {
    const parsed = inputSchema.safeParse(data);
    if (!parsed.success)
      throw Error(
        "Introduce entre 3 y 4.000 caracteres de texto, sin otros campos.",
      );
    if (this.job) throw Error("Ya hay una lectura de IA en curso.");
    const job = { cancelled: false };
    this.job = job;
    const started = Date.now();
    try {
      await this.verify();
      if (job.cancelled) throw Error("Lectura cancelada.");
      const worker = new Worker(path.join(__dirname, "ai-worker.cjs"), {
        workerData: parsed.data,
        resourceLimits: { maxOldGenerationSizeMb: 512 },
      });
      job.worker = worker;
      const raw = await new Promise((resolve, reject) => {
        job.reject = reject;
        const timer = setTimeout(
          () =>
            reject(
              Error("La IA superó 120 segundos. Prueba un texto más corto."),
            ),
          120000,
        );
        job.timer = timer;
        worker.once("message", (m) =>
          m.error ? reject(Error(m.error)) : resolve(m.raw),
        );
        worker.once("error", () =>
          reject(Error("No se pudo iniciar la IA local.")),
        );
        worker.once("exit", (code) => {
          if (code !== 0) reject(Error("El proceso de IA se interrumpió."));
        });
      });
      return {
        ...parseResult(raw, parsed.data.text),
        milliseconds: Date.now() - started,
        model: "Qwen3 0.6B · Q8 · CPU local",
      };
    } finally {
      clearTimeout(job.timer);
      if (job.worker) await job.worker.terminate();
      if (this.job === job) this.job = null;
    }
  }
  async cancel() {
    const job = this.job;
    if (!job) return;
    job.cancelled = true;
    if (job.reject) job.reject(Error("Lectura cancelada."));
    if (job.worker) await job.worker.terminate();
  }
}
module.exports = { LocalAI, parseResult };
