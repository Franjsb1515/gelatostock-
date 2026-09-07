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
  fs.cpSync(path.join(root, location), path.join(app, location), {
    recursive: true,
  });
}
