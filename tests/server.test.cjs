const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../src/server.cjs");
test("servidor SQLite: autenticación, revisión, persistencia y restauración", async () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "http-v2-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    let origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get("location"), "/");
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    };
    const get = async () =>
      (await (await fetch(origin + "/api/state", { headers })).json()).state;
    const command = async (a) =>
      fetch(origin + "/api/action", {
        method: "POST",
        headers,
        body: JSON.stringify({
          revision: (await get()).revision,
          operationId: randomUUID(),
          ...a,
        }),
      });
    assert.equal((await fetch(origin + "/api/state")).status, 403);
    assert.equal(
      (
        await fetch(origin + "/api/action", {
          method: "POST",
          headers: { ...headers, Origin: "https://example.com" },
          body: "{}",
        })
      ).status,
      403,
    );
    const beforeAI = await get();
    for (const [headersAI, body, status] of [
      [
        { "Content-Type": "application/json", Origin: origin },
        { text: "factura" },
        403,
      ],
      [{ ...headers, Origin: "https://example.com" }, { text: "factura" }, 403],
      [headers, { text: "factura", path: "../data/whatsapp/sessions" }, 400],
      [headers, { text: "a".repeat(21000) }, 400],
    ]) {
      const r = await fetch(origin + "/api/ai", {
        method: "POST",
        headers: headersAI,
        body: JSON.stringify(body),
      });
      assert.equal(r.status, status);
    }
    assert.deepEqual(await get(), beforeAI);
    // The API now requires optimistic revision + stable operation ID to prevent lost writes.
    assert.equal(
      (
        await fetch(origin + "/api/action", {
          method: "POST",
          headers,
          body: JSON.stringify({ type: "count", product: "p1", value: 7 }),
        })
      ).status,
      400,
    );
    assert.equal(
      (await command({ type: "count", product: "p1", value: 7 })).status,
      200,
    );
    const r = await fetch(origin + "/api/backup", {
      method: "POST",
      headers,
      body: "{}",
    });
    const backup = JSON.parse(fs.readFileSync((await r.json()).path, "utf8"));
    assert.equal(backup.products[0].stock, 7);
    const restore = async (data) =>
      fetch(origin + "/api/restore", {
        method: "POST",
        headers,
        body: JSON.stringify({
          revision: (await get()).revision,
          backup: data,
        }),
      });
    assert.equal((await restore({ ...backup, version: 99 })).status, 400);
    assert.equal((await get()).products[0].stock, 7);
    await command({ type: "count", product: "p1", value: 9 });
    assert.equal((await restore(backup)).status, 200);
    assert.equal((await get()).products[0].stock, 7);
    assert.ok(fs.existsSync(path.join(dir, "gelatostock.sqlite")));
    assert.ok(!fs.existsSync(path.join(dir, "stock.json")));
    await new Promise((r) => app.server.close(r));
    app = await createApp({ dataDir: dir });
    origin = new URL(app.url).origin;
    const nextLogin = await fetch(app.url, { redirect: "manual" });
    headers.Cookie = nextLogin.headers.get("set-cookie").split(";")[0];
    headers.Origin = origin;
    assert.equal((await get()).products[0].stock, 7);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    assert.ok(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("envío real por WhatsApp desde el servidor: vista previa exacta, un envío y estado enviado", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-wa-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    const state = async () =>
      (await (await fetch(origin + "/api/state", { headers })).json()).state;
    let s = await state();
    await post("/api/action", {
      type: "supplier",
      id: "s2",
      name: "Fresco Mercado",
      initials: "FM",
      category: "Lácteos",
      delivery: "L-V",
      color: "rose",
      whatsapp: "+34910000001",
      revision: s.revision,
      operationId: "w1",
    });
    s = await state();
    await post("/api/action", {
      type: "cart",
      product: "p2",
      packs: 2,
      revision: s.revision,
      operationId: "w2",
    });
    s = await state();
    await post("/api/action", {
      type: "authorize",
      revision: s.revision,
      operationId: "w3",
    });
    s = await state();
    const order = s.orders[0];
    let r = await post("/api/whatsapp", { type: "preview", order: order.id });
    const preview = await r.json();
    assert.equal(r.status, 200);
    assert.equal(preview.connected, false);
    assert.match(preview.text, /Leche entera/);
    r = await post("/api/whatsapp", {
      type: "send",
      order: order.id,
      text: preview.text,
    });
    assert.equal(r.status, 400);
    const account = app.whatsapp.store.bind("+34600000001");
    app.whatsapp.account = account;
    app.whatsapp.status = "connected";
    const calls = [];
    app.whatsapp.client = {
      sendMessage: async (to, text) => (
        calls.push([to, text]),
        { id: { _serialized: "real-1" } }
      ),
    };
    app.whatsapp.store.permit(account, "+34910000001", "Fresco");
    r = await post("/api/whatsapp", {
      type: "send",
      order: order.id,
      text: preview.text + " extra",
    });
    assert.equal(r.status, 400);
    assert.equal(calls.length, 0);
    r = await post("/api/whatsapp", {
      type: "send",
      order: order.id,
      text: preview.text,
    });
    assert.equal(r.status, 200);
    const sent = await r.json();
    assert.equal(sent.sent.id, "real-1");
    assert.deepEqual(calls, [["34910000001@c.us", preview.text]]);
    s = await state();
    assert.equal(s.orders[0].status, "sent");
    assert.equal(s.orders[0].dispatch.messageId, "real-1");
    r = await post("/api/whatsapp", {
      type: "send",
      order: order.id,
      text: preview.text,
    });
    assert.equal(r.status, 400);
    assert.equal(calls.length, 1);
    const view = await (
      await fetch(origin + "/api/whatsapp?account=" + account, { headers })
    ).json();
    assert.equal(view.sent.length, 1);
    app.whatsapp.client = null;
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copia automática al arrancar, con retención de copias automáticas y aviso en el estado", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-bk-"));
  let app;
  try {
    const backups = path.join(dir, "backups");
    fs.mkdirSync(backups, { recursive: true });
    for (let i = 0; i < 32; i++)
      fs.writeFileSync(
        path.join(
          backups,
          `gelatostock-${1000 + i}-00000000-0000-4000-8000-00000000000${i % 10}.json`,
        ),
        "{}",
      );
    fs.writeFileSync(path.join(backups, "manual-importante.json"), "{}");
    app = await createApp({ dataDir: dir });
    for (
      let i = 0;
      i < 50 &&
      fs.readdirSync(backups).filter((f) => f.startsWith("gelatostock-"))
        .length !== 30;
      i++
    )
      await new Promise((r) => setTimeout(r, 100));
    const auto = fs
      .readdirSync(backups)
      .filter((f) => f.startsWith("gelatostock-"));
    assert.equal(auto.length, 30);
    assert.ok(fs.existsSync(path.join(backups, "manual-importante.json")));
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = { Cookie: login.headers.get("set-cookie").split(";")[0] };
    const data = await (await fetch(origin + "/api/state", { headers })).json();
    assert.ok(data.backup.last);
    assert.equal(data.backup.warning, "");
    const page = await fetch(origin + "/", { headers });
    assert.match(page.headers.get("permissions-policy") || "", /camera=\(\)/);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("la preferencia de conectar WhatsApp al abrir se guarda y se refleja en la vista", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-ac-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    let r = await fetch(origin + "/api/whatsapp", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "autoconnect", enabled: true }),
    });
    assert.equal((await r.json()).autoConnect, true);
    r = await fetch(origin + "/api/whatsapp", { headers });
    assert.equal((await r.json()).autoConnect, true);
    r = await fetch(origin + "/api/whatsapp", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "autoconnect", enabled: "yes" }),
    });
    assert.equal((await r.json()).autoConnect, false);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("exportación CSV de inventario y movimientos con BOM y punto y coma", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-csv-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const st = (await (await fetch(origin + "/api/state", { headers })).json())
      .state;
    await fetch(origin + "/api/action", {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "count",
        product: "p1",
        value: 3,
        reason: 'Conteo; con "comillas"',
        revision: st.revision,
        operationId: "csv1",
      }),
    });
    const r = await fetch(origin + "/api/export", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(r.status, 200);
    const { files } = await r.json();
    assert.equal(files.length, 2);
    const inv = fs.readFileSync(files[0], "utf8");
    assert.ok(inv.startsWith("\ufeffproducto;detalle;"));
    assert.ok(inv.includes("Café de especialidad;"));
    const mov = fs.readFileSync(files[1], "utf8");
    assert.ok(mov.includes('"Conteo; con ""comillas"""'));
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("recetario con contraseña: oculta recetas, bloquea acciones, desbloquea y limpieza configurable", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-lock-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    const state = async () =>
      await (await fetch(origin + "/api/state", { headers })).json();
    let d = await state();
    assert.equal(d.lock.enabled, false);
    assert.ok(d.state.recipes[0].ingredients.length > 0);
    let r = await post("/api/lock", { type: "set", password: "corta" });
    assert.equal(r.status, 400);
    r = await post("/api/lock", { type: "set", password: "helado-secreto" });
    assert.equal(r.status, 200);
    d = await r.json();
    assert.deepEqual(d.lock, { enabled: true, unlocked: true });
    r = await post("/api/lock", { type: "lock" });
    d = await r.json();
    assert.equal(d.lock.unlocked, false);
    assert.equal(d.state.recipes[0].ingredients.length, 0);
    assert.equal(d.state.recipes[0].locked, true);
    r = await post("/api/action", {
      type: "produce",
      recipe: "r1",
      quantity: 1,
      date: "2026-09-09",
      revision: d.state.revision,
      operationId: "lk1",
    });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /protegidas/);
    r = await post("/api/lock", { type: "unlock", password: "mala" });
    assert.equal(r.status, 400);
    r = await post("/api/lock", { type: "unlock", password: "helado-secreto" });
    assert.equal(r.status, 200);
    d = await r.json();
    assert.equal(d.lock.unlocked, true);
    assert.ok(d.state.recipes[0].ingredients.length > 0);
    r = await post("/api/action", {
      type: "produce",
      recipe: "r1",
      quantity: 1,
      date: "2026-09-09",
      revision: d.state.revision,
      operationId: "lk2",
    });
    assert.equal(r.status, 200);
    r = await post("/api/lock", { type: "remove", password: "helado-secreto" });
    assert.equal((await r.json()).lock.enabled, false);
    r = await post("/api/maintenance", { type: "retention", days: 5 });
    assert.equal(r.status, 400);
    r = await post("/api/maintenance", { type: "retention", days: 7 });
    assert.equal((await r.json()).retentionDays, 7);
    r = await post("/api/maintenance", { type: "purge" });
    d = await r.json();
    assert.equal(r.status, 200);
    assert.equal(d.purge.activity, 0);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("responder a un mensaje de WhatsApp desde la bandeja envía el texto y anota la decisión", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-reply-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    const state = async () =>
      (await (await fetch(origin + "/api/state", { headers })).json()).state;
    let s = await state();
    await post("/api/action", {
      type: "message",
      supplier: "s2",
      text: "Llega el lunes",
      channel: "whatsapp",
      sender: "+34910000001",
      revision: s.revision,
      operationId: "r1",
    });
    s = await state();
    const demo = s.messages.find((m) => m.channel !== "whatsapp");
    let r = await post("/api/whatsapp", {
      type: "reply",
      id: demo.id,
      text: "hola",
    });
    assert.equal(r.status, 400);
    const account = app.whatsapp.store.bind("+34600000001");
    app.whatsapp.account = account;
    app.whatsapp.status = "connected";
    const calls = [];
    app.whatsapp.client = {
      sendMessage: async (to, text) => (
        calls.push([to, text]),
        { id: { _serialized: "reply-1" } }
      ),
    };
    app.whatsapp.store.permit(account, "+34910000001", "Fresco");
    const target = s.messages.find((m) => m.channel === "whatsapp");
    r = await post("/api/whatsapp", {
      type: "reply",
      id: target.id,
      text: "De acuerdo, esperamos el lunes.",
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.sent.id, "reply-1");
    assert.deepEqual(calls, [
      ["34910000001@c.us", "De acuerdo, esperamos el lunes."],
    ]);
    const after = data.state.messages.find((m) => m.id === target.id);
    assert.equal(after.reviewed, true);
    assert.match(after.decision, /Respondido por WhatsApp/);
    app.whatsapp.client = null;
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CSV: las celdas que empezarían una fórmula llevan apóstrofo; los números no cambian", () => {
  const { csvCell } = require("../src/csv.cjs");
  assert.equal(csvCell("=SUMA(A1:A9)"), "'=SUMA(A1:A9)");
  assert.equal(csvCell("+34 600"), "'+34 600");
  assert.equal(csvCell("-oferta"), "'-oferta");
  assert.equal(csvCell("@nombre"), "'@nombre");
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell("Leche; entera"), '"Leche; entera"');
  assert.equal(csvCell('Dice "hola"'), '"Dice ""hola"""');
  assert.equal(csvCell(null), "");
});
test("registros locales: pasado 1 MB el archivo rota a .anterior y sigue escribiendo", () => {
  const { appendLog } = require("../src/logs.cjs");
  const dir = fs.mkdtempSync(
    path.join(path.resolve(__dirname, "../work"), "logs-"),
  );
  try {
    const file = path.join(dir, "prueba.log");
    appendLog(file, "primera", 50);
    fs.appendFileSync(file, "x".repeat(60));
    appendLog(file, "segunda", 50);
    assert.ok(fs.existsSync(file + ".anterior"));
    assert.match(fs.readFileSync(file, "utf8"), /segunda\n$/);
    assert.match(fs.readFileSync(file + ".anterior", "utf8"), /primera/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copia secundaria: se valida la carpeta, se copia cada copia y se avisa en el estado", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-sec-"));
  const second = fs.mkdtempSync(path.join(root, "http-sec2-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    let r = await post("/api/maintenance", {
      type: "backupDir",
      dir: "relativa",
    });
    assert.equal(r.status, 400);
    r = await post("/api/maintenance", {
      type: "backupDir",
      dir: path.join(dir, "backups", "dentro"),
    });
    assert.equal(r.status, 400);
    r = await post("/api/maintenance", { type: "backupDir", dir: second });
    assert.equal(r.status, 200);
    let data = await r.json();
    assert.equal(data.backup.secondary.dir, second);
    assert.equal(data.backup.secondary.error, "");
    assert.equal(data.backup.stale, false);
    const copies = () =>
      fs.readdirSync(second).filter((f) => f.startsWith("gelatostock-"));
    assert.equal(copies().length, 1);
    r = await post("/api/backup", {});
    data = await r.json();
    assert.ok(data.secondary.startsWith(second));
    assert.equal(copies().length, 2);
    r = await post("/api/maintenance", { type: "backupDir", dir: "" });
    data = await r.json();
    assert.equal(data.backup.secondary.dir, "");
    assert.equal(app.store.setting("backup_dir_secondary"), undefined);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});
