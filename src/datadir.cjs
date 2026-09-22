// Dónde guarda sus datos la app de escritorio.
// - GELATO_DATA_DIR manda siempre (pruebas y acceso de inicio del proyecto).
// - Windows portátil (carpeta dist/ o ZIP): «data» junto al ejecutable, como hasta ahora.
// - Windows instalada con el instalador (scripts/installer.cjs deja «instalado.txt» junto al
//   ejecutable): «GelatoStock\data» en la carpeta local de la persona (%LOCALAPPDATA%), para
//   que desinstalar o actualizar la app nunca toque sus datos.
// - Mac con la app empaquetada (.app, normalmente en Aplicaciones, que no es escribible):
//   «GelatoStock/data» en la carpeta de soporte de la persona (~/Library/Application Support).
//   En desarrollo (npm start), «data» del proyecto. Sin validar todavía en un Mac.
const fs = require("node:fs");
const path = require("node:path");
const installedMarker = "instalado.txt";
function resolveDataDir({
  env,
  base,
  localAppData,
  platform = "win32",
  packaged = true,
  appData,
}) {
  if (env.GELATO_DATA_DIR) return env.GELATO_DATA_DIR;
  if (platform === "darwin") {
    if (packaged && appData) return path.join(appData, "GelatoStock", "data");
    return path.join(base, "data");
  }
  const installed = fs.existsSync(path.join(base, installedMarker));
  if (installed && localAppData)
    return path.join(localAppData, "GelatoStock", "data");
  return path.join(base, "data");
}
module.exports = { resolveDataDir, installedMarker };
