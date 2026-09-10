const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const distRoot = path.join(root, "dist");
const dest = path.join(distRoot, `GelatoStock-${version}-win32-x64`);
if (process.platform !== "win32")
  throw Error(
    "Este empaquetado requiere Windows. Preparar y probar Mac por separado.",
  );
// Old builds are only disk weight (2 GB each): keep the newest two, this one included.
const KEEP_BUILDS = 2;
if (fs.existsSync(distRoot)) {
  const builds = fs
    .readdirSync(distRoot)
    .filter((n) => /^GelatoStock-\d+\.\d+\.\d+-win32-x64$/.test(n))
    .filter((n) => n !== path.basename(dest))
    .map((n) => ({ n, at: fs.statSync(path.join(distRoot, n)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  for (const b of builds.slice(KEEP_BUILDS - 1)) {
    fs.rmSync(path.join(distRoot, b.n), { recursive: true, force: true });
    console.log("Versión antigua eliminada: " + b.n);
  }
}
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(root, "node_modules", "electron", "dist"), dest, {
  recursive: true,
});
const oldExe = path.join(dest, "electron.exe");
const newExe = path.join(dest, "GelatoStock.exe");
if (fs.existsSync(newExe)) fs.unlinkSync(newExe);
fs.renameSync(oldExe, newExe);
const app = path.join(dest, "resources", "app");
fs.mkdirSync(app, { recursive: true });
fs.cpSync(path.join(root, "src"), path.join(app, "src"), { recursive: true });
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify({
    name: "appgelatostock",
    version,
    main: "src/desktop.cjs",
  }),
);

fs.cpSync(path.join(root, "build"), path.join(app, "build"), {
  recursive: true,
});
fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
// Not shipped: never executed by this app on Windows x64 (measured 0.17.0/0.17.1).
// onnxruntime-web is the browser backend (we use onnxruntime-node) and the node build of
// transformers does not require it; sharp IS required at load by transformers (verified: the
// pruned package failed with "Cannot find module 'sharp'"), so sharp stays with only its
// Windows x64 binary; the other @img platform variants and onnxruntime-node binaries for
// darwin/linux/win32-arm64 are dead weight here.
const keepPackages = [
  "node_modules/sharp",
  "node_modules/@img/colour",
  "node_modules/@img/sharp-win32-x64",
];
const skipPackages = ["node_modules/onnxruntime-web", "node_modules/@img/"];
const skipFile = (source) => {
  const rel = path.relative(root, source).split(path.sep).join("/");
  return (
    /^node_modules\/onnxruntime-node\/bin\/[^/]+\/(darwin|linux)\//.test(rel) ||
    /^node_modules\/onnxruntime-node\/bin\/[^/]+\/win32\/arm64/.test(rel)
  );
};
// Copy the locked production dependency graph, including local OCR WASM/language files.
const lock = require("../package-lock.json");
let skipped = 0;
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location || info.dev || !location.startsWith("node_modules/")) continue;
  if (
    !keepPackages.some((k) => location === k || location.startsWith(k + "/")) &&
    skipPackages.some((s) => location === s || location.startsWith(s))
  ) {
    skipped++;
    continue;
  }
  if (info.optional && !fs.existsSync(path.join(root, location))) continue;
  fs.cpSync(path.join(root, location), path.join(app, location), {
    recursive: true,
    filter: (source) => !skipFile(source),
  });
}
console.log("Paquetes omitidos por no usarse en Windows x64: " + skipped);

const manifest = require("../runtime/ai-model.json");
if (!/^[a-zA-Z0-9_-]+$/.test(manifest.directory))
  throw Error("Directorio de modelo inválido");
fs.cpSync(path.join(root, "runtime"), path.join(app, "runtime"), {
  recursive: true,
  filter: (source) => source !== path.join(root, "runtime", "models"),
});
for (const name of [...Object.keys(manifest.files), "LICENSE"]) {
  if (name.includes("..") || path.isAbsolute(name))
    throw Error("Archivo de modelo inválido");
  const from = path.join(root, "runtime", "models", manifest.directory, name);
  const to = path.join(app, "runtime", "models", manifest.directory, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
console.log("Aplicación portátil creada en " + newExe);
