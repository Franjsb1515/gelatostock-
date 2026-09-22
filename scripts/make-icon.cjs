// Genera build-assets/icon.ico, icon.icns e icon.png a partir del cucurucho de la marca
// (src/ui/core.js, icono «ice») con sharp, sin herramientas externas.
// - .ico (Windows): PNG por tamaño, como admite Windows desde Vista.
// - .icns (Mac): contenedor con PNG por tamaño (ic07…ic14). Preparado desde Windows; que macOS
//   lo acepte queda por comprobar en un Mac.
// Se ejecuta a mano cuando cambie la marca; el resultado va en git.
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
const render = async (size) => sharp(svg(size)).png().toBuffer();
function ico(pngs) {
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
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]);
}
function icns(pngs) {
  // Tipos con PNG: ic07 128, ic08 256, ic09 512, ic10 1024, ic11 32 (16@2x), ic12 64 (32@2x),
  // ic13 256 (128@2x), ic14 512 (256@2x). Cada entrada: tipo(4) longitud(4, big-endian, incluida
  // la cabecera) datos. El archivo: «icns» + longitud total.
  const types = {
    128: "ic07",
    256: "ic08",
    512: "ic09",
    1024: "ic10",
    32: "ic11",
    64: "ic12",
  };
  const chunks = [];
  for (const { size, png } of pngs) {
    const list = [types[size]];
    if (size === 256) list.push("ic13");
    if (size === 512) list.push("ic14");
    for (const type of list) {
      if (!type) continue;
      const head = Buffer.alloc(8);
      head.write(type, 0, 4, "ascii");
      head.writeUInt32BE(8 + png.length, 4);
      chunks.push(head, png);
    }
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write("icns", 0, 4, "ascii");
  head.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}
(async () => {
  const all = {};
  for (const size of [1024, 512, 256, 128, 64, 48, 32, 16])
    all[size] = { size, png: await render(size) };
  fs.writeFileSync(
    path.join(out, "icon.ico"),
    ico([256, 128, 64, 48, 32, 16].map((s) => all[s])),
  );
  fs.writeFileSync(
    path.join(out, "icon.icns"),
    icns([1024, 512, 256, 128, 64, 32].map((s) => all[s])),
  );
  fs.writeFileSync(path.join(out, "icon.png"), all[256].png);
  console.log("iconos generados: build-assets/icon.ico, icon.icns e icon.png");
})();
