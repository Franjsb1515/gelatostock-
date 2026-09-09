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

test("diagnóstico local registra motivos sin contenido y resuelve remitentes por LID", () =>
  fixture(async (c, dir) => {
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    c.readyAt = 0;
    c.store.permit(a, "+34910000001", "Proveedor");
    c.client = {
      getContactLidAndPhone: async () => [{ pn: "34910000001@c.us" }],
    };
    await c.receive(
      {
        from: "1234567890@lid",
        id: { _serialized: "lid-1" },
        timestamp: 1,
        body: "Texto secreto",
      },
      c.generation,
    );
    assert.equal(c.store.view(a).messages.length, 1);
    c.client = { getContactLidAndPhone: async () => [] };
    await c.receive(
      {
        from: "999@lid",
        id: { _serialized: "lid-2" },
        timestamp: 1,
        body: "otro",
        getContact: async () => ({ number: "34999999999" }),
      },
      c.generation,
    );
    assert.equal(c.store.view(a).messages.length, 1);
    const log = fs.readFileSync(
      path.join(dir, "whatsapp", "diagnostico.log"),
      "utf8",
    );
    assert.match(log, /resuelto a 34910000001@c.us/);
    assert.match(log, /no autorizado/);
    assert.ok(!log.includes("Texto secreto"));
    assert.ok(c.view().diagnostics.length >= 2);
    c.client = null;
  }));

test("envío real: usa el chat resuelto por WhatsApp y falla de forma visible si no existe chat", () =>
  fixture(async (c) => {
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    c.store.permit(a, "+34910000001", "Proveedor");
    const calls = [];
    c.client = {
      getNumberId: async () => ({ _serialized: "123456789012345@lid" }),
      sendMessage: async (to, text) => {
        calls.push(to);
        return to.endsWith("@lid")
          ? { id: { _serialized: "ok-1" } }
          : undefined;
      },
    };
    const sent = await c.send({ phone: "+34910000001", text: "hola" });
    assert.equal(sent.id, "ok-1");
    assert.deepEqual(calls, ["123456789012345@lid"]);
    c.client = {
      getNumberId: async () => null,
      getContactLidAndPhone: async () => [],
      sendMessage: async () => undefined,
    };
    await assert.rejects(
      c.send({ phone: "+34910000001", text: "hola" }),
      /no confirmó el envío/,
    );
    assert.equal(c.store.view(a).sent.length, 1);
    assert.ok(c.view().diagnostics.some((l) => /NO confirmado/.test(l)));
    c.client = null;
  }));

test("entrante con identificador sin _serialized se importa con clave reconstruida y no se duplica", () =>
  fixture(async (c) => {
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    c.readyAt = 0;
    c.store.permit(a, "+34910000001", "Proveedor");
    c.client = {};
    const msg = {
      from: "34910000001@c.us",
      id: { fromMe: false, remote: "34910000001@c.us", id: "ABC123" },
      timestamp: 1,
      body: "ok",
    };
    await c.receive(msg, c.generation);
    await c.receive(msg, c.generation);
    const view = c.store.view(a);
    assert.equal(view.messages.length, 1);
    assert.equal(view.messages[0].id, "false_34910000001@c.us_ABC123");
    c.client = null;
  }));

test("un mensaje autorizado de un proveedor entra en la bandeja principal una sola vez", () =>
  fixture(async (c) => {
    const dispatched = [];
    c.mainStore = {
      load: () => ({ suppliers: [] }),
      dispatch: (a) => {
        dispatched.push(a);
        return {};
      },
    };
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    c.readyAt = 0;
    c.store.permit(a, "+34910000001", "Proveedor", "sup-1");
    c.client = {};
    const msg = {
      from: "34910000001@c.us",
      id: { _serialized: "in-1" },
      timestamp: 1,
      body: "Llega el lunes",
    };
    await c.receive(msg, c.generation);
    await c.receive(msg, c.generation);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, "message");
    assert.equal(dispatched[0].supplier, "sup-1");
    assert.equal(dispatched[0].channel, "whatsapp");
    assert.equal(dispatched[0].sender, "+34910000001");
    assert.match(dispatched[0].eventId, /^wa-[a-f0-9]+$/);
    c.client = null;
  }));

