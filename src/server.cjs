const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { Store } = require("../build/store.js");
function createApp({
  dataDir = process.env.GELATO_DATA_DIR || path.join(__dirname, "..", "data"),
  port = 0,
} = {}) {
  const store = new Store(dataDir);
  const token = randomBytes(32).toString("hex");
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
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
      .includes(`gelato=${token}`);
    if (u.pathname === "/" && req.method === "GET") {
      if (u.searchParams.get("key") !== token && !authenticated) {
        json(403, { error: "Abrí la aplicación desde su acceso de inicio." });
        return;
      }
      res.setHeader(
        "Set-Cookie",
        `gelato=${token}; HttpOnly; SameSite=Strict; Path=/`,
      );
    } else if (!authenticated) {
      json(403, { error: "Sesión local no autorizada." });
      return;
    }
    if (u.pathname === "/api/state" && req.method === "GET") {
      json(200, {
        state: store.load(),
        dataDir,
        storage: "SQLite",
        archiveWarning: store.archiveWarning,
        version: "0.4.0",
      });
      return;
    }
    if (
      req.method === "POST" &&
      ["/api/action", "/api/backup", "/api/restore"].includes(u.pathname)
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
          if (size > 100_000_000)
            throw Error("Archivo demasiado grande (máximo 100 MB).");
          chunks.push(chunk);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (u.pathname === "/api/backup") {
          json(200, { path: store.backup() });
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
          version: "0.4.0",
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
      "/app.js": "app.js",
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
    server.once("close", () => store.close());
    server.listen(port, "127.0.0.1", () =>
      resolve({
        server,
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
