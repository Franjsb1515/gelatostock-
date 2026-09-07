const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const dest = path.join(root, "dist", "GelatoStock-win32-x64");
if (process.platform !== "win32")
  throw Error(
    "Este empaquetado requiere Windows. Preparar y probar Mac por separado.",
  );
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(root, "node_modules", "electron", "dist"), dest, {
  recursive: true,
});
const oldExe = path.join(dest, "electron.exe");
const newExe = path.join(dest, "GelatoStock.exe");
if (fs.existsSync(newExe)) fs.unlinkSync(newExe);
fs.renameSync(oldExe, newExe);
const app = path.join(dest, "resources", "app");
fs.mkdirSync(app, { recursive: true });
fs.cpSync(path.join(root, "src"), path.join(app, "src"), { recursive: true });
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify({
    name: "appgelatostock",
    version: "0.1.0",
    main: "src/desktop.cjs",
  }),
);
console.log("Aplicación portátil creada en " + newExe);
