import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { apply, validate, ensure, seed } from "./domain";
import { parseAction, type State, type Photo } from "./schema";

type Row = {
  id: string;
  data: string;
  position: number;
  [key: string]: string | number;
};
const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const entityTables = [
  "suppliers",
  "products",
  "orders",
  "order_lines",
  "cart",
  "messages",
  "activity",
  "movements",
  "photos",
] as const;
type Table = (typeof entityTables)[number];
export class Store {
  readonly db: DatabaseSync;
  readonly file: string;
  readonly attachments: string;
  constructor(readonly dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, "gelatostock.sqlite");
    this.attachments = path.join(dataDir, "attachments");
    fs.mkdirSync(this.attachments, { recursive: true });
    this.db = new DatabaseSync(this.file);
    try {
      this.db.exec(
        "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
      );
      const version = Number(
        this.db.prepare("PRAGMA user_version").get()?.user_version,
      );
      ensure(
        version <= 1,
        "La base de datos pertenece a una versión más nueva.",
      );
      this.db
        .exec(`CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL CHECK(json_valid(data)));
   CREATE TABLE IF NOT EXISTS suppliers(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,supplier TEXT NOT NULL REFERENCES suppliers(id),stock_milli INTEGER NOT NULL CHECK(stock_milli>=0),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,supplier TEXT NOT NULL REFERENCES suppliers(id),status TEXT NOT NULL CHECK(status IN ('pending','sent','partial','received','cancelled')),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS order_lines(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),product TEXT NOT NULL REFERENCES products(id),ordered_milli INTEGER NOT NULL CHECK(ordered_milli>0),received_milli INTEGER NOT NULL CHECK(received_milli>=0 AND received_milli<=ordered_milli),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL,UNIQUE(order_id,product));
   CREATE TABLE IF NOT EXISTS cart(id TEXT PRIMARY KEY,product TEXT NOT NULL REFERENCES products(id),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,supplier TEXT NOT NULL REFERENCES suppliers(id),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS movements(id TEXT PRIMARY KEY,product TEXT NOT NULL REFERENCES products(id),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,fingerprint TEXT,position INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS order_lines_product ON order_lines(product);
   CREATE INDEX IF NOT EXISTS movements_product ON movements(product);
   PRAGMA user_version=1;`);
      ensure(
        this.db.prepare("PRAGMA quick_check").get()?.quick_check === "ok",
        "La base no pasó la comprobación de integridad.",
      );
      if (!this.db.prepare("SELECT id FROM meta").get()) {
        const legacy = path.join(dataDir, "stock.json");
        const initial = fs.existsSync(legacy)
          ? validate(JSON.parse(fs.readFileSync(legacy, "utf8")))
          : seed();
        if (fs.existsSync(legacy)) {
          const backupDir = path.join(dataDir, "backups");
          fs.mkdirSync(backupDir, { recursive: true });
          fs.copyFileSync(
            legacy,
            path.join(
              backupDir,
              `antes-sqlite-${Date.now()}-${randomUUID()}.json`,
            ),
            fs.constants.COPYFILE_EXCL,
          );
          initial.activity.unshift({
            id: randomUUID(),
            at: new Date().toISOString(),
            text: "Datos migrados a SQLite. Se conserva el JSON original y una copia previa.",
          });
        }
        this.db.exec("BEGIN IMMEDIATE");
        try {
          this.write(initial);
          this.db.exec("COMMIT");
        } catch (error) {
          this.db.exec("ROLLBACK");
          throw error;
        }
      }
      this.load();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private jsonRows(table: Table): unknown[] {
    return this.db
      .prepare(
        `SELECT data FROM ${table} ORDER BY position ${["orders", "messages", "activity", "movements", "photos"].includes(table) ? "DESC" : "ASC"}`,
      )
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }
  load(): State {
    const meta = this.db.prepare("SELECT data FROM meta WHERE id=1").get();
    ensure(meta, "Base vacía.");
    const header: unknown = JSON.parse(String(meta.data));
    ensure(typeof header === "object" && header, "Metadatos inválidos.");
    const orders = this.jsonRows("orders").map((o) => {
      ensure(typeof o === "object" && o && "id" in o, "Pedido inválido.");
      return {
        ...o,
        lines: this.db
          .prepare(
            "SELECT data FROM order_lines WHERE order_id=? ORDER BY position",
          )
          .all(String(o.id))
          .map((l) => JSON.parse(String(l.data))),
      };
    });
    return validate({
      ...header,
      products: this.jsonRows("products"),
      suppliers: this.jsonRows("suppliers"),
      cart: this.jsonRows("cart"),
      orders,
      messages: this.jsonRows("messages"),
      activity: this.jsonRows("activity"),
      movements: this.jsonRows("movements"),
      photos: this.jsonRows("photos"),
      processed: this.db
        .prepare("SELECT id FROM operations ORDER BY position")
        .all()
        .map((r) => String(r.id)),
    });
  }
  private storePhoto(photo: Photo): Photo {
    if (photo.data) {
      const match =
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
          photo.data,
        );
      ensure(match?.[1] && match[2], "Foto inválida.");
      const bytes = Buffer.from(match[2], "base64");
      ensure(
        bytes.length > 0 && bytes.length <= 5_000_000,
        "La foto supera 5 MB.",
      );
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp =
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
      ensure(
        match[1] === "image/png" ? png : match[1] === "image/jpeg" ? jpg : webp,
        "El contenido no coincide con el tipo de imagen.",
      );
      const file = digest(bytes);
      const dest = path.join(this.attachments, file);
      if (!fs.existsSync(dest)) this.atomicWrite(dest, bytes);
      const { data, ...rest } = photo;
      return { ...rest, file, mime: match[1] as Photo["mime"] };
    }
    ensure(photo.file && photo.mime, "Faltan metadatos del adjunto.");
    ensure(
      fs.existsSync(path.join(this.attachments, photo.file)),
      "Adjunto ausente.",
    );
    // Verify content hashes when reading/exporting; stock changes do not reread every image.
    return photo;
  }
  private write(input: State): void {
    this.db.exec("PRAGMA defer_foreign_keys=ON");
    const s = validate(input);
    s.photos = s.photos.map((p) => this.storePhoto(p));
    const basic = (list: { id: string }[], newestFirst = false) =>
      list.map((x, position): Row => ({
        id: x.id,
        data: JSON.stringify(x),
        position: newestFirst ? list.length - 1 - position : position,
      }));
    const rows: Record<Table, Row[]> = {
      suppliers: basic(s.suppliers),
      products: basic(s.products).map((r, i) => ({
        ...r,
        supplier: s.products[i]!.supplier,
        stock_milli: Math.round(s.products[i]!.stock * 1000),
      })),
      orders: s.orders.map(({ lines, ...o }, position) => ({
        id: o.id,
        supplier: o.supplier,
        status: o.status,
        data: JSON.stringify(o),
        position: s.orders.length - 1 - position,
      })),
      order_lines: s.orders.flatMap((o) =>
        o.lines.map((l, position) => ({
          id: o.id + ":" + l.product,
          order_id: o.id,
          product: l.product,
          ordered_milli: Math.round(l.packs * l.pack * 1000),
          received_milli: Math.round(l.received * 1000),
          data: JSON.stringify(l),
          position,
        })),
      ),
      cart: s.cart.map((l, position) => ({
        id: l.product,
        product: l.product,
        data: JSON.stringify(l),
        position,
      })),
      messages: basic(s.messages, true).map((r, i) => ({
        ...r,
        supplier: s.messages[i]!.supplier,
      })),
      activity: basic(s.activity, true),
      movements: basic(s.movements, true).map((r, i) => ({
        ...r,
        product: s.movements[i]!.product,
      })),
      photos: basic(s.photos, true),
    };
    // Remove child rows before parent rows. Tables are a fixed internal allowlist.
    for (const table of [...entityTables].reverse()) {
      const ids = new Set(rows[table].map((r) => r.id));
      for (const r of this.db.prepare(`SELECT id FROM ${table}`).all())
        if (!ids.has(String(r.id)))
          this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(String(r.id));
    }
    for (const table of entityTables) {
      const old = new Map(
        this.db
          .prepare(`SELECT * FROM ${table}`)
          .all()
          .map((r) => [String(r.id), r]),
      );
      for (const r of rows[table]) {
        const prev = old.get(r.id);
        if (prev && Object.entries(r).every(([k, v]) => prev[k] === v))
          continue;
        const keys = Object.keys(r);
        this.db
          .prepare(
            `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${keys
              .filter((k) => k !== "id")
              .map((k) => k + "=excluded." + k)
              .join(",")}`,
          )
          .run(...keys.map((k) => r[k]!));
      }
    }
    const {
      products,
      suppliers,
      cart,
      orders,
      messages,
      activity,
      movements,
      photos,
      processed,
      ...meta
    } = s;
    this.db
      .prepare(
        "INSERT INTO meta(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(JSON.stringify(meta));
    for (const [position, id] of s.processed.entries())
      this.db
        .prepare("INSERT OR IGNORE INTO operations(id,position) VALUES(?,?)")
        .run(id, position);
  }
  dispatch(input: unknown): State {
    const a = parseAction(input);
    const { operationId, revision, ...semantic } = a;
    const fingerprint = digest(JSON.stringify(semantic));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.load();
      if (operationId) {
        const previous = this.db
          .prepare("SELECT fingerprint FROM operations WHERE id=?")
          .get(operationId);
        if (previous) {
          ensure(
            !previous.fingerprint || previous.fingerprint === fingerprint,
            "Ese identificador ya corresponde a otra operación.",
          );
          this.db.exec("COMMIT");
          return current;
        }
      }
      const next = apply(current, a);
      this.write(next);
      if (operationId)
        this.db
          .prepare("UPDATE operations SET fingerprint=? WHERE id=?")
          .run(fingerprint, operationId);
      this.db.exec("COMMIT");
      return this.load();
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
  photo(id: string): { bytes: Buffer; mime: string } {
    const p = this.load().photos.find((x) => x.id === id);
    ensure(p?.file && p.mime, "Foto no encontrada.");
    const bytes = fs.readFileSync(path.join(this.attachments, p.file));
    ensure(digest(bytes) === p.file, "Adjunto dañado.");
    return { bytes, mime: p.mime };
  }
  exportState(): State {
    const s = this.load();
    s.photos = s.photos.map((p) => {
      const { bytes, mime } = this.photo(p.id);
      const { file, ...rest } = p;
      return {
        ...rest,
        data: `data:${mime};base64,${bytes.toString("base64")}`,
      };
    });
    return s;
  }
  private atomicWrite(dest: string, body: string | Buffer): void {
    const tmp = dest + "." + randomUUID() + ".tmp";
    try {
      const fd = fs.openSync(tmp, "wx");
      try {
        fs.writeFileSync(fd, body);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, dest);
    } catch (error) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      throw error;
    }
  }
  backup(): string {
    const folder = path.join(this.dataDir, "backups");
    fs.mkdirSync(folder, { recursive: true });
    const dest = path.join(
      folder,
      `gelatostock-${Date.now()}-${randomUUID()}.json`,
    );
    const text = JSON.stringify(this.exportState());
    ensure(
      Buffer.byteLength(text) <= 100_000_000,
      "Esta copia supera el límite de 100 MB de la herramienta de exportación.",
    );
    this.atomicWrite(dest, text);
    return dest;
  }
  restore(input: unknown, expectedRevision: number): State {
    const next = validate(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.load();
      ensure(
        previous.revision === expectedRevision,
        "Los datos cambiaron. Revisá la restauración.",
      );
      this.backup();
      // A portable backup must carry every image, not refer to files on another PC.
      for (const photo of next.photos)
        ensure(photo.data, "La copia no contiene todos los adjuntos.");
      next.processed = [...new Set([...previous.processed, ...next.processed])];
      next.revision = previous.revision + 1;
      next.activity.unshift({
        id: randomUUID(),
        at: new Date().toISOString(),
        text: "Copia restaurada en SQLite; estado anterior conservado en backups.",
      });
      this.write(next);
      this.db.exec("COMMIT");
      return this.load();
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close(): void {
    this.db.close();
  }
}
