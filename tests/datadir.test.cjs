const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveDataDir, installedMarker } = require("../src/datadir.cjs");

// Portátil: «data» junto al ejecutable. Instalada (marca del instalador): carpeta local de la
// persona, para que desinstalar o actualizar no toque los datos. GELATO_DATA_DIR manda siempre.
test("carpeta de datos: portátil junto al ejecutable, instalada en la carpeta local de la persona", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "gelato-base-"));
  const local = path.join(os.tmpdir(), "gelato-local");
  try {
    assert.equal(
      resolveDataDir({ env: {}, base, localAppData: local }),
      path.join(base, "data"),
    );
    fs.writeFileSync(path.join(base, installedMarker), "instalado");
    assert.equal(
      resolveDataDir({ env: {}, base, localAppData: local }),
      path.join(local, "GelatoStock", "data"),
    );
    // Sin carpeta local conocida, la app instalada sigue funcionando junto al ejecutable.
    assert.equal(
      resolveDataDir({ env: {}, base, localAppData: "" }),
      path.join(base, "data"),
    );
    assert.equal(
      resolveDataDir({
        env: { GELATO_DATA_DIR: "D:\\otra\\data" },
        base,
        localAppData: local,
      }),
      "D:\\otra\\data",
    );
    // El instalador escribe la marca solo dentro del instalador: la carpeta portátil no la lleva.
    const installer = fs.readFileSync(
      path.resolve(__dirname, "..", "scripts", "installer.cjs"),
      "utf8",
    );
    assert.match(installer, /fs\.rmSync\(marker/);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// Mac: un .app en Aplicaciones no es escribible, así que la app empaquetada guarda en la carpeta
// de soporte de la persona; en desarrollo, en data/ del proyecto. Sin validar en un Mac todavía.
test("carpeta de datos en Mac: soporte de la persona con la app empaquetada, proyecto en desarrollo", () => {
  const base = "/Applications/GelatoStock.app/Contents/MacOS";
  const support = "/Users/ana/Library/Application Support";
  assert.equal(
    resolveDataDir({
      env: {},
      base,
      platform: "darwin",
      packaged: true,
      appData: support,
    }),
    path.join(support, "GelatoStock", "data"),
  );
  assert.equal(
    resolveDataDir({
      env: {},
      base: "/Users/ana/proyecto",
      platform: "darwin",
      packaged: false,
      appData: support,
    }),
    path.join("/Users/ana/proyecto", "data"),
  );
  assert.equal(
    resolveDataDir({
      env: { GELATO_DATA_DIR: "/tmp/otra" },
      base,
      platform: "darwin",
      packaged: true,
      appData: support,
    }),
    "/tmp/otra",
  );
});
