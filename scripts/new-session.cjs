const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const label = (process.argv.slice(2).join("-") || "sesion")
  .replace(/[^a-zA-Z0-9-]/g, "-")
  .slice(0, 70);
const name = stamp + "-" + label;
const dir = path.join(root, "reports");
fs.mkdirSync(dir, { recursive: true });
let status = "Git no disponible.",
  diff = "";
try {
  status = execFileSync("git", ["status", "--short"], {
    cwd: root,
    encoding: "utf8",
  });
  diff = execFileSync(
    "git",
    ["diff", "HEAD", "--", ".", " :(exclude)package-lock.json".trim()],
    { cwd: root, encoding: "utf8", maxBuffer: 10000000 },
  );
} catch {}
fs.writeFileSync(
  path.join(dir, name + ".md"),
  "# Sesión " +
    name +
    "\n\n## Objetivo\nCompletar.\n\n## Cambios y motivos\nCompletar.\n\n## Pruebas ejecutadas y resultados\nCompletar con evidencia real.\n\n## Limitaciones y siguiente paso\nCompletar.\n\n## Estado de archivos al crear este informe\n```text\n" +
    status +
    "\n```\n\nEl diff adjunto cubre cambios de archivos ya seguidos por Git; no incluye archivos nuevos sin seguimiento. Completar y revisar antes de entregar.\n",
);
fs.writeFileSync(path.join(dir, name + ".patch"), diff);
console.log(
  "Informe y diff creados: " +
    name +
    " (completar el contenido antes de cerrar la sesión).",
);
