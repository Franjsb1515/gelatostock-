// Genera build-assets/icon.ico (y icon.png) a partir del cucurucho de la marca (src/ui/core.js,
// icono «ice») con sharp, sin herramientas externas. El .ico lleva PNG por tamaño, como
// admite Windows desde Vista. Se ejecuta a mano cuando cambie la marca; el resultado va en git.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const out = path.join(__dirname, "..", "build-assets");
fs.mkdirSync(out, { recursive: true });
const pistacho = "#35604a";
const crema = "#fbf7f0";
const cone =
  '<path d="m7 13 5 9 5-9Z M5 13h14a4 4 0 0 0-2-7 5 5 0 0 0-10 0 4 4 0 0 0-2 7Z"/>';
const svg = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
      `<rect x="0" y="0" width="24" height="24" rx="5.5" fill="${pistacho}"/>` +
      `<g transform="translate(1.2 1.2) scale(0.9)" fill="none" stroke="${crema}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${cone}</g>` +
      `</svg>`,
  );
(async () => {
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngs = [];
  for (const size of sizes)
    pngs.push({ size, png: await sharp(svg(size)).png().toBuffer() });
  // Cabecera ICO: reservado(2) tipo(2)=1 cantidad(2); una entrada de 16 bytes por imagen.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  fs.writeFileSync(
    path.join(out, "icon.ico"),
    Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]),
  );
  fs.writeFileSync(path.join(out, "icon.png"), pngs[0].png);
  console.log(
    "icono generado: build-assets/icon.ico (" +
      sizes.join(", ") +
      " px) y icon.png",
  );
})();