test("preferencia de conexión automática y evento local al recibir un mensaje autorizado", () =>
  fixture(async (c) => {
    assert.equal(c.autoConnect, false);
    c.autoConnect = true;
    assert.equal(c.view().autoConnect, true);
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    c.readyAt = 0;
    c.store.permit(a, "+34910000001", "Proveedor");
    c.client = {};
    const seen = [];
    c.events.on("message", (m) => seen.push(m));
    await c.receive(
      {
        from: "34910000001@c.us",
        id: { _serialized: "ev-1" },
        timestamp: 1,
        body: "Llega el lunes",
      },
      c.generation,
    );
    assert.equal(seen.length, 1);
    assert.equal(seen[0].label, "Proveedor");
    assert.equal(seen[0].text, "Llega el lunes");
    c.client = null;
  }));

test("recuperación del historial reciente importa solo lo que falta y respeta autorizaciones", () =>
  fixture(async (c) => {
    const a = c.store.bind("+34600000001");
    c.account = a;
    c.status = "connected";
    c.readyAt = 9999999999;
    c.store.permit(a, "+34910000001", "Proveedor");
    c.store.insert(a, {
      id: "old-1",
      sender: "+34910000001",
      at: "2026-09-01T00:00:00.000Z",
      text: "antiguo",
    });
    c.client = {
      pupPage: {
        evaluate: async () => [
          { id: "old-1", remote: "34910000001@c.us", body: "antiguo", t: 1 },
          {
            id: "false_34910000001@c.us_NEW1",
            remote: "34910000001@c.us",
            body: "Llega el martes",
            t: 2,
          },
        ],
      },
    };
    const imported = await c.recover();
    assert.equal(imported, 1);
    const view = c.store.view(a);
    assert.equal(view.messages.length, 2);
    assert.ok(view.messages.some((m) => m.text === "Llega el martes"));
    assert.equal(await c.recover(), 0);
    assert.ok(
      c.diagnostics().some((l) => /historial revisado: 1 chat/.test(l)),
    );
    c.client = null;
  }));
test("reconexión automática se programa solo con la preferencia activa y sin cierre de sesión", () =>
  fixture(async (c) => {
    c.autoConnect = true;
    c.reconnectAttempts = 0;
    c.scheduleReconnect();
    assert.ok(c.reconnectTimer);
    assert.ok(
      c
        .diagnostics()
        .some((l) => /reconexión automática en 15 s \(intento 1\)/.test(l)),
    );
    clearTimeout(c.reconnectTimer);
    c.reconnectAttempts = 25;
    c.scheduleReconnect();
    assert.ok(c.diagnostics().some((l) => /se detienen/.test(l)));
  }));

test("limpieza del canal borra mensajes, envíos, notas y adjuntos antiguos y conserva lo reciente", () =>
  fixture(async (c, dir) => {
    const a = c.store.bind("+34600000001");
    c.store.permit(a, "+34910000001", "Proveedor");
    const files = path.join(dir, "whatsapp", "files");
    fs.mkdirSync(files, { recursive: true });
    fs.writeFileSync(path.join(files, "viejo.pdf"), "x");
    c.store.insert(a, {
      id: "v1",
      sender: "+34910000001",
      at: "2020-01-01T00:00:00.000Z",
      text: "viejo",
      file: "files/viejo.pdf",
      name: "viejo.pdf",
      mime: "application/pdf",
    });
    c.store.insert(a, {
      id: "n1",
      sender: "+34910000001",
      at: new Date().toISOString(),
      text: "nuevo",
    });
    c.store.recordSent(a, {
      id: "s1",
      recipient: "+34910000001",
      at: "2020-01-01T00:00:00.000Z",
      text: "antiguo",
      order: null,
    });
    const r = c.store.purge("2025-01-01T00:00:00.000Z");
    assert.deepEqual([r.messages, r.sent], [1, 1]);
    assert.ok(!fs.existsSync(path.join(files, "viejo.pdf")));
    const view = c.store.view(a);
    assert.deepEqual(
      view.messages.map((m) => m.text),
      ["nuevo"],
    );
    assert.equal(view.sent.length, 0);
    assert.ok(
      view.history.some((h) => /Limpieza: eliminados 1 mensajes/.test(h.text)),
    );
  }));
