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
