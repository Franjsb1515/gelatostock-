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
    const login = await fetch(app.url);
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
    const nextLogin = await fetch(app.url);
    headers.Cookie = nextLogin.headers.get("set-cookie").split(";")[0];
    headers.Origin = origin;
    assert.equal((await get()).products[0].stock, 7);
  } finally {
    if (app) await new Promise((r) => app.server.close(r));
    assert.ok(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
