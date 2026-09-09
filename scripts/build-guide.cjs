// Generates src/ui/guide.js from docs/GUIA_USO.md so the in-app guide and the docs never diverge.
const fs = require("node:fs");
const path = require("node:path");
const md = fs.readFileSync(
  path.join(__dirname, "..", "docs", "GUIA_USO.md"),
  "utf8",
);
const out =
  "// Generado por scripts/build-guide.cjs a partir de docs/GUIA_USO.md. No editar a mano.\n" +
  "const GUIDE_MD = " +
  JSON.stringify(md) +
  ";\n";
fs.writeFileSync(path.join(__dirname, "..", "src", "ui", "guide.js"), out);
console.log("guía generada: " + md.split("\n").length + " líneas");
