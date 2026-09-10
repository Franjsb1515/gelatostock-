const { Worker } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { z } = require("zod");
const os = require("node:os");
// Threads for ONNX inside the worker, measured on a 16-thread i7 (P+E cores): 2 threads ≈ 19 s
// per reading, 4 ≈ 17 s, 6 ≈ 50 s (oversubscription). A quarter of the logical CPUs, 2 to 4.
// Override with GELATO_AI_THREADS to tune another machine.
const aiThreads =
  Number(process.env.GELATO_AI_THREADS) ||
  Math.max(2, Math.min(4, Math.floor(os.cpus().length / 4)));
const IDLE_MS = 3 * 60 * 1000;
const { reviewReading } = require("./ai-review.cjs");
const manifest = require("../runtime/ai-model.json");
const inputSchema = z
  .object({
    text: z.string().trim().min(3).max(4000),
    mode: z.enum(["standard", "careful"]).default("careful"),
  })
  .strict();
const chatSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(1500),
          })
          .strict(),
      )
      .min(1)
      .max(6)
      .refine((m) => m.length > 0 && m[m.length - 1].role === "user", {
        message: "last message must be from the user",
      }),
    document: z.string().trim().max(4000).optional(),
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
    // Never displayed: the excerpt shown comes from the original. Optional so the model can
    // answer with the type alone (shorter output, ~4x faster on CPU).
    evidencia: z.string().max(1500).optional(),
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
const replyCategories = [
  "out_of_stock",
  "cancellation",
  "closed",
  "payment",
  "change",
  "question",
  "document",
  "delivery_date",
  "confirmation",
  "other",
];
const replyAliases = {
  falta: "out_of_stock",
  cancelacion: "cancellation",
  cancelación: "cancellation",
  cambio: "change",
  cierre: "closed",
  pago: "payment",
  documento: "document",
  pregunta: "question",
  entrega: "delivery_date",
  confirmacion: "confirmation",
  confirmación: "confirmation",
  otro: "other",
};
const replySchema = z
  .object({
    categoria: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => replyAliases[v] || v)
      .pipe(z.enum(replyCategories)),
  })
  .strict();
function parseReply(raw) {
  try {
    return replySchema.parse(
      JSON.parse(
        raw
          .trim()
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, ""),
      ),
    ).categoria;
  } catch {
    return null;
  }
}
// Two readings of a supplier reply. Agreement is not certainty; the result is an annotation only.
function combineReplies(first, second) {
  if (!first || !second) return { category: "other", status: "invalid" };
  if (first !== second) return { category: "other", status: "disagreement" };
  return { category: first, status: "agreement" };
}
const NO_ANSWER =
  "No tengo una respuesta fiable para eso. Consulta la guía de la app o revisa el documento original.";
