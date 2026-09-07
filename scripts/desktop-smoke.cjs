const { _electron: electron } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const root = path.resolve(__dirname, "..");
  const dir = fs.mkdtempSync(path.join(root, "work", "desktop-v2-"));
  fs.mkdirSync(path.join(root, "output", "playwright"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite");
  const savedStock = () => {
    const db = new DatabaseSync(path.join(dir, "gelatostock.sqlite"), {
      readOnly: true,
    });
    try {
      return (
        Number(
          db.prepare("SELECT stock_milli FROM products WHERE id='p1'").get()
            .stock_milli,
        ) / 1000
      );
    } finally {
      db.close();
    }
  };
  const env = {
    ...process.env,
    GELATO_DATA_DIR: dir,
    TEMP: path.join(root, "work"),
    TMP: path.join(root, "work"),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({
      executablePath: path.join(
        root,
        "dist",
        `GelatoStock-${require("../package.json").version}-win32-x64`,
        "GelatoStock.exe",
      ),
      env,
    });
    const window = await app.firstWindow();
    await window
      .getByRole("heading", { name: "Un buen día empieza en orden." })
      .waitFor();
    assert.equal(await window.title(), "GelatoStock · Tu negocio, en orden");
    const requests = [];
    window.on("request", (r) => requests.push(r.url()));
    await window.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    await window.reload();
    await window
      .getByRole("button", { name: "Registrar stock", exact: true })
      .click();
    await window
      .getByRole("spinbutton", { name: "Cantidad disponible · unidad base" })
      .fill("4.25");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(savedStock(), 4.25);
    assert.ok(requests.every((u) => new URL(u).hostname === "127.0.0.1"));
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v02-desktop.png"),
    });
    await window
      .getByRole("button", { name: "Cargar foto", exact: true })
      .click();
    await window
      .locator("input[name=photo]")
      .setInputFiles(
        path.join(root, "output", "playwright", "v02-desktop.png"),
      );
    await window
      .getByRole("button", { name: "Guardar foto", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window
      .getByRole("button", { name: "Configuración", exact: true })
      .click();
    await window
      .getByRole("heading", { name: "Archivo de fotos", exact: true })
      .waitFor();
    assert.ok((await window.locator(".photo-grid img").count()) > 0);
    assert.equal(savedStock(), 4.25);
    await window
      .getByRole("button", { name: "Inventario", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Entrada / salida", exact: true })
      .click();
    await window
      .getByRole("combobox", { name: "Producto", exact: true })
      .selectOption("p1");
    await window
      .getByRole("combobox", { name: "Tipo de movimiento", exact: true })
      .selectOption("exit");
    await window
      .getByRole("spinbutton", { name: "Cantidad en unidad base", exact: true })
      .fill("1");
    await window
      .getByRole("textbox", { name: "Motivo", exact: true })
      .fill("Consumo de barra");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(savedStock(), 3.25);
    await window
      .getByRole("button", { name: "Actividad", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Revertir", exact: true })
      .first()
      .click();
    await window
      .getByRole("textbox", { name: "Motivo de la corrección", exact: true })
      .fill("Salida duplicada");
    await window
      .getByRole("button", { name: "Registrar corrección", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(savedStock(), 4.25);
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v02-movimientos.png"),
    });
    const runtime = await app.evaluate(({ app }) => ({
      userData: app.getPath("userData"),
      sessionData: app.getPath("sessionData"),
    }));
    assert.ok(runtime.userData.startsWith(dir));
    await app.close();
    app = await electron.launch({
      executablePath: path.join(
        root,
        "dist",
        `GelatoStock-${require("../package.json").version}-win32-x64`,
        "GelatoStock.exe",
      ),
      env,
    });
    const w2 = await app.firstWindow();
    await w2
      .getByRole("heading", { name: "Un buen día empieza en orden." })
      .waitFor();
    assert.equal(savedStock(), 4.25);
    console.log(
      "PASS: ejecutable Windows, recarga con recursos externos bloqueados, conteo persistente, foto manual, salida y corrección trazable, reinicio y perfiles en D.",
    );
    console.log(JSON.stringify(runtime));
  } finally {
    if (app) await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
