const { DatabaseSync } = require("node:sqlite");
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs"),
  path = require("node:path");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const normalize = (v) => {
  const p = String(v || "").replace(/[ ()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(p))
    throw Error("Número inválido: usá prefijo internacional +34…");
  return p;
};
class WhatsAppStore {
  constructor(dataDir) {
    this.dir = path.join(dataDir, "whatsapp");
    fs.mkdirSync(this.dir, { recursive: true });
    this.db = new DatabaseSync(path.join(this.dir, "whatsapp.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,phone TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS allowed(account TEXT NOT NULL REFERENCES accounts(id),phone TEXT NOT NULL,label TEXT NOT NULL,supplier TEXT,PRIMARY KEY(account,phone));
 CREATE TABLE IF NOT EXISTS messages(account TEXT NOT NULL REFERENCES accounts(id),id TEXT NOT NULL,sender TEXT NOT NULL,at TEXT NOT NULL,text TEXT NOT NULL,file TEXT,name TEXT,mime TEXT,PRIMARY KEY(account,id));
 CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,at TEXT NOT NULL,text TEXT NOT NULL);`);
  }
  get(k) {
    return this.db.prepare("SELECT value FROM meta WHERE key=?").get(k)?.value;
  }
  set(k, v) {
    this.db
      .prepare(
        "INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(k, v);
  }
  note(text) {
    this.db
      .prepare("INSERT INTO history VALUES(?,?,?)")
      .run(randomUUID(), new Date().toISOString(), text);
  }
  session() {
    let s = this.get("session");
    if (!s) {
      s = randomUUID();
      this.set("session", s);
    }
    if (!/^[a-f0-9-]{36}$/.test(s)) throw Error("Sesión local inválida.");
    return s;
  }
  bind(phone) {
    phone = normalize(phone);
    const id = hash(phone);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.get("lastPhone");
      this.db
        .prepare("INSERT OR IGNORE INTO accounts VALUES(?,?)")
        .run(id, phone);
      this.set("active", id);
      this.set("lastPhone", phone);
      this.note(
        previous && previous !== phone
          ? `Cambio de número: ${previous} → ${phone}. Las nuevas conversaciones corresponden a ${phone}; las anteriores conservan su cuenta.`
          : `Sesión vinculada a ${phone}. Se conserva el historial de esta cuenta.`,
      );
      this.db.exec("COMMIT");
      return id;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  detach() {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.note(
        `Sesión cerrada de ${this.get("lastPhone") || "cuenta sin identificar"}. Historial conservado; pendiente de vincular otra sesión.`,
      );
      this.set("active", "");
      this.set("session", randomUUID());
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  permit(account, phone, label, supplier) {
    phone = normalize(phone);
    if (!label || label.trim().length > 100)
      throw Error("Indicá un nombre de hasta 100 caracteres.");
    this.db
      .prepare(
        "INSERT INTO allowed VALUES(?,?,?,?) ON CONFLICT(account,phone) DO UPDATE SET label=excluded.label,supplier=excluded.supplier",
      )
      .run(account, phone, label.trim(), supplier || null);
    this.note(`Chat autorizado: ${phone}, cuenta ${this.phone(account)}.`);
  }
  revoke(account, phone) {
    phone = normalize(phone);
    this.db
      .prepare("DELETE FROM allowed WHERE account=? AND phone=?")
      .run(account, phone);
    this.note(
      `Importación desactivada para ${phone}, cuenta ${this.phone(account)}. Historial conservado.`,
    );
  }
  phone(id) {
    return this.db.prepare("SELECT phone FROM accounts WHERE id=?").get(id)
      ?.phone;
  }
  allowed(account, phone) {
    return this.db
      .prepare("SELECT * FROM allowed WHERE account=? AND phone=?")
      .get(account, phone);
  }
  has(account, id) {
    return !!this.db
      .prepare("SELECT id FROM messages WHERE account=? AND id=?")
      .get(account, id);
  }
  insert(account, m) {
    if (!this.allowed(account, m.sender) || this.has(account, m.id))
      return false;
    this.db
      .prepare("INSERT INTO messages VALUES(?,?,?,?,?,?,?,?)")
      .run(
        account,
        m.id,
        m.sender,
        m.at,
        m.text,
        m.file || null,
        m.name || null,
        m.mime || null,
      );
    return true;
  }
  view(account) {
    return {
      accounts: this.db.prepare("SELECT * FROM accounts").all(),
      account: account || null,
      allowed: account
        ? this.db.prepare("SELECT * FROM allowed WHERE account=?").all(account)
        : [],
      messages: account
        ? this.db
            .prepare(
              "SELECT * FROM messages WHERE account=? ORDER BY at DESC,id LIMIT 200",
            )
            .all(account)
        : [],
      history: this.db
        .prepare("SELECT * FROM history ORDER BY at DESC,rowid DESC LIMIT 100")
        .all(),
    };
  }
  backup() {
    const dest = path.join(
      this.dir,
      "backups",
      Date.now() + "-" + randomUUID(),
    );
    fs.mkdirSync(dest, { recursive: true });
    this.db.prepare("VACUUM INTO ?").run(path.join(dest, "whatsapp.sqlite"));
    const files = path.join(this.dir, "files");
    if (fs.existsSync(files))
      fs.cpSync(files, path.join(dest, "files"), { recursive: true });
    fs.writeFileSync(
      path.join(dest, "LEEME.txt"),
      "Copia de conversaciones, permisos e historial. No contiene credenciales de sesión. Restauración manual con la app cerrada; conservar la carpeta completa.",
    );
    return dest;
  }
  close() {
    this.db.close();
  }
}
module.exports = { WhatsAppStore, normalize, hash };
