const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, timingSafeEqual } = require("node:crypto");
const { identifySupplier } = require("../build/identify.js");
const { interpretReply } = require("../build/messages.js");
const { orderMessage } = require("../build/domain.js");
const { recognizeLocal } = require("./ocr.cjs");
const { WhatsAppConnection } = require("./whatsapp.cjs");
const { LocalAI } = require("./ai.cjs");
const version = require("../package.json").version;
const { Store } = require("../build/store.js");
function createApp({
  dataDir = process.env.GELATO_DATA_DIR || path.join(__dirname, "..", "data"),
  port = 0,
} = {}) {
  const store = new Store(dataDir);
  // Daily automatic copy (data + photos) with a bounded history of automatic files only.
  const backupDir = path.join(dataDir, "backups");
  const backupInfo = { last: null, warning: "" };
  const autoBackup = () => {
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      const own = () =>
        fs
          .readdirSync(backupDir)
          .filter((f) => /^gelatostock-\d+-[0-9a-f-]{36}\.json$/.test(f))
          .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
      const files = own();
      const last = files.length
        ? Number(files[files.length - 1].split("-")[1])
        : 0;
      if (Date.now() - last > 24 * 3600 * 1000) {
        store.backup();
        for (const f of own().slice(0, -30))
          fs.unlinkSync(path.join(backupDir, f));
        backupInfo.last = new Date().toISOString();
      } else backupInfo.last = new Date(last).toISOString();
      backupInfo.warning = "";
    } catch (e) {
      backupInfo.warning =
        "No se pudo crear la copia automática: " + String(e.message || e);
    }
  };
  setImmediate(autoBackup);
  const backupTimer = setInterval(autoBackup, 6 * 3600 * 1000);
  backupTimer.unref();
  const ai = new LocalAI();
  const whatsapp = new WhatsAppConnection(dataDir, store);
  const token = randomBytes(32).toString("hex");
  const sameToken = (value) =>
    typeof value === "string" &&
    value.length === token.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(token));
  // Rules only: category, resolved date and "needs reading" for each imported message.
  const annotate = (view) => ({
    ...view,
    messages: (view.messages || []).map((m) => ({
      ...m,
      interpretation: m.text ? interpretReply(m.text, m.at) : undefined,
    })),
  });
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    if (req.headers.host !== new URL(origin).host) {
      json(403, { error: "Origen inválido." });
      return;
    }
    const u = new URL(req.url, origin);
    const authenticated = (req.headers.cookie || "")
      .split("; ")
      .some((c) => c.startsWith("gelato=") && sameToken(c.slice(7)));
    if (u.pathname === "/" && req.method === "GET") {
      const key = u.searchParams.get("key");
      if (key !== null && !sameToken(key)) {
        json(403, { error: "Abrí la aplicación desde su acceso de inicio." });
        return;
      }
      if (key !== null) {
        // Bootstrap: set the session cookie and drop the key from the visible URL.
        res.writeHead(302, {
          "Set-Cookie": `gelato=${token}; HttpOnly; SameSite=Strict; Path=/`,
          Location: "/",
          "Cache-Control": "no-store",
        });
        res.end();
        return;
      }
      if (!authenticated) {
        json(403, { error: "Abrí la aplicación desde su acceso de inicio." });
        return;
      }
    } else if (!authenticated) {
      json(403, { error: "Sesión local no autorizada." });
      return;
    }
    if (u.pathname === "/api/whatsapp" && req.method === "GET") {
      json(200, annotate(whatsapp.view(u.searchParams.get("account"))));
      return;
    }
    if (u.pathname === "/api/state" && req.method === "GET") {
      json(200, {
        state: store.load(),
        dataDir,
        storage: "SQLite",
        archiveWarning: store.archiveWarning,
        version,
        backup: backupInfo,
      });
      return;
    }
    if (
      req.method === "POST" &&
      [
        "/api/ai",
        "/api/ai/cancel",
        "/api/ai/chat",
        "/api/ai/message",
        "/api/action",
        "/api/backup",
        "/api/export",
        "/api/restore",
        "/api/identify",
        "/api/whatsapp",
        "/api/ocr",
      ].includes(u.pathname)
    ) {
      if (
        req.headers.origin !== origin ||
        !String(req.headers["content-type"]).startsWith("application/json")
      ) {
        json(403, { error: "Solicitud no autorizada." });
        return;
      }
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (
            size >
            (u.pathname.startsWith("/api/ai")
              ? 20000
              : u.pathname === "/api/ocr"
                ? 8_100_000
                : u.pathname === "/api/identify"
                  ? 100_000
                  : 100_000_000)
          )
            throw Error("Archivo demasiado grande (máximo 100 MB).");
          chunks.push(chunk);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (u.pathname === "/api/ai/cancel") {
          await ai.cancel();
          json(200, { cancelled: true });
          return;
        }
        if (u.pathname === "/api/ai") {
          json(200, await ai.analyze(data));
          return;
        }
        if (u.pathname === "/api/ai/chat") {
          json(200, await ai.chat(data));
          return;
        }
        if (u.pathname === "/api/ai/message") {
          // The model only proposes a category; the annotation never touches stock or orders.
          const message = store
            .load()
            .messages.find((m) => m.id === String(data.id || ""));
          if (!message) throw Error("Mensaje inexistente.");
          const reading = await ai.readReply(message.text);
          const state = store.dispatch({
            type: "aiNote",
            id: message.id,
            category: reading.category,
            status: reading.status,
            model: reading.model,
          });
          json(200, {
            state,
            dataDir,
            storage: "SQLite",
            archiveWarning: store.archiveWarning,
            version,
            reading,
          });
          return;
        }
        if (u.pathname === "/api/whatsapp") {
          if (data.type === "backup") {
            json(200, { path: whatsapp.store.backup() });
            return;
          }
          if (data.type === "preview" || data.type === "send") {
            const state = store.load();
            const order = state.orders.find(
              (o) => o.id === String(data.order || ""),
            );
            if (!order) throw Error("Pedido inexistente.");
            if (order.status !== "pending")
              throw Error("Solo se envían pedidos pendientes.");
            const supplier = state.suppliers.find(
              (x) => x.id === order.supplier,
            );
            if (!supplier?.whatsapp)
              throw Error(
                "El proveedor no tiene WhatsApp en su ficha. Añadilo en Proveedores.",
              );
            const text = orderMessage(state, order.id);
            if (data.type === "preview") {
              json(200, {
                text,
                to: supplier.whatsapp,
                label: supplier.name,
                connected: whatsapp.status === "connected",
                authorized:
                  !!whatsapp.account &&
                  !!whatsapp.store.allowed(whatsapp.account, supplier.whatsapp),
              });
              return;
            }
            // The person authorizes this exact text; anything else is refused.
            if (data.text !== text)
              throw Error(
                "El texto cambió desde la vista previa. Volvé a abrir el envío.",
              );
            const sent = await whatsapp.send({
              phone: supplier.whatsapp,
              text,
              order: order.id,
            });
            const next = store.dispatch({
              type: "send",
              order: order.id,
              dispatch: {
                channel: "whatsapp",
                to: sent.recipient,
                messageId: sent.id,
                at: sent.at,
                text,
              },
            });
            json(200, {
              state: next,
              dataDir,
              storage: "SQLite",
              archiveWarning: store.archiveWarning,
              version,
              sent,
            });
            return;
          }
          if (data.type === "recover") {
            const imported = await whatsapp.recover();
            json(200, { ...annotate(whatsapp.view()), imported });
            return;
          }
          if (data.type === "autoconnect") {
            whatsapp.autoConnect = data.enabled === true;
            json(200, annotate(whatsapp.view()));
            return;
          }
          if (data.type === "sendText") {
            const sent = await whatsapp.send({
              phone: String(data.phone || ""),
              text: String(data.text || ""),
            });
            json(200, { ...annotate(whatsapp.view()), sent });
            return;
          }
          if (data.type === "connect") await whatsapp.connect();
          else if (data.type === "disconnect") await whatsapp.disconnect();
          else if (data.type === "allow") whatsapp.allow(data);
          else throw Error("Acción WhatsApp desconocida.");
          json(200, annotate(whatsapp.view()));
          return;
        }
        if (u.pathname === "/api/identify") {
          json(200, identifySupplier(store.load(), data));
          return;
        }
        if (u.pathname === "/api/ocr") {
          const result = await recognizeLocal(data.data);
          json(200, {
            ...result,
            detection: identifySupplier(store.load(), { text: result.text }),
          });
          return;
        }
        if (u.pathname === "/api/export") {
          // CSV (semicolon, UTF-8 with BOM) of products and movements for a spreadsheet.
          const s = store.load();
          const cell = (v) => {
            const t = String(v ?? "");
            return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
          };
          const line = (cells) => cells.map(cell).join(";");
          const byId = new Map(s.products.map((p) => [p.id, p]));
          const products = [
            line([
              "producto",
              "detalle",
              "categoria",
              "unidad",
              "stock",
              "minimo",
              "objetivo",
              "presentacion",
              "precio_eur",
              "proveedor",
            ]),
            ...s.products.map((p) =>
              line([
                p.name,
                p.detail,
                p.category,
                p.unit,
                p.stock,
                p.min,
                p.target,
                p.pack,
                (p.price / 100).toFixed(2),
                s.suppliers.find((x) => x.id === p.supplier)?.name || "",
              ]),
            ),
          ].join("\r\n");
          const movements = [
            line([
              "fecha",
              "producto",
              "tipo",
              "cambio",
              "antes",
              "despues",
              "motivo",
            ]),
            ...s.movements.map((m) =>
              line([
                m.at,
                byId.get(m.product)?.name || m.product,
                m.kind,
                m.delta,
                m.before,
                m.after,
                m.reason,
              ]),
            ),
          ].join("\r\n");
          const dir = path.join(dataDir, "exportaciones");
          fs.mkdirSync(dir, { recursive: true });
          const stamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[:T]/g, "-");
          const files = [
            [path.join(dir, `inventario-${stamp}.csv`), products],
            [path.join(dir, `movimientos-${stamp}.csv`), movements],
          ];
          for (const [file, body] of files)
            fs.writeFileSync(file, "\ufeff" + body + "\r\n");
          json(200, { files: files.map(([f]) => f) });
          return;
        }
        if (u.pathname === "/api/backup") {
          const created = store.backup();
          backupInfo.last = new Date().toISOString();
          json(200, { path: created });
          return;
        }
        if (u.pathname === "/api/restore") {
          if (!Number.isInteger(data.revision))
            throw Error("Falta la versión de la restauración.");
          store.restore(data.backup, data.revision);
        } else {
          if (
            !Number.isInteger(data.revision) ||
            typeof data.operationId !== "string"
          )
            throw Error("Falta la versión o el identificador de la operación.");
          store.dispatch(data);
        }
        json(200, {
          state: store.load(),
          dataDir,
          storage: "SQLite",
          archiveWarning: store.archiveWarning,
          version,
        });
      } catch (e) {
        json(/cambiaron|ya corresponde/.test(e.message) ? 409 : 400, {
          error: e.message,
        });
      }
      return;
    }
    if (
      req.method === "GET" &&
      /^\/api\/photos\/[a-zA-Z0-9-]+$/.test(u.pathname)
    ) {
      try {
        const { bytes, mime } = store.photo(u.pathname.split("/").pop());
        res.writeHead(200, {
          "Content-Type": mime,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        });
        res.end(bytes);
      } catch (e) {
        json(404, { error: e.message });
      }
      return;
    }
    const assets = {
      "/": "index.html",
      "/ui/core.js": "ui/core.js",
      "/ui/whatsapp.js": "ui/whatsapp.js",
      "/ui/views.js": "ui/views.js",
      "/ui/forms.js": "ui/forms.js",
      "/ui/actions.js": "ui/actions.js",
      "/ui/events.js": "ui/events.js",
      "/ui/actions-extended.js": "ui/actions-extended.js",
      "/styles.css": "styles.css",
    };
    if (req.method !== "GET" || !assets[u.pathname]) {
      json(404, { error: "No encontrado." });
      return;
    }
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
    );
    res.setHeader(
      "Content-Type",
      u.pathname.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : u.pathname.endsWith(".css")
          ? "text/css; charset=utf-8"
          : "text/html; charset=utf-8",
    );
    res.end(fs.readFileSync(path.join(__dirname, assets[u.pathname])));
  });
  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      store.close();
      reject(error);
    });
    server.once("close", () => {
      clearInterval(backupTimer);
      ai.cancel().catch(() => {});
      store.close();
      whatsapp.close().catch(() => {});
    });
    server.listen(port, "127.0.0.1", () =>
      resolve({
        server,
        whatsapp,
        ai,
        url: `http://127.0.0.1:${server.address().port}/?key=${token}`,
      }),
    );
  });
}
if (require.main === module)
  createApp({ port: Number(process.env.PORT || 4317) })
    .then(({ url }) => console.log(url))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
module.exports = { createApp };
