const { _electron: electron } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const root = path.resolve(__dirname, "..");
  const dir = fs.mkdtempSync(path.join(root, "work", "desktop-v8-"));
  fs.mkdirSync(path.join(root, "output", "playwright"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite");
  const savedStock = (id = "p1") => {
    const db = new DatabaseSync(path.join(dir, "gelatostock.sqlite"), {
      readOnly: true,
    });
    try {
      return (
        Number(
          db.prepare("SELECT stock_milli FROM products WHERE id=?").get(id)
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
    // La prueba no sale a internet: la consulta automática de cruceros queda apagada.
    GELATO_CRUISES_AUTO: "0",
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
    const pageErrors = [];
    window.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
    window.on("console", (m) => {
      if (m.type() === "error")
        pageErrors.push("console: " + m.text().slice(0, 300));
    });
    process.on("exit", () => {
      if (pageErrors.length)
        console.log("ERRORES DE PÁGINA:\n" + pageErrors.join("\n"));
      try {
        const ia = path.join(dir, "runtime", "logs", "ia.log");
        if (fs.existsSync(ia))
          console.log("REGISTRO IA:\n" + fs.readFileSync(ia, "utf8").trim());
      } catch {}
    });
    await window
      .getByRole("heading", { name: "Un buen día empieza en orden." })
      .waitFor();
    assert.equal(await window.title(), "GelatoStock · Tu negocio, en orden");
    // Diagnóstico: quién llama a render y con qué página (se imprime solo si falla la IA).
    await window.evaluate(() => {
      window.__navLog = [];
      const original = render;
      render = function () {
        window.__navLog.push(
          new Date().toISOString().slice(11, 19) +
            " " +
            page +
            " <- " +
            (new Error().stack || "")
              .split("\n")
              .slice(2, 5)
              .join(" <- ")
              .replace(/https?:\/\/[^/]+\//g, ""),
        );
        return original.apply(this, arguments);
      };
    });
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
      .getByRole("spinbutton", { name: "Cantidad que hay ahora en kilos" })
      .fill("4.25");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(savedStock(), 4.25);
    assert.ok(requests.every((u) => new URL(u).hostname === "127.0.0.1"));
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v08-desktop.png"),
    });
    await window
      .getByRole("button", { name: "Cargar foto", exact: true })
      .click();
    await window
      .locator("input[name=photo]")
      .setInputFiles(path.join(root, "tests", "fixtures", "factura-ocr.png"));
    await window
      .locator(".detection-status")
      .filter({ hasText: "Proveedor propuesto: Origen Coffee" })
      .waitFor();
    assert.equal(
      await window
        .getByRole("combobox", { name: "Proveedor del documento", exact: true })
        .inputValue(),
      "s1",
    );
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v08-ocr.png"),
    });
    await window.locator("input[name=documentDate]").fill("2026-09-01");
    await window
      .getByRole("button", { name: "Guardar documento", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    // Un PDF con texto se lee del propio archivo dentro del ejecutable, sin OCR ni red.
    await window
      .getByRole("button", { name: "Cargar foto", exact: true })
      .click();
    await window
      .locator("input[name=photo]")
      .setInputFiles(path.join(root, "tests", "fixtures", "factura-texto.pdf"));
    await window
      .locator("#photo-preview")
      .filter({ hasText: "PDF de 1 página leído" })
      .waitFor();
    const pdfText = await window.locator("textarea[name=ocrText]").inputValue();
    assert.match(pdfText, /FACTURA F-2026-114/);
    assert.match(pdfText, /Total: 121,00 EUR/);
    await window
      .getByRole("button", { name: "Cancelar", exact: true })
      .first()
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    // Un PDF escaneado no trae texto: lo dice y no inventa proveedor.
    await window
      .getByRole("button", { name: "Cargar foto", exact: true })
      .click();
    await window
      .locator("input[name=photo]")
      .setInputFiles(
        path.join(root, "tests", "fixtures", "escaneo-sin-texto.pdf"),
      );
    await window
      .locator(".detection-status")
      .filter({ hasText: "no trae texto dentro" })
      .waitFor();
    assert.equal(
      await window.locator("textarea[name=ocrText]").inputValue(),
      "",
    );
    await window
      .getByRole("button", { name: "Cancelar", exact: true })
      .first()
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    console.log(
      "PASS: el texto de un PDF se lee dentro del ejecutable (factura F-2026-114 con su total) y un escaneo sin texto lo dice sin inventar proveedor.",
    );
    await window
      .getByRole("button", { name: "Configuración", exact: true })
      .click();
    await window
      .getByRole("heading", {
        name: "Archivo de fotos y documentos",
        exact: true,
      })
      .waitFor();
    assert.ok((await window.locator(".photo-grid img").count()) > 0);
    await window
      .getByRole("button", { name: "Organizar", exact: true })
      .first()
      .click();
    await window
      .getByRole("combobox", { name: "Proveedor del documento", exact: true })
      .selectOption("s2");
    await window.locator("input[name=documentDate]").fill("2026-09-02");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window
      .locator(".photo-grid")
      .getByText("2026-09-02", { exact: true })
      .waitFor();
    const archive = JSON.parse(
      fs.readFileSync(path.join(dir, "proveedores", "indice.json"), "utf8"),
    );
    assert.ok(
      fs.existsSync(
        path.join(
          dir,
          "proveedores",
          archive.find((x) => x.id === "s2").carpeta,
          "fotos",
          "2026-09-02",
        ),
      ),
    );
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v08-fotos.png"),
      fullPage: true,
    });
    assert.equal(savedStock(), 4.25);
    await window
      .getByRole("button", { name: "Documentos", exact: true })
      .click();
    await window
      .getByRole("heading", { name: "Documentos por proveedor" })
      .waitFor();
    assert.ok((await window.locator(".doc-card").count()) >= 1);
    await window.locator("#doc-supplier").selectOption("s2");
    assert.ok((await window.locator(".doc-card").count()) >= 1);
    assert.ok(
      (await window
        .getByRole("button", { name: "Vincular pedido", exact: true })
        .count()) >= 1,
    );
    console.log(
      "PASS: pantalla Documentos por proveedor con filtros y vínculo a pedido disponible.",
    );
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
      .getByRole("spinbutton", { name: "Cantidad en kilos", exact: true })
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
    // Merma de un ingrediente con los mismos motivos que el cierre del día (otro producto,
    // para no tocar la cuenta de p1). El texto libre pasa a ser un detalle opcional.
    await window
      .getByRole("button", { name: "Inventario", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Entrada / salida", exact: true })
      .click();
    await window
      .getByRole("combobox", { name: "Producto", exact: true })
      .selectOption("p3");
    await window
      .getByRole("combobox", { name: "Tipo de movimiento", exact: true })
      .selectOption("waste");
    await window
      .getByRole("combobox", { name: "Motivo de la merma", exact: true })
      .selectOption("accident");
    await window
      .getByRole("spinbutton", { name: "Cantidad en kilos", exact: true })
      .fill("0.2");
    await window
      .getByRole("textbox", { name: "Detalle (opcional)", exact: true })
      .fill("se cayó el bote");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(
      await window.evaluate(() => {
        const m = state.movements.find((x) => x.product === "p3");
        return [m.kind, m.reason, product("p3").stock];
      }),
      ["waste", "Merma · Caída o rotura · se cayó el bote", 3],
    );
    // Objetivo de merma de ese producto, en su unidad: la app solo avisa en el inicio.
    await window
      .locator('[data-action="setWasteGoal"][data-product="p3"]')
      .click();
    await window
      .getByRole("combobox", { name: "Cómo lo mides", exact: true })
      .selectOption("quantity");
    await window
      .getByRole("spinbutton", { name: "No pasar de", exact: true })
      .fill("0.1");
    await window
      .getByRole("button", { name: "Guardar objetivo", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(
      await window.evaluate(() => {
        const w = alerts.waste.find((x) => x.product === "p3");
        return [w.mode, w.goal, w.waste, w.over];
      }),
      ["quantity", 0.1, 0.2, true],
    );
    await window.getByRole("button", { name: "Resumen", exact: true }).click();
    const avisoMerma = (
      await window.locator(".home-notice").first().innerText()
    ).replace(/\s+/g, " ");
    assert.match(
      avisoMerma,
      /Merma por encima de tu objetivo: Pistacho siciliano/,
    );
    assert.match(avisoMerma, /0,2 kg de merma en 7 días/);
    // Se quita escribiendo 0, y el aviso desaparece.
    await window
      .getByRole("button", { name: "Inventario", exact: true })
      .click();
    await window
      .locator('[data-action="setWasteGoal"][data-product="p3"]')
      .click();
    await window
      .getByRole("spinbutton", { name: "No pasar de", exact: true })
      .fill("0");
    await window.getByRole("button", { name: "Cambiar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(
      await window.evaluate(() => [
        alerts.waste.length,
        product("p3").wasteGoal ?? null,
      ]),
      [0, null],
    );
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v08-movimientos.png"),
    });
    await window.locator('.icon-button[aria-label="Ver mensajes"]').click();
    await window
      .getByRole("button", { name: "Simular mensaje", exact: true })
      .click();
    await window
      .getByRole("textbox", { name: "Mensaje del proveedor", exact: true })
      .fill("Oferta exclusiva de café de prueba de Origen Coffee");
    await window
      .locator(".detection-status")
      .filter({ hasText: "Proveedor propuesto: Origen Coffee" })
      .waitFor();
    await window
      .getByRole("button", { name: "Recibir mensaje de prueba", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window
      .getByRole("searchbox", { name: "Buscar mensajes", exact: true })
      .fill("exclusiva de cafe");
    assert.equal(await window.locator(".conversation").count(), 1);
    await window
      .locator(".reply-reading strong")
      .filter({ hasText: "Información general" })
      .first()
      .waitFor();
    await window.locator(".more-actions summary").click();
    await window
      .getByRole("button", { name: "Corregir relevancia", exact: true })
      .click();
    await window
      .getByRole("combobox", { name: "Relevancia", exact: true })
      .selectOption("irrelevant");
    await window
      .getByRole("textbox", { name: "Motivo de la clasificación", exact: true })
      .fill("Fuera de nuestra carta");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window
      .locator(".reply-reading strong")
      .filter({ hasText: "No relevante" })
      .first()
      .waitFor();
    await window
      .getByRole("combobox", { name: "Mostrar", exact: true })
      .selectOption("relevant");
    assert.equal(await window.locator(".conversation").count(), 0);
    await window
      .getByText("No hay mensajes que coincidan con estos filtros.", {
        exact: true,
      })
      .waitFor();
    await window
      .getByRole("combobox", { name: "Mostrar", exact: true })
      .selectOption("all");
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v08-mensajes.png"),
    });
    await window.getByRole("button", { name: "WhatsApp", exact: true }).click();
    await window
      .getByRole("heading", { name: "Desconectado", exact: true })
      .waitFor();
    await window
      .getByRole("heading", {
        name: "Historial de sesiones y cambios de número",
        exact: true,
      })
      .waitFor();
    await window.screenshot({
      path: path.join(root, "output", "playwright", "v08-whatsapp.png"),
      fullPage: true,
    });
    if (process.env.GELATO_TEST_QR === "1") {
      await window
        .getByRole("button", { name: "Conectar por QR", exact: true })
        .click();
      await window
        .getByRole("img", { name: "QR para vincular WhatsApp", exact: true })
        .waitFor({ timeout: 60000 });
      console.log(
        "PASS: QR real obtenido en ejecutable empaquetado, sin vincular cuenta ni enviar mensajes.",
      );
    }

    await window.getByRole("button", { name: "Compras", exact: true }).click();
    await window
      .getByRole("button", { name: "Añadir producto", exact: true })
      .click();
    await window.locator("#modal-form select[name=product]").selectOption("p2");
    // Botones − / +: 1 → 3 → 2 dentro del diálogo, y +1 −1 en la línea del carrito.
    await window.locator("#modal-form .step[data-step='1']").click();
    await window.locator("#modal-form .step[data-step='1']").click();
    await window.locator("#modal-form .step[data-step='-1']").click();
    assert.equal(
      await window.locator("#modal-form input[name=packs]").inputValue(),
      "2",
    );
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window.locator(".cart-line .step[data-step='1']").first().click();
    await window.waitForFunction(
      () => document.querySelector("input[data-cart='p2']")?.value === "3",
    );
    await window.locator(".cart-line .step[data-step='-1']").first().click();
    await window.waitForFunction(
      () => document.querySelector("input[data-cart='p2']")?.value === "2",
    );
    await window.getByRole("button", { name: /Revisar y autorizar/ }).click();
    await window
      .getByRole("button", { name: "Autorizar pedidos", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    let card = window.locator(".delivery-card").first();
    await card
      .getByRole("button", { name: "Simular envío", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Registrar lo que llegó", exact: true })
      .click();
    await window.locator("#modal-form input[name=p2]").fill("4");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.ok((await card.innerText()).includes("Recepción parcial"));
    const cells = await card
      .locator("tbody tr")
      .first()
      .locator("td")
      .allTextContents();
    assert.equal(cells[1], "12 L");
    assert.equal(cells[2], "4 L");
    assert.equal(cells[3], "8 L");
    await window.locator(".orders-panel").screenshot({
      path: path.join(root, "output/playwright/v08-entregas.png"),
    });
    await card
      .getByRole("button", { name: "Registrar lo que llegó", exact: true })
      .click();
    await window.locator("#modal-form input[name=p2]").fill("8");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await window.locator(".delivery-card").count(), 0);
    await window.getByRole("button", { name: /Cerrados ·/ }).click();
    await window
      .locator(".delivery-card")
      .getByText("Recibido", { exact: true })
      .first()
      .waitFor();
    console.log(
      "PASS: pedido 2 cajas de 6 L; recepción 4 L, pendiente 8 L; recepción final cierra el pedido.",
    );
    // Otro proveedor para el mismo producto: se apunta en Inventario y se elige en el carrito.
    await window
      .getByRole("button", { name: "Inventario", exact: true })
      .click();
    await window
      .locator('[data-action="altSuppliers"][data-product="p3"]')
      .click();
    await window
      .locator("#modal-form select[name=supplier]")
      .selectOption("s1");
    await window.locator("#modal-form input[name=pack]").fill("2");
    await window.locator("#modal-form input[name=price]").fill("30");
    await window.getByRole("button", { name: "Apuntar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window.getByRole("button", { name: "Compras", exact: true }).click();
    await window
      .getByRole("button", { name: "Añadir producto", exact: true })
      .click();
    await window.locator("#modal-form select[name=product]").selectOption("p3");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window.locator('select[data-cart-supplier="p3"]').selectOption("s1");
    await window.waitForFunction(() =>
      state.cart.some((l) => l.product === "p3" && l.supplier === "s1"),
    );
    await window.getByRole("button", { name: /Revisar y autorizar/ }).click();
    await window
      .getByRole("button", { name: "Autorizar pedidos", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    const alt = await window.evaluate(() => {
      const o = state.orders.find(
        (x) =>
          x.status === "pending" && x.lines.some((l) => l.product === "p3"),
      );
      return {
        supplier: o.supplier,
        line: o.lines.find((l) => l.product === "p3"),
        ficha: product("p3").supplier,
        id: o.id,
      };
    });
    assert.equal(alt.supplier, "s1");
    assert.equal(alt.line.pack, 2);
    assert.equal(alt.line.price, 3000);
    assert.equal(alt.ficha, "s3");
    await window.evaluate(
      (id) => mutate({ type: "cancel", order: id }),
      alt.id,
    );
    console.log(
      "PASS: otro proveedor apuntado para el pistacho; el carrito se lo pide a Origen Coffee con su formato (2 kg) y su precio (30 €), y la ficha sigue en Gelato Italia.",
    );
    // Textos que envía la app: recordatorio y respuestas rápidas, editables en Configuración.
    await window
      .getByRole("button", { name: "Configuración", exact: true })
      .click();
    await window
      .getByRole("heading", { name: "Plantilla del recordatorio", exact: true })
      .waitFor();
    await window
      .getByRole("button", { name: "Editar respuestas", exact: true })
      .click();
    await window
      .locator("#modal-form textarea[name=llamo]")
      .fill("Te llamo ahora mismo, Artello.");
    await window.getByRole("button", { name: "Guardar", exact: true }).click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window
      .getByRole("button", { name: "Editar respuestas", exact: true })
      .click();
    assert.equal(
      await window.locator("#modal-form textarea[name=llamo]").inputValue(),
      "Te llamo ahora mismo, Artello.",
    );
    await window
      .getByRole("button", { name: "Cancelar", exact: true })
      .first()
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    const saved = await window.evaluate(() => replyTemplates.llamo);
    assert.equal(saved, "Te llamo ahora mismo, Artello.");
    console.log(
      "PASS: respuesta rápida escrita por la persona guardada y recuperada en Configuración.",
    );
    await window
      .getByRole("button", { name: "Producción", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Registrar producción", exact: true })
      .click();
    await window.locator('#modal-form [name="quantity"]').fill("4");
    await window
      .getByRole("button", { name: "Calcular consumo", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window.locator(".production-card").waitFor();
    const milkBefore = savedStock("p2"),
      chocolateBefore = savedStock("p4");
    assert.ok(
      (await window.locator(".production-card").innerText()).includes(
        "Leche entera",
      ),
    );
    assert.equal(savedStock("p2"), milkBefore);
    await window.locator('[data-prod-line="p2"]').fill("1.5");
    await window
      .getByRole("button", { name: "Aprobar y descontar", exact: true })
      .click();
    await window.locator(".production-card").waitFor({ state: "detached" });
    assert.equal(
      savedStock("p2"),
      Math.round((milkBefore - 1.5) * 1000) / 1000,
    );
    assert.equal(savedStock("p4"), chocolateBefore + 4);
    assert.ok(
      (await window.locator("main").innerText()).includes(
        "Gelato de chocolate",
      ),
    );
    await window.screenshot({
      path: path.join(root, "output/playwright/v09-produccion.png"),
    });
    console.log(
      "PASS: producción de 4 kg: consumo estimado (2 L leche) corregido a 1,5 L y aprobado; terminado +4 kg; nada cambió antes de aprobar.",
    );
    const chocolateAfter = savedStock("p4");
    // Cierre pesando lo que queda: la app calcula lo vendido; la merma lleva motivo.
    const waitStock = async (value) => {
      for (let i = 0; i < 50 && savedStock("p4") !== value; i++)
        await new Promise((r) => setTimeout(r, 200));
      assert.equal(savedStock("p4"), value);
    };
    const saleRow = window.locator('[data-sale-row="p4"]');
    await window
      .getByRole("button", { name: "Peso lo que queda", exact: true })
      .click();
    await saleRow.locator("[data-sale-waste]").fill("0.5");
    await saleRow.locator("[data-sale-reason]").selectOption("texture");
    await saleRow
      .locator("[data-sale-input]")
      .fill(String(chocolateAfter - 1.5));
    assert.equal(
      await saleRow.locator("[data-sale-computed]").innerText(),
      "Vendido: 1 kg",
    );
    await window
      .getByRole("button", { name: "Registrar cierre", exact: true })
      .click();
    await waitStock(chocolateAfter - 1.5);
    await window
      .getByRole("cell", { name: "Textura o cristalización", exact: true })
      .waitFor();
    // Deshacer el cierre devuelve el stock; luego se cierra apuntando lo vendido.
    await window
      .getByRole("button", { name: "Deshacer", exact: true })
      .first()
      .click();
    await window
      .getByRole("button", { name: "Deshacer cierre", exact: true })
      .click();
    await waitStock(chocolateAfter);
    await window
      .getByRole("button", { name: "Apunto lo vendido", exact: true })
      .click();
    // 0,9 kg vendidos, 0,5 kg de merma y 0,1 kg de invitación: salen 1,5 kg, pero solo 0,5 son merma.
    await saleRow.locator("[data-sale-input]").fill("0.9");
    await saleRow.locator("[data-sale-waste]").fill("0.5");
    await saleRow.locator("[data-sale-gift]").fill("0.1");
    await window
      .getByRole("button", { name: "Registrar cierre", exact: true })
      .click();
    await waitStock(chocolateAfter - 1.5);
    // Corregir una línea suelta en gramos (la balanza marcaba 400 g, no 500 g) y volver a dejarla.
    await window.locator("#sales-unit").selectOption("g");
    await window.locator('[data-action="editCloseLine"]').last().waitFor();
    const fixWaste = async (grams, expected) => {
      await window
        .locator(
          'tr.close-line:has-text("merma") [data-action="editCloseLine"]',
        )
        .first()
        .click();
      await window.locator('#modal input[name="quantity"]').fill(String(grams));
      await window.locator('#modal button[type="submit"]').click();
      await waitStock(expected);
    };
    await fixWaste(400, Math.round((chocolateAfter - 1.4) * 1000) / 1000);
    await fixWaste(500, chocolateAfter - 1.5);
    await window.locator("#sales-unit").selectOption("kg");
    console.log(
      "PASS: una merma se corrige en gramos (500 g a 400 g y vuelta) y el stock se recalcula solo.",
    );
    console.log(
      "PASS: cierre del día pesando lo que queda (vendido calculado 1 kg, merma 0,5 kg con motivo), deshecho y repetido apuntando lo vendido, con 0,1 kg de invitación aparte de la merma.",
    );
    // Recetario: escalar la receta de ejemplo a 6 kg solo en pantalla (nada cambia en el estado).
    await window
      .getByRole("button", { name: "Recetario", exact: true })
      .click();
    await window.locator("[data-scale]").first().fill("6");
    await window.waitForFunction(
      () =>
        document.querySelector("[data-scaled]")?.textContent.trim() === "3 L",
    );
    assert.equal(
      await window.locator("[data-scale-label]").first().innerText(),
      "6",
    );
    assert.equal(savedStock("p4"), chocolateAfter - 1.5);
    console.log(
      "PASS: recetario con ficha completa; escala a 6 kg muestra 3 L de leche sin tocar el stock.",
    );
    // Valor y coste: el coste sale calculado con su fórmula; el valor de venta se escribe a mano
    // y el informe de venta valora el cierre de hoy (0,9 kg vendidos y 0,5 kg de merma).
    assert.match(
      await window.locator('[data-value="cost"]').first().innerText(),
      /calculado con los precios de compra[\s\S]*Calculado: .*÷ 1 kg/,
    );
    await window.locator('[data-action="setSaleValue"]').first().click();
    // «Vale desde» viene con hoy y admite un año hacia atrás y otro hacia delante.
    const desde = window.locator('#modal input[name="from"]');
    const hoyValor = await desde.inputValue();
    assert.match(hoyValor, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok((await desde.getAttribute("min")) < hoyValor);
    assert.ok((await desde.getAttribute("max")) > hoyValor);
    await window.locator('#modal input[name="euros"]').fill("100");
    await window.locator('#modal button[type="submit"]').click();
    await window
      .locator('[data-value="sale"]', { hasText: "100,00 € por kilo" })
      .first()
      .waitFor();
    // Y se puede fechar hacia atrás: el valor de ayer no toca el de hoy.
    const ayer = new Date(Date.now() - 86400000);
    const ayerValor = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`;
    await window.locator('[data-action="setSaleValue"]').first().click();
    await window.locator('#modal input[name="euros"]').fill("80");
    await window.locator('#modal input[name="from"]').fill(ayerValor);
    await window.locator('#modal button[type="submit"]').click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(
      await window.evaluate(
        (dias) => {
          const r = state.recipes.find((x) => (x.saleValues || []).length);
          return (r.saleValues || []).map((v) => [
            v.from === dias[0] ? "hoy" : v.from === dias[1] ? "ayer" : v.from,
            v.cents,
          ]);
        },
        [hoyValor, ayerValor],
      ),
      [
        ["ayer", 8000],
        ["hoy", 10000],
      ],
    );
    await window
      .getByRole("button", { name: "Producción", exact: true })
      .click();
    const saleReport = window.locator(
      '[data-value-report="sale"] .report-kpis',
    );
    await saleReport.waitFor();
    assert.match(
      (await saleReport.innerText()).replace(/\s+/g, " "),
      /90,00 € venta estimada 50,00 € venta perdida por merma 10,00 € valor invitado/,
    );
    assert.doesNotMatch(
      await window
        .locator('[data-value-report="cost"] .report-kpis')
        .innerText(),
      /No disponible/,
    );
    assert.equal(savedStock("p4"), chocolateAfter - 1.5);
    console.log(
      "PASS: valor de venta de 100 €/kg escrito en la receta; coste calculado con fórmula; informe de venta 90 € estimados y 50 € perdidos por merma, separado del de coste.",
    );
    // Cuánto debí vender: el resumen del día cuadra, se confirma con venta real y queda congelado;
    // reabrirlo exige motivo y devuelve las herramientas de corrección.
    const dayPanel = window.locator("[data-day]");
    assert.match(
      (await dayPanel.locator(".report-kpis").innerText()).replace(/\s+/g, " "),
      /90,00 € venta estimada \(0,9 kg\)/,
    );
    await dayPanel.locator('[data-action="confirmDay"]').click();
    await window.locator('#modal input[name="real"]').fill("95");
    await window.locator('#modal button[type="submit"]').click();
    await window.locator("[data-day]", { hasText: "Día cerrado" }).waitFor();
    assert.match(
      (await dayPanel.locator(".report-kpis").innerText()).replace(/\s+/g, " "),
      /95,00 € venta real, escrita por ti \+5,00 € diferencia/,
    );
    const dayTools =
      '[data-action="undoDailySales"], [data-action="editCloseLine"], [data-action="undoCloseLine"]';
    assert.equal(await window.locator(dayTools).count(), 0);
    await dayPanel.locator('[data-action="reopenDay"]').click();
    await window.locator('#modal input[name="reason"]').fill("Prueba");
    await window.locator('#modal button[type="submit"]').click();
    await window.locator("[data-day]", { hasText: "Reabierto" }).waitFor();
    assert.ok((await window.locator(dayTools).count()) > 0);
    assert.equal(savedStock("p4"), chocolateAfter - 1.5);
    console.log(
      "PASS: resumen del día con 90 € de venta estimada; cierre confirmado con venta real de 95 € (+5 €), día congelado sin herramientas de corrección y reabierto con motivo.",
    );
    // Qué producir hoy: objetivo − stock, por la interfaz; y los indicadores del día en el inicio.
    const planPanel = window.locator("[data-plan]");
    await planPanel.locator('[data-action="setGoal"]').first().click();
    await window
      .locator('#modal input[name="target"]')
      .fill(String(savedStock("p4") + 2));
    await window.locator('#modal button[type="submit"]').click();
    await window
      .locator("[data-plan]", { hasText: "Producir 2 kg" })
      .first()
      .waitFor();
    await planPanel.locator('[data-action="produce"]').first().click();
    assert.equal(
      await window.locator('#modal input[name="quantity"]').inputValue(),
      "2",
    );
    await window.locator('#modal [data-action="close"]').first().click();
    await window.getByRole("button", { name: "Resumen", exact: true }).click();
    assert.match(
      (await window.locator("[data-home-day]").innerText()).replace(
        /\s+/g,
        " ",
      ),
      /Producido hoy 4 kg .* Venta estimada de hoy 90,00 € .* Merma de hoy 0,5 kg/,
    );
    assert.equal(savedStock("p4"), chocolateAfter - 1.5);
    console.log(
      "PASS: «Qué producir hoy» propone objetivo − stock (2 kg) y abre la producción con esos kilos; el inicio muestra producido, venta estimada y merma del día.",
    );
    // Cruceros: sin red la pantalla abre, dice que faltan datos (no inventa nada) y cita la fuente.
    await window.getByRole("button", { name: "Cruceros", exact: true }).click();
    await window.getByRole("heading", { name: /^Hoy · / }).waitFor();
    assert.equal(await window.locator(".cruise-day").count(), 7);
    assert.match(
      await window.locator(".cruise-sync").innerText(),
      /Información pendiente de sincronización/,
    );
    assert.match(
      await window.locator("#cruise-detail .empty").innerText(),
      /pendiente de sincronización/,
    );
    await window.locator('[data-tab="calendar"]').click();
    await window.locator(".cal-grid .cal-cell").first().waitFor();
    assert.match(
      await window.locator(".cruise-notes").innerText(),
      /Autoridad Portuaria de Baleares/,
    );
    console.log(
      "PASS: cruceros abre sin internet: 7 días, calendario, datos pendientes sin inventar y fuente citada.",
    );
    await window.locator('.icon-button[aria-label="Ver mensajes"]').click();
    await window
      .getByRole("button", { name: "Simular mensaje", exact: true })
      .click();
    await window
      .getByRole("textbox", { name: "Mensaje del proveedor", exact: true })
      .fill("No tenemos nata hasta el lunes, ¿te vale así?");
    await window
      .locator("#modal-form select[name=supplier]")
      .selectOption("s2");
    await window
      .getByRole("button", { name: "Recibir mensaje de prueba", exact: true })
      .click();
    await window.getByRole("dialog").waitFor({ state: "hidden" });
    await window
      .getByRole("searchbox", { name: "Buscar mensajes", exact: true })
      .fill("");
    await window.locator("#message-filter").selectOption("toread");
    await window.locator(".reply-reading").first().waitFor();
    const reading = await window.locator(".reply-reading").first().innerText();
    assert.ok(reading.includes("Falta de producto"), reading);
    assert.ok(reading.includes("Debes leer"), reading);
    assert.ok(reading.includes("Entrega indicada"), reading);
    console.log(
      "PASS: respuesta de proveedor leída por reglas: falta de producto, fecha resuelta y marcada para leer.",
    );
    // «Abrir» desde «Qué hacer ahora» con un filtro que ocultaría el mensaje: se restablece.
    await window.locator("#message-filter").selectOption("all");
    await window.locator("#message-supplier").selectOption("s1");
    await window.locator(".todo-row").first().click();
    await window.waitForFunction(
      () =>
        document.querySelector("#message-supplier")?.value === "all" &&
        document
          .querySelector(".message-detail .message-bubble")
          ?.textContent.includes("No tenemos nata"),
    );
    console.log(
      "PASS: «Abrir» en Qué hacer ahora muestra el mensaje aunque el filtro de proveedor lo ocultara.",
    );
    // Let the open handler finish (it awaits a read mutation) before leaving the screen.
    await window.waitForTimeout(500);
    await window.getByRole("button", { name: "IA local", exact: true }).click();
    const text =
      "FACTURA F-123\nOrigen Coffee\nBase imponible: 100,00 EUR\nIVA: 21,00 EUR\nTotal: 125,00 EUR";
    await window.locator("#ai-text").fill(text);
    await window
      .getByRole("button", { name: "Analizar con IA local", exact: true })
      .click();
    try {
      await window.locator(".ai-result").waitFor({ timeout: 245000 });
    } catch (e) {
      await window.screenshot({
        path: path.join(root, "output/playwright/fail-ai.png"),
      });
      console.log(
        "ESTADO IA AL FALLAR: " +
          JSON.stringify(
            (await window.locator("main").innerText()).slice(0, 700),
          ),
      );
      console.log(
        "RENDERS RECIENTES:\n" +
          (await window.evaluate(() =>
            (window.__navLog || []).slice(-15).join("\n"),
          )),
      );
      throw e;
    }
    assert.ok(
      (await window.locator(".ai-result").innerText()).includes(
        "Posible factura",
      ),
    );
    assert.ok(
      (await window.locator(".ai-result").innerText()).includes(
        "Dos lecturas del modelo coinciden",
      ),
    );
    assert.ok(
      (await window.locator(".ai-result").innerText()).includes(
        "no coincide con el total",
      ),
    );
    assert.equal(savedStock(), 4.25);
    await window.screenshot({
      path: path.join(root, "output/playwright/v08-ia.png"),
    });
    console.log(
      "PASS: modelo local REAL en ejecutable, factura reconocida sin modificar stock.",
    );
    await window
      .locator("#ai-text")
      .fill(
        "LISTA DE PRECIOS. Tarifa de septiembre. Café 20 EUR/kg. Leche 1 EUR/L. Precios orientativos. No es una factura.",
      );
    assert.equal(await window.locator(".ai-result").count(), 0);
    await window.locator("#ai-mode").selectOption("standard");
    await window
      .getByRole("button", { name: "Analizar con IA local", exact: true })
      .click();
    await window.locator(".ai-result").waitFor({ timeout: 245000 });
    assert.ok(
      (await window.locator(".ai-result").innerText()).includes(
        "Posible lista de precios",
      ),
    );
    console.log("PASS: modelo local diferencia lista de precios de factura.");
    await window
      .locator("#ai-chat-input")
      .fill("¿Qué hace la pantalla Control de entregas?");
    await window
      .getByRole("button", { name: "Preguntar a la IA local", exact: true })
      .click();
    await window.locator(".ai-chat-answer").waitFor({ timeout: 245000 });
    const answer = (await window.locator(".ai-chat-answer").innerText()).trim();
    assert.ok(answer.length > 20, "respuesta del chat vacía");
    assert.ok(!/<[a-z]+>/i.test(answer), "el chat mostró marcado");
    assert.equal(savedStock(), 4.25);
    await window.screenshot({
      path: path.join(root, "output/playwright/v082-ia-chat.png"),
    });
    console.log(
      "PASS: chat de dudas (guía o modelo local) responde texto plano sin modificar stock: " +
        JSON.stringify(answer.slice(0, 160)),
    );
    await window.locator('.icon-button[aria-label="Ver mensajes"]').click();
    await window
      .getByRole("searchbox", { name: "Buscar mensajes", exact: true })
      .fill("");
    await window.locator("#message-filter").selectOption("toread");
    await window.locator(".reply-reading").first().waitFor();
    await window.locator(".more-actions summary").click();
    await window
      .getByRole("button", {
        name: "Segunda lectura con IA local",
        exact: true,
      })
      .click();
    await window
      .locator(".reply-reading")
      .filter({ hasText: "IA local" })
      .first()
      .waitFor({ timeout: 245000 });
    const second = await window.locator(".reply-reading").first().innerText();
    assert.equal(savedStock(), 4.25);
    console.log(
      "PASS: segunda lectura de respuesta de proveedor con modelo REAL anotada sin cambiar stock: " +
        JSON.stringify(second.split(/IA local/i)[1]?.slice(0, 120)),
    );
    await window.getByRole("button", { name: "IA local", exact: true }).click();
    await window
      .getByRole("button", { name: "Analizar con IA local", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Detener lectura", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Analizar con IA local", exact: true })
      .waitFor();
    await window.getByRole("alert").filter({ hasText: "cancelada" }).waitFor();
    console.log("PASS: cancelación desde la interfaz.");
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
    await w2.locator('.icon-button[aria-label="Ver mensajes"]').click();
    await w2
      .getByRole("searchbox", { name: "Buscar mensajes", exact: true })
      .fill("exclusiva de cafe");
    await w2
      .locator(".reply-reading strong")
      .filter({ hasText: "No relevante" })
      .first()
      .waitFor();
    assert.equal(await w2.locator(".conversation").count(), 1);
    // Fase 5: qué le compra a un proveedor, con el origen de cada precio, dentro del ejecutable.
    await w2.locator('button[data-nav="suppliers"]').click();
    await w2
      .locator('[data-action="supplierCatalog"][data-supplier="s2"]')
      .first()
      .click();
    const catalogo = (await w2.locator("#modal").innerText()).replace(
      /\s+/g,
      " ",
    );
    assert.match(catalogo, /Leche entera/);
    // Sin ningún cambio registrado, la fecha y el origen del precio son «No disponible».
    assert.match(catalogo, /No disponible/);
    await w2.locator('#modal [data-action="close"]').first().click();
    // Aviso de mensaje nuevo dentro del ejecutable: el mensaje entra por la vía del servidor
    // (como al importarlo de WhatsApp) y la ventana abierta se entera sola, sin redibujarse.
    await w2.locator('button[data-nav="stock"]').click();
    assert.equal(
      await w2.evaluate(async () => {
        const r = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "message",
            supplier: "s2",
            text: "No nos queda nata hasta el jueves.",
            channel: "whatsapp",
            revision: state.revision,
            operationId: crypto.randomUUID(),
          }),
        });
        return r.status;
      }),
      200,
    );
    await w2.locator("#incoming").waitFor({ state: "visible", timeout: 15000 });
    const aviso = (await w2.locator("#incoming").innerText()).replace(
      /\s+/g,
      " ",
    );
    assert.match(aviso, /Mensaje nuevo de Fresco Mercado/);
    assert.match(aviso, /Falta de producto/);
    assert.equal(await w2.evaluate(() => page), "stock");
    await w2.locator('#incoming [data-action="incomingOpen"]').click();
    await w2.locator(".message-detail").first().waitFor();
    assert.equal(await w2.evaluate(() => page), "messages");
    assert.equal(await w2.locator("#incoming").isVisible(), false);
    console.log(
      "PASS: OCR local automático de proveedor y propuesta en mensaje; búsqueda sin tildes, filtros y corrección de relevancia persistente; ejecutable Windows, recarga con recursos externos bloqueados, conteo persistente, foto manual, salida y corrección trazable, reinicio y perfiles en D.",
    );
    console.log(JSON.stringify(runtime));
  } finally {
    if (app) await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
