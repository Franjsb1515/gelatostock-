// Aplicación portátil: copia Electron y la app con solo los módulos nativos de esta plataforma.
// Windows (probado): dist/GelatoStock-<versión>-win32-x64/GelatoStock.exe.
// Mac (preparado desde Windows, SIN validar en un Mac): dist/GelatoStock-<versión>-darwin-<arch>/
// GelatoStock.app, a partir de Electron.app con el Info.plist marcado y el icono de la marca.
// Las reglas de qué se copia viven en scripts/package-rules.cjs (probadas en tests/).
const fs = require("node:fs");
const path = require("node:path");
const rules = require("./package-rules.cjs");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const platform = process.platform;
const arch = process.arch;
if (!rules.supported.includes(platform))
  throw Error("Este empaquetado es para Windows o Mac.");
const distRoot = path.join(root, "dist");
const dest = path.join(distRoot, rules.outputDirName(version, platform, arch));
// Old builds are only disk weight (2 GB each): keep the newest two of this platform, this one included.
const KEEP_BUILDS = 2;
if (fs.existsSync(distRoot)) {
  const builds = fs
    .readdirSync(distRoot)
    .filter((n) =>
      new RegExp(`^GelatoStock-\\d+\\.\\d+\\.\\d+-${platform}-[a-z0-9]+$`).test(
        n,
      ),
    )
    .filter((n) => n !== path.basename(dest))
    .map((n) => ({ n, at: fs.statSync(path.join(distRoot, n)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  for (const b of builds.slice(KEEP_BUILDS - 1)) {
    fs.rmSync(path.join(distRoot, b.n), { recursive: true, force: true });
    console.log("Versión antigua eliminada: " + b.n);
  }
}
fs.mkdirSync(dest, { recursive: true });
const electronDist = path.join(root, "node_modules", "electron", "dist");
let app;
let launcher;
if (platform === "win32") {
  fs.cpSync(electronDist, dest, { recursive: true });
  const oldExe = path.join(dest, "electron.exe");
  launcher = path.join(dest, "GelatoStock.exe");
  if (fs.existsSync(launcher)) fs.unlinkSync(launcher);
  fs.renameSync(oldExe, launcher);
  app = path.join(dest, "resources", "app");
} else {
  // Electron.app lleva enlaces simbólicos dentro de sus frameworks: se copian como enlaces.
  launcher = path.join(dest, "GelatoStock.app");
  fs.rmSync(launcher, { recursive: true, force: true });
  fs.cpSync(path.join(electronDist, "Electron.app"), launcher, {
    recursive: true,
    verbatimSymlinks: true,
  });
  const plist = path.join(launcher, "Contents", "Info.plist");
  fs.writeFileSync(
    plist,
    rules.brandPlist(fs.readFileSync(plist, "utf8"), version),
  );
  const icns = path.join(root, "build-assets", "icon.icns");
  if (fs.existsSync(icns))
    fs.copyFileSync(
      icns,
      path.join(launcher, "Contents", "Resources", "electron.icns"),
    );
  app = path.join(launcher, "Contents", "Resources", "app");
}
fs.mkdirSync(app, { recursive: true });
fs.cpSync(path.join(root, "src"), path.join(app, "src"), { recursive: true });
// Icono de la ventana (src/desktop.cjs); el .ico/.icns los usa el instalador (scripts/installer.cjs).
fs.cpSync(path.join(root, "build-assets"), path.join(app, "build-assets"), {
  recursive: true,
});
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
// Not shipped: never executed by this app on this platform (measured 0.17.0/0.17.1 on Windows x64).
// sharp IS required at load by transformers (verified: the pruned package failed with "Cannot
// find module 'sharp'"), so sharp stays with only this platform's binary.
const skipFile = (source) =>
  rules.skipsFile(
    path.relative(root, source).split(path.sep).join("/"),
    platform,
    arch,
  );
// Copy the locked production dependency graph, including local OCR WASM/language files.
const lock = require("../package-lock.json");
let skipped = 0;
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location || info.dev || !location.startsWith("node_modules/")) continue;
  if (!rules.keepsPackage(location, platform, arch)) {
    skipped++;
    continue;
  }
  if (info.optional && !fs.existsSync(path.join(root, location))) continue;
  fs.cpSync(path.join(root, location), path.join(app, location), {
    recursive: true,
    filter: (source) => !skipFile(source),
  });
}
console.log(
  `Paquetes omitidos por no usarse en ${platform} ${arch}: ` + skipped,
);

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
console.log("Aplicación portátil creada en " + launcher);
