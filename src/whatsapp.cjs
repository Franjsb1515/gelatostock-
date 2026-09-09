const fs = require("node:fs"),
  path = require("node:path");
const { EventEmitter } = require("node:events");
const { WhatsAppStore, normalize, hash } = require("./whatsapp-store.cjs");
class WhatsAppConnection {
  constructor(dataDir, mainStore) {
    this.store = new WhatsAppStore(dataDir);
    // Local diagnostics for the person testing the channel: ids and reasons, never message text.
    this.logFile = path.join(this.store.dir, "diagnostico.log");
    this.mainStore = mainStore;
    this.status = "disconnected";
    this.generation = 0;
    this.error = "";
    this.qr = null;
    this.client = null;
    this.account = null;
    this.chain = Promise.resolve();
    // Local events for the desktop shell (native notices); never leave the process.
    this.events = new EventEmitter();
  }
  get autoConnect() {
    return this.store.get("autoconnect") === "1";
  }
  set autoConnect(value) {
    this.store.set("autoconnect", value ? "1" : "0");
  }
  log(text) {
    try {
      if (fs.existsSync(this.logFile) && fs.statSync(this.logFile).size > 1e6)
        fs.renameSync(this.logFile, this.logFile + ".anterior");
      fs.appendFileSync(
        this.logFile,
        new Date().toISOString() + " " + text.slice(0, 400) + "\n",
      );
    } catch {}
  }
  diagnostics() {
    try {
      return fs
        .readFileSync(this.logFile, "utf8")
        .trim()
        .split("\n")
        .slice(-12);
    } catch {
      return [];
    }
  }
  view(selected) {
    return {
      diagnostics: this.diagnostics(),
      autoConnect: this.autoConnect,
      ...this.store.view(selected || this.account || this.store.get("active")),
      status: this.status,
      qr: this.qr,
      error: this.error,
      activeAccount: this.account,
      activePhone: this.account ? this.store.phone(this.account) : null,
    };
  }
  async connect() {
    if (this.status === "starting") return;
    if (this.client)
      throw Error("Cerrá la sesión actual antes de volver a conectar.");
    this.status = "starting";
    this.error = "";
    const generation = ++this.generation;
    try {
      const { Client, LocalAuth } = require("whatsapp-web.js");
      const QR = require("qrcode");
      const root = path.resolve(__dirname, "..");
      const config = JSON.parse(
        fs.readFileSync(path.join(root, "runtime", "browser.json"), "utf8"),
      );
      const executablePath = path.resolve(root, "runtime", config.executable);
      if (
        !executablePath.startsWith(path.resolve(root, "runtime") + path.sep) ||
        !fs.existsSync(executablePath)
      )
        throw Error(
          "Falta el navegador incluido. Copiá la carpeta completa de la app.",
        );
      const authPath = path.resolve(this.store.dir, "sessions");
      const session = this.store.session();
      const client = new Client({
        authStrategy: new LocalAuth({ clientId: session, dataPath: authPath }),
        puppeteer: {
          executablePath,
          headless: true,
          args: ["--disable-extensions"],
        },
        webVersionCache: { type: "none" },
        authTimeoutMs: 60000,
        qrMaxRetries: 6,
        deviceName: "GelatoStock",
        takeoverOnConflict: false,
      });
      this.client = client;
      client.on("qr", async (value) => {
        const img = await QR.toDataURL(value, { width: 280, margin: 2 });
        if (generation === this.generation) {
          this.qr = img;
          this.status = "qr";
        }
      });
      client.on("ready", () => {
        this.log("ready: cuenta " + (client.info?.wid?.user || "?"));
        if (generation !== this.generation) return;
        try {
          const number = client.info?.wid?.user;
          if (!/^\d{8,15}$/.test(number || ""))
            throw Error("WhatsApp no devolvió el número de la cuenta.");
          this.account = this.store.bind("+" + number);
          this.readyAt = Math.floor(Date.now() / 1000);
          this.qr = null;
          this.status = "connected";
          this.reconnectAttempts = 0;
          // Messages that arrived while the app was closed are not replayed as events:
          // read the recent history of each authorized chat once the sync settles.
          setTimeout(() => {
            if (generation === this.generation)
              this.recover(generation).catch((e) =>
                this.log(
                  "recuperación falló: " +
                    String(e?.message || e).slice(0, 120),
                ),
              );
          }, 8000).unref?.();
        } catch (e) {
          this.error = e.message;
          this.status = "error";
        }
      });
      client.on("auth_failure", () => {
        if (generation === this.generation) {
          this.error =
            "WhatsApp rechazó la sesión. Cerrala y volvé a vincular.";
          this.status = "error";
          this.qr = null;
        }
      });
      client.on("disconnected", (reason) => {
        if (generation !== this.generation) return;
        this.log("desconectado: " + String(reason || "").slice(0, 80));
        this.status = "disconnected";
        this.qr = null;
        this.error =
          "Sesión desconectada. Usá Cerrar sesión antes de volver a vincular.";
        if (this.autoConnect && String(reason) !== "LOGOUT")
          this.scheduleReconnect();
      });
      client.on("message", (msg) => {
        const skip =
          generation !== this.generation
            ? "sesión anterior"
            : this.status !== "connected"
              ? "estado " + this.status
              : msg.fromMe
                ? "propio"
                : !msg.from
                  ? "sin remitente"
                  : msg.from.endsWith("@g.us")
                    ? "grupo"
                    : msg.from === "status@broadcast"
                      ? "estado de WhatsApp"
                      : Number(msg.timestamp) < this.readyAt
                        ? "anterior a la conexión"
                        : "";
        if (skip) {
          this.log("entrante ignorado (" + skip + "): " + String(msg.from));
          return;
        }
        this.chain = this.chain
          .then(() => this.receive(msg, generation))
          .catch(() => {
            if (generation === this.generation)
              this.error =
                "No se pudo importar un mensaje autorizado. Revisá conexión y espacio en disco.";
          });
      });
      client.initialize().catch((e) => {
        if (generation === this.generation) {
          this.status = "error";
          this.qr = null;
          this.error =
            "No se pudo iniciar WhatsApp Web: " +
            String(e.message || e).slice(0, 200);
        }
      });
    } catch (e) {
      this.status = "error";
      this.error = e.message;
      this.client = null;
    }
  }
  // Authorized supplier messages also enter the main inbox (rules, priorities, order link).
  importToInbox(supplier, sender, entry) {
    if (typeof this.mainStore?.dispatch !== "function") return;
    try {
      const text = (
        entry.text || (entry.file ? "[Adjunto: " + entry.name + "]" : "")
      ).slice(0, 5000);
      if (!text.trim()) return;
      this.mainStore.dispatch({
        type: "message",
        supplier,
        text,
        eventId: "wa-" + hash(entry.id).slice(0, 40),
        channel: "whatsapp",
        sender,
      });
      this.log("mensaje de " + sender + " añadido a la bandeja de proveedores");
    } catch (e) {
      this.log(
        "no se pudo añadir a la bandeja: " +
          String(e?.message || e).slice(0, 120),
      );
    }
  }
  // Drop the browser without logging out and try again with growing delays (max 5 min).
  scheduleReconnect() {
    const attempt = (this.reconnectAttempts =
      (this.reconnectAttempts || 0) + 1);
    if (attempt > 20) {
      this.log("reconexión: se detienen los intentos automáticos");
      return;
    }
    const delay = Math.min(300000, 15000 * 2 ** Math.min(attempt - 1, 4));
    this.log(
      `reconexión automática en ${Math.round(delay / 1000)} s (intento ${attempt})`,
    );
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      if (this.closingPromise || !this.autoConnect) return;
      try {
        const client = this.client;
        this.client = null;
        if (client) {
          try {
            client.pupPage?.removeAllListeners?.();
          } catch {}
          try {
            await (client.pupBrowser
              ? client.pupBrowser.close()
              : client.destroy());
          } catch {}
        }
        await this.connect();
      } catch (e) {
        this.log("reconexión falló: " + String(e?.message || e).slice(0, 120));
        this.scheduleReconnect();
      }
    }, delay);
    this.reconnectTimer.unref?.();
  }
  // Read recent messages of each authorized chat and import what is missing (text only).
  async recover(generation = this.generation) {
    if (!this.client || this.status !== "connected" || !this.account) return 0;
    const allowed = this.store.view(this.account).allowed;
    let imported = 0;
    for (const contact of allowed) {
      if (generation !== this.generation) break;
      const digits = contact.phone.slice(1);
      let rows = [];
      try {
        rows = await this.client.pupPage.evaluate(async (id) => {
          const chat = await window.WWebJS.getChat(id, { getAsModel: false });
          const list = chat?.msgs?.getModelsArray?.() || [];
          return list
            .filter((m) => m && !m.id?.fromMe && m.type === "chat" && m.body)
            .slice(-50)
            .map((m) => ({
              id: String(m.id?._serialized || m.id),
              remote: String(m.id?.remote?._serialized || m.id?.remote || id),
              body: String(m.body).slice(0, 20000),
              t: Number(m.t) || 0,
            }));
        }, digits + "@c.us");
      } catch (e) {
        this.log(
          "historial de " +
            contact.phone +
            " no disponible: " +
            String(e?.message || e).slice(0, 80),
        );
        continue;
      }
      for (const r of rows) {
        if (generation !== this.generation) break;
        if (!r.id || this.store.has(this.account, r.id)) continue;
        const before = this.readyAt;
        this.readyAt = 0;
        try {
          await this.receive(
            {
              from: digits + "@c.us",
              id: {
                fromMe: false,
                remote: r.remote,
                id: r.id.split("_").pop(),
                _serialized: r.id,
              },
              timestamp: r.t,
              body: r.body,
              hasMedia: false,
            },
            generation,
          );
          imported++;
        } finally {
          this.readyAt = before;
        }
      }
    }
    this.log(
      `historial revisado: ${allowed.length} chat(s), ${imported} mensaje(s) nuevo(s) importado(s)`,
    );
    return imported;
  }
  async receive(msg, generation) {
    const account = this.account;
    if (!account || generation !== this.generation) return;
    let id = String(msg.from || "");
    if (!/^\d{8,15}@c\.us$/.test(id)) {
      // Newer WhatsApp identifies contacts by LID: resolve it to the phone number.
      let resolved = "";
      try {
        const pairs = await this.client.getContactLidAndPhone([id]);
        resolved = String(pairs?.[0]?.pn || "");
      } catch {}
      if (!/^\d{8,15}@c\.us$/.test(resolved)) {
        try {
          const contact = await msg.getContact();
          if (/^\d{8,15}$/.test(String(contact?.number || "")))
            resolved = contact.number + "@c.us";
        } catch {}
      }
      this.log("remitente " + id + " resuelto a " + (resolved || "nada"));
      id = resolved;
    }
    if (!/^\d{8,15}@c\.us$/.test(id)) {
      this.log(
        "entrante descartado: remitente no resoluble " + String(msg.from),
      );
      return;
    }
    const sender = normalize("+" + id.split("@")[0]);
    if (generation !== this.generation) return;
    const permitted = this.store.allowed(account, sender);
    if (!permitted) {
      this.log("entrante de " + sender + " no autorizado para esta cuenta");
      return;
    }
    this.log("entrante de " + sender + " autorizado; importando");
    // LID chats can carry ids without _serialized: rebuild the stable key.
    const rawId = msg.id || {};
    const messageId = String(
      rawId._serialized ||
        (rawId.id
          ? `${!!rawId.fromMe}_${rawId.remote?._serialized || rawId.remote || id}_${rawId.id}`
          : ""),
    );
    if (!messageId) {
      this.log("entrante descartado: sin identificador de mensaje");
      return;
    }
    if (this.store.has(account, messageId)) {
      this.log("entrante repetido " + messageId + ", ignorado");
      return;
    }
    const entry = {
      id: messageId,
      sender,
      at: new Date(Number(msg.timestamp) * 1000).toISOString(),
      text: String(msg.body || "").slice(0, 20000),
    };
    if (msg.hasMedia) {
      const media =
        Number(msg._data?.size) > 10000000 ? null : await msg.downloadMedia();
      if (
        generation !== this.generation ||
        !this.store.allowed(account, sender)
      )
        return;
      if (
        media &&
        ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          media.mimetype,
        ) &&
        media.data.length <= 14000000
      ) {
        const bytes = Buffer.from(media.data, "base64");
        const valid =
          media.mimetype === "application/pdf"
            ? bytes.subarray(0, 5).toString() === "%PDF-"
            : media.mimetype === "image/png"
              ? bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : media.mimetype === "image/jpeg"
                ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
                : bytes.toString("ascii", 0, 4) === "RIFF" &&
                  bytes.toString("ascii", 8, 12) === "WEBP";
        if (valid && bytes.length <= 10000000) {
          const ext = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "application/pdf": "pdf",
          }[media.mimetype];
          const relative = path.join(
            "files",
            account,
            permitted.supplier
              ? "proveedor-" + hash(permitted.supplier)
              : "contacto-" + hash(sender),
            entry.at.slice(0, 10),
            hash(messageId) + "." + ext,
          );
          const dest = path.join(this.store.dir, relative);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          if (!fs.existsSync(dest))
            fs.writeFileSync(dest, bytes, { flag: "wx" });
          Object.assign(entry, {
            file: relative,
            name: String(media.filename || "Adjunto." + ext).slice(0, 200),
            mime: media.mimetype,
          });
        }
      }
      if (!entry.file)
        entry.text +=
          "\n[Adjunto no archivado: tipo no admitido, demasiado grande o no disponible.]";
    }
    if (generation === this.generation && this.status === "connected")
      if (this.store.insert(account, entry)) {
        this.events.emit("message", {
          sender,
          label: permitted.label,
          text: String(entry.text || "").slice(0, 120),
          supplier: permitted.supplier || null,
        });
        if (permitted.supplier)
          this.importToInbox(permitted.supplier, sender, entry);
      }
  }
  // Real send. Only to a chat the person authorized for the connected account,
  // one order at a time, never automatic. The caller shows the exact text first.
  async send({ phone, text, order }) {
    if (!this.client || this.status !== "connected" || !this.account)
      throw Error("Conectá WhatsApp por QR antes de enviar.");
    const recipient = normalize(phone);
    const permitted = this.store.allowed(this.account, recipient);
    if (!permitted)
      throw Error(
        "Solo se envía a chats autorizados para esta cuenta. Autorizá el número primero.",
      );
    if (typeof text !== "string" || !text.trim() || text.length > 4000)
      throw Error("El mensaje debe tener entre 1 y 4.000 caracteres.");
    if (order && this.store.sentFor(order))
      throw Error("Este pedido ya se envió por WhatsApp; no se reenvía.");
    if (this.sending) throw Error("Ya hay un envío en curso.");
    this.sending = true;
    try {
      this.log("enviando a " + recipient + (order ? " pedido " + order : ""));
      // WhatsApp now keys chats by LID: resolve the real chat id before sending.
      // sendMessage returns undefined when no chat exists for the id.
      const digits = recipient.slice(1);
      let chatId = digits + "@c.us";
      try {
        const wid = await this.client.getNumberId(digits);
        if (wid?._serialized) chatId = String(wid._serialized);
      } catch (e) {
        this.log("getNumberId falló: " + String(e?.message || e).slice(0, 120));
      }
      this.log("chat destino " + chatId);
      let result = await this.client.sendMessage(chatId, text, {
        waitUntilMsgSent: true,
      });
      if (!result?.id?._serialized) {
        // whatsapp-web.js loses the sent message key with LID chats although the
        // message leaves (observed: ack 2 on the phone). Confirm against the chat itself.
        try {
          const found = await this.client.pupPage.evaluate(
            async (id, body) => {
              const chat = await window.WWebJS.getChat(id, {
                getAsModel: false,
              });
              const list = chat?.msgs?.getModelsArray?.() || [];
              for (
                let i = list.length - 1;
                i >= 0 && i >= list.length - 10;
                i--
              ) {
                const m = list[i];
                if (m?.id?.fromMe && m.body === body)
                  return { id: String(m.id._serialized || m.id), ack: m.ack };
              }
              return null;
            },
            chatId,
            text,
          );
          if (found?.id) {
            this.log(
              "envío confirmado en el chat: " + found.id + " ack " + found.ack,
            );
            result = { id: { _serialized: found.id } };
          }
        } catch (e) {
          this.log(
            "verificación en el chat falló: " +
              String(e?.message || e).slice(0, 120),
          );
        }
      }
      const messageId = String(result?.id?._serialized || "");
      if (!messageId) {
        this.log(
          "envío NO confirmado a " + recipient + ": sin chat para ese número",
        );
        throw Error(
          "WhatsApp no confirmó el envío: esta cuenta no encuentra un chat con " +
            recipient +
            ". Abrí una conversación con ese número desde el teléfono y volvé a intentarlo.",
        );
      }
      this.log("enviado a " + recipient + " id " + messageId);
      const entry = {
        id: messageId,
        recipient,
        at: new Date().toISOString(),
        text,
        order: order || null,
      };
      this.store.recordSent(this.account, entry);
      this.store.note(
        `Mensaje ENVIADO a ${recipient} (${permitted.label}) desde ${this.store.phone(this.account)}${order ? ", pedido " + order : ""}.`,
      );
      return entry;
    } finally {
      this.sending = false;
    }
  }
  async disconnect() {
    if (this.status === "closing")
      throw Error("La sesión ya se está cerrando.");
    const client = this.client;
    ++this.generation;
    this.status = "closing";
    this.qr = null;
    this.account = null;
    let failure = false;
    if (client) {
      try {
        const actual = path.resolve(
          client.authStrategy.userDataDir ||
            path.join(
              this.store.dir,
              "sessions",
              "session-" + this.store.session(),
            ),
        );
        const expected = path.resolve(
          this.store.dir,
          "sessions",
          "session-" + this.store.session(),
        );
        if (actual !== expected) throw Error("Ruta de sesión inesperada.");
        try {
          client.pupPage?.removeAllListeners?.();
        } catch {}
        if (
          client.pupBrowser &&
          typeof client.pupBrowser.isConnected !== "function"
        )
          client.pupBrowser.isConnected = () => client.pupBrowser.connected;
        if (client.info) await client.logout();
        else
          await (client.pupBrowser
            ? client.pupBrowser.close()
            : client.destroy());
      } catch {
        failure = true;
        try {
          await (client.pupBrowser
            ? client.pupBrowser.close()
            : client.destroy());
        } catch {}
      }
    }
    await this.chain;
    this.client = null;
    this.store.detach();
    this.status = "disconnected";
    this.error = failure
      ? "No se confirmó la desvinculación remota. Revisá Dispositivos vinculados en tu teléfono."
      : "";
  }
  allow(data) {
    if (!this.account || this.status !== "connected")
      throw Error("Conectá una cuenta antes de autorizar chats.");
    if (data.remove) {
      this.store.revoke(this.account, data.phone);
      return;
    }
    let { phone, label, supplier } = data;
    if (supplier) {
      const p = this.mainStore.load().suppliers.find((p) => p.id === supplier);
      if (!p?.whatsapp)
        throw Error("El proveedor necesita un número WhatsApp en su ficha.");
      phone = p.whatsapp;
      label = p.name;
    }
    this.store.permit(this.account, phone, label, supplier);
  }
  close() {
    if (this.closingPromise) return this.closingPromise;
    clearTimeout(this.reconnectTimer);
    ++this.generation;
    if (!this.client) {
      this.store.close();
      this.closingPromise = Promise.resolve();
      return this.closingPromise;
    }
    this.closingPromise = (async () => {
      try {
        this.client.pupPage?.removeAllListeners?.();
      } catch {}
      try {
        await (this.client.pupBrowser
          ? this.client.pupBrowser.close()
          : this.client.destroy());
      } catch {}
      await this.chain;
      this.store.close();
    })();
    return this.closingPromise;
  }
}
module.exports = { WhatsAppConnection };
