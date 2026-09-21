const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// El acceso de inicio llevaba la versión escrita a mano («GelatoStock-0.36.0-win32-x64») y el
// empaquetado borra la carpeta de la versión anterior: al subir de versión dejaba de abrir
// («El sistema no puede encontrar el archivo especificado», 80070002). Debe buscar la última.
test("el acceso de inicio no lleva ninguna versión escrita a mano", () => {
  const file = path.resolve(__dirname, "..", "ABRIR GELATOSTOCK.vbs");
  const vbs = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(
    vbs,
    /GelatoStock-\d+\.\d+\.\d+/,
    "el acceso apunta a una versión concreta: dejará de abrir al empaquetar la siguiente",
  );
  // Busca en dist y arranca el ejecutable que encuentre.
  assert.match(vbs, /dist/);
  assert.match(vbs, /GelatoStock\.exe/);
  // Y sigue guardando datos y temporales dentro de la carpeta del proyecto.
  assert.match(vbs, /GELATO_DATA_DIR/);
  assert.match(vbs, /shell\.Run/);
});
