// Instalador a partir de la carpeta portátil que deja scripts/package.cjs, con electron-builder
// y sin volver a empaquetar nada (--prepackaged).
// - Windows (probado): NSIS → dist/instalador/GelatoStock-Instalador-<versión>.exe. Deja
//   «instalado.txt» junto al ejecutable solo dentro del instalador: así la app instalada guarda
//   los datos en la carpeta local de la persona (src/datadir.cjs) y desinstalar o actualizar
//   nunca los toca. La carpeta portátil queda como estaba al terminar.
// - Mac (preparado desde Windows, SIN validar en un Mac; se ejecuta EN un Mac): DMG →
//   dist/instalador/GelatoStock-Instalador-<versión>-<arch>.dmg. Sin marca: en Mac la app
//   empaquetada guarda siempre en ~/Library/Application Support/GelatoStock/data.
// Sin firma de código en ninguno: Windows (SmartScreen) y macOS (Gatekeeper) avisan; se explica
// en docs/INSTALADOR.md.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { installedMarker } = require("../src/datadir.cjs");
const rules = require("./package-rules.cjs");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const platform = process.platform;
const arch = process.arch;
if (!rules.supported.includes(platform))
  throw Error("El instalador se crea en Windows o en un Mac.");
const dir = path.join(
  root,
  "dist",
  rules.outputDirName(version, platform, arch),
);
const bundle =
  platform === "win32"
    ? path.join(dir, "GelatoStock.exe")
    : path.join(dir, "GelatoStock.app");
if (!fs.existsSync(bundle))
  throw Error(
    "Falta " +
      bundle +
      ". Ejecuta antes: npm run " +
      (platform === "win32" ? "package:win" : "package:mac"),
  );
const marker = path.join(dir, installedMarker);
// Caché y temporales en este mismo disco: con la caché en C: y los temporales en otro
// disco, la extracción de NSIS fallaba con EXDEV (rename entre volúmenes).
const cache = path.join(root, "work", "electron-builder-cache");
const tmp = path.join(root, "work", "tmp");
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
if (platform === "win32")
  fs.writeFileSync(
    marker,
    "Instalado con el instalador de GelatoStock.\r\n" +
      "Los datos de la app están en %LOCALAPPDATA%\\GelatoStock\\data (no en esta carpeta).\r\n" +
      "Este archivo indica a la app que está instalada; si lo borras, guardará los datos aquí.\r\n",
  );
const targetArgs =
  platform === "win32"
    ? ["--win", "nsis"]
    : ["--mac", "dmg", arch === "arm64" ? "--arm64" : "--x64"];
let result;
try {
  result = spawnSync(
    platform === "win32" ? "npx.cmd" : "npx",
    [
      "electron-builder",
      ...targetArgs,
      "--prepackaged",
      dir,
      "--config",
      path.join(root, "electron-builder.json"),
      "--publish",
      "never",
    ],
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: "false",
        ELECTRON_BUILDER_CACHE: cache,
        TMP: tmp,
        TEMP: tmp,
        TMPDIR: tmp,
      },
    },
  );
} finally {
  fs.rmSync(marker, { force: true });
}
if (result.status !== 0) {
  console.error("electron-builder terminó con código " + result.status);
  process.exit(result.status || 1);
}
const out = path.join(
  root,
  "dist",
  "instalador",
  platform === "win32"
    ? `GelatoStock-Instalador-${version}.exe`
    : `GelatoStock-Instalador-${version}-${arch}.dmg`,
);
if (!fs.existsSync(out)) throw Error("No se encuentra el instalador en " + out);
const mb = Math.round(fs.statSync(out).size / 1048576);
console.log(`Instalador creado: ${out} (${mb} MB)`);