test("historial paginado: la interfaz recibe solo lo reciente y pide lo demás a /api/history", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-hist-"));
  let app;
  try {
    app = await createApp({ dataDir: dir, historyLimit: 3 });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const get = async (p) => (await fetch(origin + p, { headers })).json();
    let env = await get("/api/state");
    for (let i = 0; i < 5; i++) {
      const r = await fetch(origin + "/api/action", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "movement",
          product: "p2",
          kind: "entry",
          value: 1,
          reason: "prueba " + i,
          revision: env.state.revision,
          operationId: randomUUID(),
        }),
      });
      assert.equal(r.status, 200);
      env = await r.json();
    }
    assert.equal(env.state.movements.length, 3);
    assert.ok(env.history.movements >= 5);
    assert.equal(env.history.limit, 3);
    assert.equal(env.state.activity.length, 3);
    const page = await get("/api/history?kind=movements&offset=3&limit=10");
    assert.equal(page.total, env.history.movements);
    assert.equal(page.items.length, env.history.movements - 3);
    assert.equal(page.items[0].id, app.store.load().movements[3].id);
    const bad = await fetch(origin + "/api/history?kind=photos", { headers });
    assert.equal(bad.status, 400);
    // The full state on disk is untouched by the trimming.
    assert.ok(app.store.load().movements.length >= 5);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("envío por lotes: lista completa, selección, envío uno a uno con pausa y progreso consultable", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-batch-"));
  let app;
  try {
    app = await createApp({ dataDir: dir, batchDelayMs: 20 });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    const state = async () =>
      (await (await fetch(origin + "/api/state", { headers })).json()).state;
    let s = await state();
    const supplier = (id, name, phone, extra = {}) =>
      post("/api/action", {
        type: "supplier",
        id,
        name,
        initials: name.slice(0, 2).toUpperCase(),
        category: "x",
        delivery: "x",
        color: "sage",
        whatsapp: phone,
        revision: s.revision,
        operationId: randomUUID(),
        ...extra,
      });
    await supplier("s1", "Origen Coffee", "+34910000002");
    s = await state();
    await supplier("s2", "Fresco Mercado", "+34910000001");
    s = await state();
    await post("/api/action", {
      type: "cart",
      product: "p1",
      packs: 1,
      revision: s.revision,
      operationId: randomUUID(),
    });
    s = await state();
    await post("/api/action", {
      type: "cart",
      product: "p2",
      packs: 2,
      revision: s.revision,
      operationId: randomUUID(),
    });
    s = await state();
    await post("/api/action", {
      type: "authorize",
      revision: s.revision,
      operationId: randomUUID(),
    });
    s = await state();
    const pending = s.orders.filter((o) => o.status === "pending");
    assert.equal(pending.length, 2);
    let r = await post("/api/whatsapp", { type: "batchPreview" });
    let preview = await r.json();
    assert.equal(preview.connected, false);
    assert.equal(preview.items.length, 2);
    assert.ok(
      preview.items.every((i) => !i.sendable && /conectado/.test(i.reason)),
    );
    const account = app.whatsapp.store.bind("+34600000001");
    app.whatsapp.account = account;
    app.whatsapp.status = "connected";
    const calls = [];
    app.whatsapp.client = {
      sendMessage: async (to, text) => (
        calls.push([to, text, Date.now()]),
        { id: { _serialized: "b-" + calls.length } }
      ),
    };
    app.whatsapp.store.permit(account, "+34910000001", "Fresco");
    preview = await (
      await post("/api/whatsapp", { type: "batchPreview" })
    ).json();
    const fresco = preview.items.find((i) => i.supplier === "Fresco Mercado");
    const origen = preview.items.find((i) => i.supplier === "Origen Coffee");
    assert.equal(fresco.sendable, true);
    assert.equal(origen.sendable, false);
    assert.match(origen.reason, /autorizado/);
    app.whatsapp.store.permit(account, "+34910000002", "Origen");
    preview = await (
      await post("/api/whatsapp", { type: "batchPreview" })
    ).json();
    assert.ok(preview.items.every((i) => i.sendable));
    r = await post("/api/whatsapp", {
      type: "sendBatch",
      orders: [
        { order: fresco.order, text: fresco.text },
        { order: origen.order, text: origen.text + " cambiado" },
      ],
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { started: true, total: 2 });
    let view;
    for (let i = 0; i < 100; i++) {
      view = await (await fetch(origin + "/api/whatsapp", { headers })).json();
      if (!view.batch.running) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    assert.equal(view.batch.running, false);
    assert.equal(view.batch.done, 2);
    assert.equal(view.batch.results[0].ok, true);
    assert.equal(view.batch.results[1].ok, false);
    assert.match(view.batch.results[1].error, /texto cambió/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "34910000001@c.us");
    s = await state();
    assert.equal(s.orders.find((o) => o.id === fresco.order).status, "sent");
    assert.equal(s.orders.find((o) => o.id === origen.order).status, "pending");
    // Second batch: the sent order is no longer offered; the other one goes out now.
    preview = await (
      await post("/api/whatsapp", { type: "batchPreview" })
    ).json();
    assert.equal(preview.items.length, 1);
    assert.equal(preview.items[0].order, origen.order);
    r = await post("/api/whatsapp", {
      type: "sendBatch",
      orders: [{ order: origen.order, text: origen.text }],
    });
    assert.equal(r.status, 200);
    for (let i = 0; i < 100; i++) {
      view = await (await fetch(origin + "/api/whatsapp", { headers })).json();
      if (!view.batch.running) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    assert.equal(calls.length, 2);
    assert.equal(
      (await state()).orders.filter((o) => o.status === "sent").length,
      2,
    );
    r = await post("/api/whatsapp", { type: "sendBatch", orders: [] });
    assert.equal(r.status, 400);
    app.whatsapp.client = null;
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("exportación CSV a una carpeta elegida: ruta absoluta obligatoria, archivos creados allí", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-export-"));
  const target = fs.mkdtempSync(path.join(root, "http-export-dest-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    let r = await post("/api/export", { dir: "relativa/carpeta" });
    assert.equal(r.status, 400);
    r = await post("/api/export", { dir: target });
    assert.equal(r.status, 200);
    const { files } = await r.json();
    assert.equal(files.length, 2);
    assert.ok(files.every((f) => f.startsWith(target) && fs.existsSync(f)));
    r = await post("/api/export", {});
    assert.ok(
      (await r.json()).files[0].startsWith(path.join(dir, "exportaciones")),
    );
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("plantilla del pedido: se guarda, exige {lineas} y la vista previa la usa", async () => {
  const root = path.resolve(__dirname, "../work");
  const dir = fs.mkdtempSync(path.join(root, "http-tpl-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    const login = await fetch(app.url, { redirect: "manual" });
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: login.headers.get("set-cookie").split(";")[0],
    };
    const post = (p, body) =>
      fetch(origin + p, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    const state = async () =>
      (await (await fetch(origin + "/api/state", { headers })).json()).state;
    let s = await state();
    await post("/api/action", {
      type: "supplier",
      id: "s2",
      name: "Fresco Mercado",
      initials: "FM",
      category: "x",
      delivery: "x",
      color: "sage",
      whatsapp: "+34910000001",
      revision: s.revision,
      operationId: randomUUID(),
    });
    s = await state();
    await post("/api/action", {
      type: "cart",
      product: "p2",
      packs: 1,
      revision: s.revision,
      operationId: randomUUID(),
    });
    s = await state();
    await post("/api/action", {
      type: "authorize",
      revision: s.revision,
      operationId: randomUUID(),
    });
    s = await state();
    const order = s.orders.find((o) => o.status === "pending");
    let r = await post("/api/maintenance", {
      type: "orderTemplate",
      template: "sin marcador",
    });
    assert.equal(r.status, 400);
    r = await post("/api/maintenance", {
      type: "orderTemplate",
      template: "Buenas {proveedor}, de {negocio}:\n{lineas}\nUn saludo",
    });
    assert.equal(r.status, 200);
    assert.match((await r.json()).orderTemplate, /^Buenas/);
    const preview = await (
      await post("/api/whatsapp", { type: "preview", order: order.id })
    ).json();
    assert.match(
      preview.text,
      /^Buenas Fresco Mercado, de Artello:\n- 1 × Leche entera/,
    );
    assert.match(preview.text, /Un saludo$/);
    r = await post("/api/maintenance", { type: "orderTemplate", template: "" });
    assert.match((await r.json()).orderTemplate, /^Hola, pedido/);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