// Plain text only: no thinking blocks, no markup, bounded length. The UI escapes it again.
function sanitizeAnswer(raw) {
  let s = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/<[^>]{0,200}>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length > 1200) s = s.slice(0, 1200).replace(/\s+\S*$/, "") + "…";
  return s || NO_ANSWER;
}
class LocalAI {
  constructor() {
    this.job = null;
    this.verified = false;
    this.worker = null;
    this.idleTimer = null;
    this.seq = 0;
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
  async terminateWorker() {
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const w = this.worker;
    this.worker = null;
    if (w) await w.terminate().catch(() => {});
  }
  // One persistent worker: the model loads once and stays for a few minutes of inactivity.
  // It receives only validated data and returns only strings.
  async ensureWorker() {
    if (this.worker) return this.worker;
    const worker = new Worker(path.join(__dirname, "ai-worker.cjs"), {
      workerData: { threads: aiThreads },
      resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    this.worker = worker;
    worker.on("exit", () => {
      if (this.worker === worker) this.worker = null;
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(Error("La IA local tardó demasiado en cargar el modelo."));
      }, 120000);
      worker.once("message", (m) => {
        clearTimeout(timer);
        if (m.ready) resolve();
        else
          reject(
            Object.assign(Error(m.error || "No se pudo iniciar la IA local."), {
              detail: m.detail || "",
            }),
          );
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(Error("No se pudo iniciar la IA local."));
      });
      worker.once("exit", () => {
        clearTimeout(timer);
        reject(Error("El proceso de IA se interrumpió antes de responder."));
      });
    }).catch(async (e) => {
      await this.terminateWorker();
      throw e;
    });
    return worker;
  }
  async run(workerData, expectedOutputs) {
    if (this.job) throw Error("Ya hay una lectura de IA en curso.");
    const job = { cancelled: false };
    this.job = job;
    clearTimeout(this.idleTimer);
    try {
      await this.verify();
      if (job.cancelled) throw Error("Lectura cancelada.");
      const worker = await this.ensureWorker();
      if (job.cancelled) throw Error("Lectura cancelada.");
      job.worker = worker;
      const id = ++this.seq;
      return await new Promise((resolve, reject) => {
        job.reject = reject;
        job.timer = setTimeout(
          () =>
            reject(Error("La IA superó 4 minutos. Prueba un texto más corto.")),
          240000,
        );
        const onMessage = (m) => {
          if (m.id !== id) return;
          cleanup();
          if (m.error) {
            reject(Object.assign(Error(m.error), { detail: m.detail || "" }));
            return;
          }
          if (
            !Array.isArray(m.outputs) ||
            m.outputs.length !== expectedOutputs ||
            m.outputs.some((x) => typeof x !== "string" || x.length > 8000)
          ) {
            reject(Error("Respuesta interna de IA inválida."));
            return;
          }
          resolve(m.outputs);
        };
        const onError = () => {
          cleanup();
          reject(Error("No se pudo iniciar la IA local."));
        };
        const onExit = () => {
          cleanup();
          reject(Error("El proceso de IA se interrumpió antes de responder."));
        };
        const cleanup = () => {
          worker.off("message", onMessage);
          worker.off("error", onError);
          worker.off("exit", onExit);
        };
        job.cleanup = cleanup;
        worker.on("message", onMessage);
        worker.once("error", onError);
        worker.once("exit", onExit);
        worker.postMessage({ id, ...workerData });
      });
    } catch (e) {
      // A failed or cancelled job leaves the worker in an unknown state: start clean next time.
      if (job.cleanup) job.cleanup();
      await this.terminateWorker();
      throw e;
    } finally {
      clearTimeout(job.timer);
      if (this.job === job) this.job = null;
      if (this.worker) {
        this.idleTimer = setTimeout(() => {
          if (!this.job) this.terminateWorker();
        }, IDLE_MS);
        if (this.idleTimer.unref) this.idleTimer.unref();
      }
    }
  }
  get modelLabel() {
    return `${manifest.label} · ${manifest.dtype.toUpperCase()} · CPU local`;
  }
  async analyze(data) {
    const parsed = inputSchema.safeParse(data);
    if (!parsed.success)
      throw Error(
        "Introduce entre 3 y 4.000 caracteres y un modo de lectura válido.",
      );
    const started = Date.now();
    const raw = await this.run(
      { kind: "classify", ...parsed.data },
      parsed.data.mode === "careful" ? 2 : 1,
    );
    return {
      ...reviewReading(
        parsed.data.text,
        parseResult(raw[0], parsed.data.text),
        raw[1] ? parseResult(raw[1], parsed.data.text) : undefined,
        parsed.data.mode,
      ),
      milliseconds: Date.now() - started,
      model: this.modelLabel,
    };
  }
  async readReply(text) {
    const parsed = z.string().trim().min(1).max(5000).safeParse(text);
    if (!parsed.success) throw Error("Mensaje vacío o demasiado largo.");
    const started = Date.now();
    const raw = await this.run({ kind: "reply", text: parsed.data }, 2);
    return {
      ...combineReplies(parseReply(raw[0]), parseReply(raw[1])),
      milliseconds: Date.now() - started,
      model: this.modelLabel,
    };
  }
  async chat(data) {
    const parsed = chatSchema.safeParse(data);
    if (!parsed.success)
      throw Error(
        "Escribe una pregunta de hasta 1.500 caracteres; el chat conserva como máximo los últimos 6 mensajes.",
      );
    const started = Date.now();
    const { combineChat } = require("./ai-guide.cjs");
    const question = parsed.data.messages.at(-1).content;
    // Rules first: action requests and questions the guide covers are answered without the model.
    const direct = parsed.data.document ? null : combineChat(question, null);
    if (direct)
      return {
        ...direct,
        review: true,
        milliseconds: Date.now() - started,
        model: "Reglas sobre la guía, sin modelo",
      };
    const raw = await this.run({ kind: "chat", ...parsed.data }, 1);
    return {
      ...combineChat(question, sanitizeAnswer(raw[0])),
      review: true,
      milliseconds: Date.now() - started,
      model: this.modelLabel,
    };
  }
  async cancel() {
    const job = this.job;
    if (job) {
      job.cancelled = true;
      if (job.reject) job.reject(Error("Lectura cancelada."));
    }
    await this.terminateWorker();
  }
}
module.exports = {
  LocalAI,
  parseResult,
  parseReply,
  combineReplies,
  sanitizeAnswer,
  NO_ANSWER,
};
