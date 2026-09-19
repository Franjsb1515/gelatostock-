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
  "recipes",
  "productions",
  "learned",
  "prices",
  "days",
] as const;
type Table = (typeof entityTables)[number];
export class Store {
  archiveWarning: string | undefined;
  // Validated snapshot of the last read/write. Cleared on every write so a
  // concurrent writer (another connection) is noticed on the next load.
  private cached: State | undefined;
  // Rows as last written/read per table, so a write only touches what changed
  // instead of re-reading every table. Dropped whenever the state cache is dropped.
  private rowCache: Map<Table, Map<string, Row>> | undefined;
  private knownOperations: Set<string> | undefined;
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
        version <= 5,
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
   CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS learned(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS recipes(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS productions(id TEXT PRIMARY KEY,recipe TEXT NOT NULL REFERENCES recipes(id),status TEXT NOT NULL CHECK(status IN ('proposed','applied','discarded')),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS prices(id TEXT PRIMARY KEY,product TEXT NOT NULL REFERENCES products(id),data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS days(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),position INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS order_lines_product ON order_lines(product);
   CREATE INDEX IF NOT EXISTS movements_product ON movements(product);
   PRAGMA user_version=5;`);
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
      this.syncArchive();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  supplierFolder(id: string): string {
    return path.join(this.dataDir, "proveedores", "proveedor-" + digest(id));
  }
  syncArchive(): void {
    // A derived archive: SQLite and attachments remain authoritative. Retry on restart/save.
    try {
      const s = this.load();
      const root = path.join(this.dataDir, "proveedores");
      const mkdir = (dir: string) => {
        const base = path.resolve(this.dataDir);
        const relative = path.relative(base, path.resolve(dir));
        ensure(
          relative && !relative.startsWith("..") && !path.isAbsolute(relative),
          "Ruta de archivo inválida.",
        );
        let cursor = base;
        for (const part of relative.split(path.sep)) {
          cursor = path.join(cursor, part);
          if (!fs.existsSync(cursor)) fs.mkdirSync(cursor);
          ensure(
            !fs.lstatSync(cursor).isSymbolicLink() &&
              fs.statSync(cursor).isDirectory(),
            "La carpeta del archivo no puede ser un enlace.",
          );
        }
      };
      const writeJson = (dest: string, value: unknown) => {
        const text = JSON.stringify(value, null, 2);
        if (fs.existsSync(dest)) {
          ensure(
            !fs.lstatSync(dest).isSymbolicLink(),
            "Archivo enlazado no permitido.",
          );
          if (fs.readFileSync(dest, "utf8") === text) return;
        }
        this.atomicWrite(dest, text);
      };
      mkdir(root);
      writeJson(
        path.join(root, "indice.json"),
        s.suppliers.map((p) => ({
          id: p.id,
          nombre: p.name,
          carpeta: path.basename(this.supplierFolder(p.id)),
        })),
      );
      for (const p of s.suppliers) {
        const dir = this.supplierFolder(p.id);
        mkdir(path.join(dir, "fotos"));
        writeJson(path.join(dir, "proveedor.json"), p);
        writeJson(path.join(dir, "datos.json"), {
          productos: s.products.filter((x) => x.supplier === p.id),
          pedidos: s.orders.filter((x) => x.supplier === p.id),
          mensajes: s.messages.filter((x) => x.supplier === p.id),
          fotos: s.photos.filter((x) => x.supplier === p.id),
        });
      }
      for (const p of s.photos) {
        ensure(p.file && p.mime, "Adjunto sin archivo.");
        const date = p.documentDate || p.at.slice(0, 10);
        const dir = path.join(
          p.supplier
            ? this.supplierFolder(p.supplier)
            : path.join(root, "sin-proveedor"),
          "fotos",
          date,
        );
        mkdir(dir);
        const extension =
          p.mime === "image/jpeg"
            ? "jpg"
            : p.mime === "image/png"
              ? "png"
              : p.mime === "application/pdf"
                ? "pdf"
                : "webp";
        const dest = path.join(dir, digest(p.id) + "." + extension);
        if (!fs.existsSync(dest)) {
          const bytes = fs.readFileSync(path.join(this.attachments, p.file));
          ensure(digest(bytes) === p.file, "Adjunto dañado.");
          this.atomicWrite(dest, bytes);
        } else
          ensure(
            !fs.lstatSync(dest).isSymbolicLink(),
            "Foto enlazada no permitida.",
          );
        writeJson(dest + ".json", p);
      }
      this.archiveWarning = undefined;
    } catch (e) {
      this.archiveWarning =
        "Los datos están en SQLite, pero no se pudo actualizar el archivo por proveedor: " +
        (e instanceof Error ? e.message : String(e));
    }
  }
  private jsonRows(table: Table): unknown[] {
    return this.db
      .prepare(
        `SELECT data FROM ${table} ORDER BY position ${["orders", "messages", "activity", "movements", "photos", "productions", "days"].includes(table) ? "DESC" : "ASC"}`,
      )
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }
  load(): State {
    // Another connection may have written: the meta revision is the cheap check.
    if (this.cached) {
      const row = this.db
        .prepare(
          "SELECT json_extract(data,'$.revision') AS revision FROM meta WHERE id=1",
        )
        .get();
      if (row && Number(row.revision) === this.cached.revision)
        return structuredClone(this.cached);
      this.cached = undefined;
      this.rowCache = undefined;
      this.knownOperations = undefined;
    }
    const state = this.read();
    this.cached = state;
    return structuredClone(state);
  }
  private read(): State {
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
      recipes: this.jsonRows("recipes"),
      productions: this.jsonRows("productions"),
      learned: this.jsonRows("learned"),
      prices: this.jsonRows("prices"),
      days: this.jsonRows("days"),
      processed: this.db
        .prepare("SELECT id FROM operations ORDER BY position")
        .all()
        .map((r) => String(r.id)),
    });
  }
  private storePhoto(photo: Photo): Photo {
    if (photo.data) {
      const match =
        /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(
          photo.data,
        );
      ensure(match?.[1] && match[2], "Documento inválido.");
      const bytes = Buffer.from(match[2], "base64");
      const isPdf = match[1] === "application/pdf";
      ensure(
        bytes.length > 0 && bytes.length <= (isPdf ? 10_000_000 : 5_000_000),
        isPdf ? "El PDF supera 10 MB." : "La foto supera 5 MB.",
      );
      if (isPdf) {
        ensure(
          bytes.subarray(0, 5).toString() === "%PDF-",
          "El contenido no corresponde a un PDF.",
        );
        const file = digest(bytes);
        const dest = path.join(this.attachments, file);
        if (!fs.existsSync(dest)) this.atomicWrite(dest, bytes);
        const { data, ...rest } = photo;
        return { ...rest, file, mime: "application/pdf" };
      }
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
  private tableRows(table: Table): Map<string, Row> {
    if (!this.rowCache) this.rowCache = new Map();
    let rows = this.rowCache.get(table);
    if (!rows) {
      rows = new Map(
        this.db
          .prepare(`SELECT * FROM ${table}`)
          .all()
          .map((r) => [String(r.id), r as Row]),
      );
      this.rowCache.set(table, rows);
    }
    return rows;
  }
  private write(input: State): void {
    this.cached = undefined;
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
      recipes: basic(s.recipes),
      productions: basic(s.productions, true).map((r, i) => ({
        ...r,
        recipe: s.productions[i]!.recipe,
        status: s.productions[i]!.status,
      })),
      learned: basic(s.learned),
      prices: basic(s.prices).map((r, i) => ({
        ...r,
        product: s.prices[i]!.product,
      })),
      days: basic(s.days, true),
    };
    try {
      // Remove child rows before parent rows. Tables are a fixed internal allowlist.
      for (const table of [...entityTables].reverse()) {
        const ids = new Set(rows[table].map((r) => r.id));
        const old = this.tableRows(table);
        for (const id of [...old.keys()])
          if (!ids.has(id)) {
            this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
            old.delete(id);
          }
      }
      for (const table of entityTables) {
        const old = this.tableRows(table);
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
          old.set(r.id, r);
        }
      }
    } catch (error) {
      this.rowCache = undefined;
      this.knownOperations = undefined;
      throw error;
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
      recipes,
      productions,
      learned,
      prices,
      days,
      processed,
      ...meta
    } = s;
    this.db
      .prepare(
        "INSERT INTO meta(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(JSON.stringify(meta));
    // Only operations not yet stored are inserted; the set mirrors the table.
    if (!this.knownOperations)
      this.knownOperations = new Set(
        this.db
          .prepare("SELECT id FROM operations")
          .all()
          .map((r) => String(r.id)),
      );
    for (const [position, id] of s.processed.entries())
      if (!this.knownOperations.has(id)) {
        this.db
          .prepare("INSERT OR IGNORE INTO operations(id,position) VALUES(?,?)")
          .run(id, position);
        this.knownOperations.add(id);
      }
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
      this.syncArchive();
      return this.load();
    } catch (error) {
      this.cached = undefined;
      this.rowCache = undefined;
      this.knownOperations = undefined;
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
  // Local preferences outside the exported state (never part of backups).
  setting(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key);
    return row ? String(row.value) : undefined;
  }
  setSetting(key: string, value: string | undefined): void {
    if (value === undefined)
      this.db.prepare("DELETE FROM settings WHERE key=?").run(key);
    else
      this.db
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key, value);
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
        "Los datos cambiaron. Revisa la restauración.",
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
      this.syncArchive();
      return this.load();
    } catch (error) {
      this.cached = undefined;
      this.rowCache = undefined;
      this.knownOperations = undefined;
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close(): void {
    this.cached = undefined;
    this.rowCache = undefined;
    this.db.close();
  }
}
