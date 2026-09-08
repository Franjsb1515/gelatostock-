const { Worker } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { z } = require("zod");
const { reviewReading } = require("./ai-review.cjs");
const manifest = require("../runtime/ai-model.json");
const inputSchema = z
  .object({
    text: z.string().trim().min(3).max(4000),
    mode: z.enum(["standard", "careful"]).default("careful"),
  })
  .strict();
const resultSchema = z
  .object({
    tipo: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(
        z.enum([
          "factura",
          "proforma",
          "abono",
          "albaran",
          "lista_precios",
          "oferta",
          "mensaje",
          "otro",
        ]),
      ),
    evidencia: z.string().min(1).max(1500),
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
    // The model's free-form evidence can paraphrase or invent. Never display it.
    // The excerpt is copied by the application directly from the user's source.
    return {
      tipo: parsed.tipo,
      evidencia: original.slice(0, 500),
      source: "original_excerpt",
      review: true,
    };
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
    if (!/^[a-zA-Z0-9_-]+$/.test(manifest.directory))
      throw Error("Directorio del modelo inválido.");
    for (const [name, expected] of Object.entries(manifest.files)) {
      if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.includes(".."))
        throw Error("Manifiesto del modelo inválido.");
      const file = path.join(
        __dirname,
        "..",
        "runtime",
        "models",
        manifest.directory,
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
        "Introduce entre 3 y 4.000 caracteres y un modo de lectura válido.",
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
            reject(Error("La IA superó 4 minutos. Prueba un texto más corto.")),
          240000,
        );
        job.timer = timer;
        worker.once("message", (m) => {
          if (m.error) {
            reject(Error(m.error));
            return;
          }
          if (
            !Array.isArray(m.outputs) ||
            m.outputs.length !== (parsed.data.mode === "careful" ? 2 : 1) ||
            m.outputs.some((x) => typeof x !== "string" || x.length > 8000)
          ) {
            reject(Error("Respuesta interna de IA inválida."));
            return;
          }
          resolve(m.outputs);
        });
        worker.once("error", () =>
          reject(Error("No se pudo iniciar la IA local.")),
        );
        worker.once("exit", () =>
          reject(Error("El proceso de IA se interrumpió antes de responder.")),
        );
      });
      return {
        ...reviewReading(
          parsed.data.text,
          parseResult(raw[0], parsed.data.text),
          raw[1] ? parseResult(raw[1], parsed.data.text) : undefined,
          parsed.data.mode,
        ),
        milliseconds: Date.now() - started,
        model: `${manifest.label} · ${manifest.dtype.toUpperCase()} · CPU local`,
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
