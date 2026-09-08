const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const dest = path.join(root, "dist", `GelatoStock-${version}-win32-x64`);
if (process.platform !== "win32")
  throw Error(
    "Este empaquetado requiere Windows. Preparar y probar Mac por separado.",
  );
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
console.log("Aplicación portátil creada en " + newExe);

fs.cpSync(path.join(root, "build"), path.join(app, "build"), {
  recursive: true,
});
fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
// Copy the locked production dependency graph, including local OCR WASM/language files.
const lock = require("../package-lock.json");
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location || info.dev || !location.startsWith("node_modules/")) continue;
  if (info.optional && !fs.existsSync(path.join(root, location))) continue;
  fs.cpSync(path.join(root, location), path.join(app, location), {
    recursive: true,
  });
}

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
