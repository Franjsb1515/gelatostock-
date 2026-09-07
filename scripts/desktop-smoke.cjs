const { _electron: electron } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const root = path.resolve(__dirname, "..");
  const dir = path.join(root, "work", "desktop-test");
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
        "GelatoStock-win32-x64",
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
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(dir, "stock.json"), "utf8"))
        .products[0].stock,
      4.25,
    );
    assert.ok(requests.every((u) => new URL(u).hostname === "127.0.0.1"));
    await window.screenshot({
      path: path.join(root, "output", "playwright", "04-desktop.png"),
    });
    await window
      .getByRole("button", { name: "Cargar foto", exact: true })
      .click();
    await window
      .locator("input[name=photo]")
      .setInputFiles(path.join(root, "output", "playwright", "04-desktop.png"));
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
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(dir, "stock.json"), "utf8"))
        .products[0].stock,
      4.25,
    );
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
        "GelatoStock-win32-x64",
        "GelatoStock.exe",
      ),
      env,
    });
    const w2 = await app.firstWindow();
    await w2
      .getByRole("heading", { name: "Un buen día empieza en orden." })
      .waitFor();
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(dir, "stock.json"), "utf8"))
        .products[0].stock,
      4.25,
    );
    console.log(
      "PASS: ejecutable Windows, recarga con recursos externos bloqueados, conteo persistente, foto manual sin alterar stock, reinicio y perfiles en D.",
    );
    console.log(JSON.stringify(runtime));
  } finally {
    if (app) await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
