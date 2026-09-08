// Development-only downloader: the delivered app never downloads a model.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const manifest = require("../runtime/ai-model.json");
(async () => {
  const root = path.resolve(__dirname, "../runtime/models/qwen3");
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (name.includes("..") || path.isAbsolute(name))
      throw Error("Ruta inválida");
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = target + ".download";
    const response = await fetch(
      `https://huggingface.co/${manifest.repository}/resolve/${manifest.revision}/${name}`,
    );
    if (!response.ok) throw Error("Descarga fallida: " + name);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tmp));
    const hash = crypto.createHash("sha256");
    for await (const part of fs.createReadStream(tmp)) hash.update(part);
    if (hash.digest("hex") !== expected)
      throw Error("Huella distinta: " + name);
    fs.renameSync(tmp, target);
    console.log("Verificado: " + name);
  }
  fs.copyFileSync(
    path.resolve(__dirname, "../docs/licenses/QWEN3-APACHE-2.0.txt"),
    path.join(root, "LICENSE"),
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
