// Measures memory and time of the local AI on this machine: three document readings, one chat
// answer, then the idle footprint after the worker is released. Prints one JSON line at the end.
// Run it on the Mac and send the output: node scripts/measure-ai-memory.cjs
const os = require("node:os");
const { LocalAI } = require("../src/ai.cjs");
const mib = (n) => Math.round(n / 1048576);
(async () => {
  const ai = new LocalAI();
  let peak = process.memoryUsage().rss;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 200);
  const baseline = process.memoryUsage().rss;
  const texts = [
    "FACTURA F-2026-19\nOrigen Coffee\nBase imponible: 40,00 EUR\nIVA: 4,00 EUR\nTOTAL: 44,00 EUR",
    "LISTA DE PRECIOS septiembre. Café 20 EUR/kg. Leche 1 EUR/L.",
    "Hola, te enviaremos la factura mañana cuando terminemos de preparar tu pedido. Gracias.",
  ];
  const readings = [];
  for (const text of texts) {
    const t = Date.now();
    const r = await ai.analyze({ text, mode: "careful" });
    readings.push({
      ms: Date.now() - t,
      tipo: r.tipo,
      rssMiB: mib(process.memoryUsage().rss),
    });
    console.log("lectura", readings.at(-1));
  }
  const t = Date.now();
  const c = await ai.chat({
    messages: [
      { role: "user", content: "¿Qué opinas del helado de pistacho?" },
    ],
  });
  const chat = {
    ms: Date.now() - t,
    source: c.source,
    rssMiB: mib(process.memoryUsage().rss),
  };
  console.log("chat", chat);
  await ai.cancel();
  await new Promise((r) => setTimeout(r, 1500));
  clearInterval(sampler);
  const result = {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    cpu: os.cpus()[0]?.model,
    totalMemGiB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
    threads: process.env.GELATO_AI_THREADS || "auto",
    baselineMiB: mib(baseline),
    peakMiB: mib(peak),
    afterReleaseMiB: mib(process.memoryUsage().rss),
    readings,
    chat,
  };
  console.log(JSON.stringify(result));
})().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
