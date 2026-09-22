// Reglas puras del empaquetado (scripts/package.cjs), separadas para poder probarlas en
// tests/package-rules.test.cjs en cualquier sistema: qué módulos nativos se llevan según la
// plataforma, cómo se llama la carpeta de salida y cómo se marca el Info.plist del .app en Mac.
const supported = ["win32", "darwin"];
const outputDirName = (version, platform, arch) =>
  `GelatoStock-${version}-${platform}-${arch}`;
// sharp se carga siempre (lo exige transformers) y solo hace falta el binario de esta
// plataforma; el resto de variantes de @img son peso muerto.
const keepPackages = (platform, arch) =>
  platform === "darwin"
    ? [
        "node_modules/sharp",
        "node_modules/@img/colour",
        `node_modules/@img/sharp-darwin-${arch}`,
        `node_modules/@img/sharp-libvips-darwin-${arch}`,
      ]
    : [
        "node_modules/sharp",
        "node_modules/@img/colour",
        `node_modules/@img/sharp-win32-${arch}`,
      ];
// onnxruntime-web es el backend de navegador (usamos onnxruntime-node); @img se filtra por keepPackages.
const skipPackages = ["node_modules/onnxruntime-web", "node_modules/@img/"];
const keepsPackage = (location, platform, arch) =>
  keepPackages(platform, arch).some(
    (k) => location === k || location.startsWith(k + "/"),
  ) || !skipPackages.some((s) => location === s || location.startsWith(s));
// Binarios de onnxruntime-node de otras plataformas o arquitecturas: no se copian.
const skipsFile = (rel, platform, arch) => {
  const m =
    /^node_modules\/onnxruntime-node\/bin\/[^/]+\/([^/]+)\/([^/]+)\//.exec(rel);
  return !!m && (m[1] !== platform || m[2] !== arch);
};
// Marca de la app en el Info.plist de Electron.app: nombre, identificador y versión.
// Solo cambia claves de texto; si falta una, la añade antes del cierre del diccionario.
function brandPlist(xml, version) {
  const values = {
    CFBundleName: "GelatoStock",
    CFBundleDisplayName: "GelatoStock",
    CFBundleIdentifier: "es.gelatostock.app",
    CFBundleShortVersionString: version,
    CFBundleVersion: version,
  };
  let out = xml;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`);
    if (re.test(out)) out = out.replace(re, `$1${value}$2`);
    else
      out = out.replace(
        /<\/dict>\s*<\/plist>\s*$/,
        `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>\n</plist>\n`,
      );
  }
  return out;
}
module.exports = {
  supported,
  outputDirName,
  keepPackages,
  skipPackages,
  keepsPackage,
  skipsFile,
  brandPlist,
};
