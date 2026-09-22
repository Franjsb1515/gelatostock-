// Instalador de Windows a partir de la carpeta portátil que deja scripts/package.cjs.
// Envuelve esa carpeta tal cual con electron-builder (NSIS): no vuelve a empaquetar nada.
// Deja «instalado.txt» junto al ejecutable solo dentro del instalador: así la app instalada
// guarda los datos en la carpeta local de la persona (src/datadir.cjs) y desinstalar o
// actualizar nunca los toca. La carpeta portátil queda como estaba al terminar.
// Sin firma de código: Windows avisará (SmartScreen) al abrirlo; se explica en docs/INSTALADOR.md.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { installedMarker } = require("../src/datadir.cjs");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const dir = path.join(root, "dist", `GelatoStock-${version}-win32-x64`);
if (process.platform !== "win32")
  throw Error("El instalador se crea en Windows.");
if (!fs.existsSync(path.join(dir, "GelatoStock.exe")))
  throw Error("Falta " + dir + ". Ejecuta antes: npm run package:win");
const marker = path.join(dir, installedMarker);
const cache = path.join(root, "work", "electron-builder-cache");
const tmp = path.join(root, "work", "tmp");
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(
  marker,
  "Instalado con el instalador de GelatoStock.\r\n" +
    "Los datos de la app están en %LOCALAPPDATA%\\GelatoStock\\data (no en esta carpeta).\r\n" +
    "Este archivo indica a la app que está instalada; si lo borras, guardará los datos aquí.\r\n",
);
let result;
try {
  result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "electron-builder",
      "--win",
      "nsis",
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
      // Caché y temporales en este mismo disco: con la caché en C: y los temporales en otro
      // disco, la extracción de NSIS fallaba con EXDEV (rename entre volúmenes).
      env: {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: "false",
        ELECTRON_BUILDER_CACHE: cache,
        TMP: tmp,
        TEMP: tmp,
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
  `GelatoStock-Instalador-${version}.exe`,
);
if (!fs.existsSync(out)) throw Error("No se encuentra el instalador en " + out);
const mb = Math.round(fs.statSync(out).size / 1048576);
console.log(`Instalador creado: ${out} (${mb} MB)`);
