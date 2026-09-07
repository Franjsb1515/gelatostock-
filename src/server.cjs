const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { seed, apply, validate } = require("./domain.cjs");
function createApp({
  dataDir = process.env.GELATO_DATA_DIR || path.join(__dirname, "..", "data"),
  port = 0,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "stock.json");
  let state = fs.existsSync(file)
    ? validate(JSON.parse(fs.readFileSync(file, "utf8")))
    : seed();
  const save = (s) => {
    fs.writeFileSync(file + ".tmp", JSON.stringify(s, null, 2), "utf8");
    fs.renameSync(file + ".tmp", file);
  };
  if (!fs.existsSync(file)) save(state);
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
      json(200, { state, dataDir });
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
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 25000000)
            throw Error("Archivo demasiado grande (máximo 25 MB).");
        }
        const data = JSON.parse(body || "{}");
        if (u.pathname === "/api/backup") {
          const dir = path.join(dataDir, "backups");
          fs.mkdirSync(dir, { recursive: true });
          const dest = path.join(dir, `gelatostock-${Date.now()}.json`);
          fs.writeFileSync(dest, JSON.stringify(state, null, 2));
          json(200, { path: dest });
          return;
        }
        if (u.pathname === "/api/restore") {
          const next = validate(data);
          const backup = path.join(
            dataDir,
            `antes-restaurar-${Date.now()}.json`,
          );
          fs.writeFileSync(backup, JSON.stringify(state, null, 2));
          next.revision = state.revision + 1;
          next.activity.unshift({
            id: randomBytes(8).toString("hex"),
            at: new Date().toISOString(),
            text: "Copia restaurada. Se conservó una copia del estado anterior.",
          });
          save(next);
          state = next;
        } else {
          const next = apply(state, data);
          save(next);
          state = next;
        }
        json(200, { state, dataDir });
      } catch (e) {
        json(400, { error: e.message });
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
    server.once("error", reject);
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
