const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { WhatsAppConnection } = require("../src/whatsapp.cjs");
async function fixture(fn) {
  const root = path.resolve(__dirname, "../work"),
    dir = fs.mkdtempSync(path.join(root, "wa-test-"));
  const c = new WhatsAppConnection(dir, { load: () => ({ suppliers: [] }) });
  try {
    await fn(c, dir);
  } finally {
    await c.close();
    assert.ok(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const entry = {
  id: "same-event",
  sender: "+34910000001",
  at: "2026-09-08T00:00:00.000Z",
  text: "Factura recibida",
};
test("cambiar cuenta registra número anterior/nuevo y no mezcla conversaciones", () =>
  fixture((c) => {
    const a = c.store.bind("+34600000001");
    c.store.permit(a, entry.sender, "Proveedor");
    assert.ok(c.store.insert(a, entry));
    c.store.detach();
    const b = c.store.bind("+34600000002");
    assert.equal(c.store.view(b).messages.length, 0);
    assert.equal(c.store.view(b).allowed.length, 0);
    assert.equal(c.store.view(a).messages.length, 1);
    assert.ok(
      c.store
        .view(b)
        .history.some((h) => h.text.includes("+34600000001 → +34600000002")),
    );
  }));
test("eventos se deduplican dentro de una cuenta y no entre números propios", () =>
  fixture((c) => {
    const a = c.store.bind("+34600000001");
    c.store.permit(a, entry.sender, "P");
    assert.equal(c.store.insert(a, entry), true);
    assert.equal(c.store.insert(a, entry), false);
    const b = c.store.bind("+34600000002");
    c.store.permit(b, entry.sender, "P");
    assert.equal(c.store.insert(b, entry), true);
  }));
test("revocar contacto detiene importación y conserva lo importado", () =>
  fixture((c) => {
    const a = c.store.bind("+34600000001");
    c.store.permit(a, entry.sender, "P");
    c.store.insert(a, entry);
    c.store.revoke(a, entry.sender);
    assert.equal(c.store.insert(a, { ...entry, id: "next" }), false);
    assert.equal(c.store.view(a).messages.length, 1);
  }));
test("remitente ajeno no dispara descarga ni deja mensajes", () =>
  fixture(async (c) => {
    c.account = c.store.bind("+34600000001");
    c.status = "connected";
    let calls = 0;
    await c.receive(
      {
        from: "34910000001@c.us",
        hasMedia: true,
        downloadMedia: async () => {
          calls++;
        },
      },
      c.generation,
    );
    assert.equal(calls, 0);
    assert.equal(c.store.view(c.account).messages.length, 0);
  }));
test("evento de sesión anterior se ignora tras un cambio", () =>
  fixture(async (c) => {
    c.account = c.store.bind("+34600000001");
    c.store.permit(c.account, entry.sender, "P");
    c.status = "connected";
    const gen = c.generation;
    ++c.generation;
    await c.receive(
      {
        from: "34910000001@c.us",
        id: { _serialized: "event" },
        body: "Hola",
        timestamp: Date.now() / 1000,
      },
      gen,
    );
    assert.equal(c.store.view(c.account).messages.length, 0);
  }));
test("mensaje autorizado conserva la cuenta y el remitente", () =>
  fixture(async (c) => {
    c.account = c.store.bind("+34600000001");
    c.store.permit(c.account, entry.sender, "P");
    c.status = "connected";
    await c.receive(
      {
        from: "34910000001@c.us",
        id: { _serialized: "event" },
        body: "Hola",
        timestamp: Math.floor(Date.now() / 1000),
      },
      c.generation,
    );
    const m = c.store.view(c.account).messages[0];
    assert.equal(m.account, c.account);
    assert.equal(m.sender, entry.sender);
    assert.equal(m.text, "Hola");
  }));
test("sesión y cuentas persisten al reiniciar sin contener QR", () =>
  fixture(async (c, dir) => {
    const a = c.store.bind("+34600000001"),
      session = c.store.session();
    c.store.permit(a, entry.sender, "P");
    c.store.insert(a, entry);
    await c.close();
    const other = new WhatsAppConnection(dir, {
      load: () => ({ suppliers: [] }),
    });
    try {
      assert.equal(other.store.session(), session);
      assert.equal(other.store.view(a).messages.length, 1);
      assert.equal(other.qr, null);
    } finally {
      await other.close();
    }
  }));

test("respaldo conserva conversaciones sin copiar credenciales", () =>
  fixture((c) => {
    const a = c.store.bind("+34600000001");
    c.store.permit(a, entry.sender, "P");
    c.store.insert(a, entry);
    const sessions = path.join(c.store.dir, "sessions");
    fs.mkdirSync(sessions);
    fs.writeFileSync(path.join(sessions, "private-session"), "test-secret");
    const dest = c.store.backup();
    assert.ok(fs.existsSync(path.join(dest, "whatsapp.sqlite")));
    assert.equal(fs.existsSync(path.join(dest, "sessions")), false);
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(path.join(dest, "whatsapp.sqlite"), {
      readOnly: true,
    });
    try {
      assert.equal(db.prepare("SELECT count(*) AS n FROM messages").get().n, 1);
    } finally {
      db.close();
    }
  }));

test("envío real: solo conectado, solo a chats autorizados, una vez por pedido y con registro", () =>
  fixture(async (c) => {
    await assert.rejects(
      c.send({ phone: "+34910000001", text: "hola" }),
      /Conectá WhatsApp/,
    );
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    const calls = [];
    c.client = {
      sendMessage: async (to, text) => {
        calls.push([to, text]);
        return { id: { _serialized: "msg-" + calls.length } };
      },
    };
    await assert.rejects(
      c.send({ phone: "+34910000001", text: "hola" }),
      /autorizados/,
    );
    c.store.permit(a, "+34910000001", "Proveedor");
    await assert.rejects(
      c.send({ phone: "+34910000001", text: "" }),
      /caracteres/,
    );
    const sent = await c.send({
      phone: "+34 910 000 001",
      text: "Pedido GS-001",
      order: "o1",
    });
    assert.deepEqual(calls, [["34910000001@c.us", "Pedido GS-001"]]);
    assert.equal(sent.id, "msg-1");
    await assert.rejects(
      c.send({ phone: "+34910000001", text: "otra vez", order: "o1" }),
      /ya se envió/,
    );
    assert.equal(calls.length, 1);
    const view = c.store.view(a);
    assert.equal(view.sent.length, 1);
    assert.equal(view.sent[0].order_id, "o1");
    assert.ok(view.history.some((h) => /ENVIADO a \+34910000001/.test(h.text)));
    c.client = null;
  }));
