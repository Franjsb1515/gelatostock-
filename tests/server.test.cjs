const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("../src/server.cjs");
test("servidor local: autorización, persistencia, respaldo, restauración y origen", async () => {
  const root = path.resolve(__dirname, "../work");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "test-"));
  let app;
  try {
    app = await createApp({ dataDir: dir });
    const origin = new URL(app.url).origin;
    let r = await fetch(app.url);
    assert.equal(r.status, 200);
    const cookie = r.headers.get("set-cookie").split(";")[0];
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    };
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
    r = await fetch(origin + "/api/action", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "count", product: "p1", value: 7 }),
    });
    assert.equal(r.status, 200);
    r = await fetch(origin + "/api/backup", {
      method: "POST",
      headers,
      body: "{}",
    });
    const backup = JSON.parse(fs.readFileSync((await r.json()).path, "utf8"));
    assert.equal(backup.products[0].stock, 7);
    r = await fetch(origin + "/api/restore", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...backup, version: 99 }),
    });
    assert.equal(r.status, 400);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(dir, "stock.json"), "utf8"))
        .products[0].stock,
      7,
    );
    await fetch(origin + "/api/action", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "count", product: "p1", value: 9 }),
    });
    r = await fetch(origin + "/api/restore", {
      method: "POST",
      headers,
      body: JSON.stringify(backup),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).state.products[0].stock, 7);
    await new Promise((resolve) => app.server.close(resolve));
    app = await createApp({ dataDir: dir });
    const login = await fetch(app.url);
    const h = { Cookie: login.headers.get("set-cookie").split(";")[0] };
    r = await fetch(new URL(app.url).origin + "/api/state", { headers: h });
    assert.equal((await r.json()).state.products[0].stock, 7);
  } finally {
    if (app) await new Promise((resolve) => app.server.close(resolve));
    assert.ok(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
