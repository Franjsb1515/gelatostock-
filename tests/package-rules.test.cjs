const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../scripts/package-rules.cjs");

// El empaquetado de Mac se preparó desde Windows: lo que se puede probar aquí son sus reglas.
test("empaquetado: cada plataforma lleva solo sus binarios nativos y su nombre de carpeta", () => {
  assert.equal(
    rules.outputDirName("0.45.0", "win32", "x64"),
    "GelatoStock-0.45.0-win32-x64",
  );
  assert.equal(
    rules.outputDirName("0.45.0", "darwin", "arm64"),
    "GelatoStock-0.45.0-darwin-arm64",
  );
  // sharp y su binario de la plataforma se quedan; las otras variantes de @img y onnxruntime-web no.
  for (const [platform, arch, keep, drop] of [
    [
      "win32",
      "x64",
      "node_modules/@img/sharp-win32-x64",
      "node_modules/@img/sharp-darwin-arm64",
    ],
    [
      "darwin",
      "arm64",
      "node_modules/@img/sharp-darwin-arm64",
      "node_modules/@img/sharp-win32-x64",
    ],
    [
      "darwin",
      "arm64",
      "node_modules/@img/sharp-libvips-darwin-arm64",
      "node_modules/@img/sharp-libvips-darwin-x64",
    ],
    [
      "darwin",
      "x64",
      "node_modules/@img/sharp-darwin-x64",
      "node_modules/@img/sharp-darwin-arm64",
    ],
  ]) {
    assert.equal(rules.keepsPackage(keep, platform, arch), true, keep);
    assert.equal(rules.keepsPackage(drop, platform, arch), false, drop);
    assert.equal(
      rules.keepsPackage("node_modules/sharp", platform, arch),
      true,
    );
    assert.equal(
      rules.keepsPackage("node_modules/@img/colour", platform, arch),
      true,
    );
    assert.equal(
      rules.keepsPackage("node_modules/onnxruntime-web", platform, arch),
      false,
    );
    assert.equal(rules.keepsPackage("node_modules/zod", platform, arch), true);
  }
  // onnxruntime-node: solo el binario de esta plataforma y arquitectura.
  const bin = (p, a) =>
    `node_modules/onnxruntime-node/bin/napi-v6/${p}/${a}/onnxruntime_binding.node`;
  assert.equal(rules.skipsFile(bin("win32", "x64"), "win32", "x64"), false);
  assert.equal(rules.skipsFile(bin("darwin", "arm64"), "win32", "x64"), true);
  assert.equal(rules.skipsFile(bin("win32", "arm64"), "win32", "x64"), true);
  assert.equal(
    rules.skipsFile(bin("darwin", "arm64"), "darwin", "arm64"),
    false,
  );
  assert.equal(rules.skipsFile(bin("darwin", "x64"), "darwin", "arm64"), true);
  assert.equal(rules.skipsFile(bin("linux", "x64"), "darwin", "arm64"), true);
  assert.equal(
    rules.skipsFile("node_modules/zod/index.js", "darwin", "arm64"),
    false,
  );
});

test("empaquetado Mac: el Info.plist de Electron.app queda con nombre, identificador y versión de la app", () => {
  const sample = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>CFBundleDisplayName</key>
\t<string>Electron</string>
\t<key>CFBundleExecutable</key>
\t<string>Electron</string>
\t<key>CFBundleIconFile</key>
\t<string>electron.icns</string>
\t<key>CFBundleIdentifier</key>
\t<string>com.github.Electron</string>
\t<key>CFBundleName</key>
\t<string>Electron</string>
\t<key>CFBundleShortVersionString</key>
\t<string>44.2.0</string>
\t<key>CFBundleVersion</key>
\t<string>44.2.0</string>
</dict>
</plist>
`;
  const out = rules.brandPlist(sample, "0.45.0");
  const value = (key) =>
    new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(out)?.[1];
  assert.equal(value("CFBundleName"), "GelatoStock");
  assert.equal(value("CFBundleDisplayName"), "GelatoStock");
  assert.equal(value("CFBundleIdentifier"), "es.gelatostock.app");
  assert.equal(value("CFBundleShortVersionString"), "0.45.0");
  assert.equal(value("CFBundleVersion"), "0.45.0");
  // Lo que no es de la marca no se toca: el ejecutable y el archivo del icono siguen igual.
  assert.equal(value("CFBundleExecutable"), "Electron");
  assert.equal(value("CFBundleIconFile"), "electron.icns");
  // Una clave que falte se añade sin romper el plist.
  const minimal = `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleExecutable</key>\n\t<string>Electron</string>\n</dict>\n</plist>\n`;
  const added = rules.brandPlist(minimal, "0.45.0");
  assert.match(
    added,
    /<key>CFBundleName<\/key>\s*<string>GelatoStock<\/string>/,
  );
  assert.match(added, /<\/dict>\s*<\/plist>\s*$/);
  assert.equal((added.match(/<\/dict>/g) || []).length, 1);
});
