const fs = require("node:fs"),
  path = require("node:path");
const { WhatsAppStore, normalize, hash } = require("./whatsapp-store.cjs");
class WhatsAppConnection {
  constructor(dataDir, mainStore) {
    this.store = new WhatsAppStore(dataDir);
    this.mainStore = mainStore;
    this.status = "disconnected";
    this.generation = 0;
    this.error = "";
    this.qr = null;
    this.client = null;
    this.account = null;
    this.chain = Promise.resolve();
  }
  view(selected) {
    return {
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
        if (generation !== this.generation) return;
        try {
          const number = client.info?.wid?.user;
          if (!/^\d{8,15}$/.test(number || ""))
            throw Error("WhatsApp no devolvió el número de la cuenta.");
          this.account = this.store.bind("+" + number);
          this.readyAt = Math.floor(Date.now() / 1000);
          this.qr = null;
          this.status = "connected";
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
      client.on("disconnected", () => {
        if (generation === this.generation) {
          this.status = "disconnected";
          this.qr = null;
          this.error =
            "Sesión desconectada. Usá Cerrar sesión antes de volver a vincular.";
        }
      });
      client.on("message", (msg) => {
        if (
          generation !== this.generation ||
          this.status !== "connected" ||
          msg.fromMe ||
          !msg.from ||
          msg.from.endsWith("@g.us") ||
          msg.from === "status@broadcast" ||
          Number(msg.timestamp) < this.readyAt
        )
          return;
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
  async receive(msg, generation) {
    const account = this.account;
    if (!account || generation !== this.generation) return;
    let id = msg.from;
    if (id.endsWith("@lid")) {
      const pairs = await this.client.getContactLidAndPhone([id]);
      id = pairs?.[0]?.pn || "";
    }
    if (!/^\d{8,15}@c.us$/.test(id)) return;
    const sender = normalize("+" + id.split("@")[0]);
    if (generation !== this.generation) return;
    const permitted = this.store.allowed(account, sender);
    if (!permitted) return;
    const messageId = String(msg.id?._serialized || "");
    if (!messageId || this.store.has(account, messageId)) return;
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
      this.store.insert(account, entry);
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
      const result = await this.client.sendMessage(
        recipient.slice(1) + "@c.us",
        text,
      );
      const entry = {
        id:
          String(result?.id?._serialized || "") ||
          require("node:crypto").randomUUID(),
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
    ++this.generation;
    if (!this.client) {
      this.store.close();
      this.closingPromise = Promise.resolve();
      return this.closingPromise;
    }
    this.closingPromise = (async () => {
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
