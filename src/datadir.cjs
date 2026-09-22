// Dónde guarda sus datos la app de escritorio.
// - GELATO_DATA_DIR manda siempre (pruebas y acceso de inicio del proyecto).
// - Versión portátil (carpeta dist/ o ZIP): «data» junto al ejecutable, como hasta ahora.
// - Versión instalada con el instalador (scripts/installer.cjs deja «instalado.txt» junto al
//   ejecutable): «GelatoStock\data» en la carpeta local de la persona (%LOCALAPPDATA%), para
//   que desinstalar o actualizar la app nunca toque sus datos.
const fs = require("node:fs");
const path = require("node:path");
const installedMarker = "instalado.txt";
function resolveDataDir({ env, base, localAppData }) {
  if (env.GELATO_DATA_DIR) return env.GELATO_DATA_DIR;
  const installed = fs.existsSync(path.join(base, installedMarker));
  if (installed && localAppData)
    return path.join(localAppData, "GelatoStock", "data");
  return path.join(base, "data");
}
module.exports = { resolveDataDir, installedMarker };
