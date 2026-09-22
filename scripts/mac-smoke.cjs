// Primera comprobación de la app empaquetada en un Mac (GitHub Actions o un Mac real):
// arranca dist/GelatoStock-<versión>-darwin-<arch>/GelatoStock.app con una carpeta de datos
// temporal, espera la ventana, comprueba la versión en pantalla y que Configuración enseñe la
// carpeta de datos, y cierra. No toca datos de nadie. Escrito desde Windows, sin validar.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");
const rules = require("./package-rules.cjs");
const root = path.resolve(__dirname, "..");
const version = require("../package.json").version;
const app = path.join(
  root,
  "dist",
  rules.outputDirName(version, process.platform, process.arch),
  "GelatoStock.app",
);
const executable = path.join(app, "Contents", "MacOS", "Electron");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "gelato-mac-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, t) => {
  console.log((ok ? "PASS: " : "FAIL: ") + t);
  if (!ok) failures++;
};
(async () => {
  check(fs.existsSync(executable), "existe " + executable);
  const plist = fs.readFileSync(
    path.join(app, "Contents", "Info.plist"),
    "utf8",
  );
  check(
    /<string>GelatoStock<\/string>/.test(plist),
    "Info.plist lleva el nombre GelatoStock",
  );
  check(
    fs.existsSync(
      path.join(app, "Contents", "Resources", "app", "runtime", "models"),
    ),
    "el modelo de IA local va dentro del .app",
  );
  const env = {
    ...process.env,
    GELATO_DATA_DIR: data,
    GELATO_CRUISES_AUTO: "0",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const electronApp = await electron.launch({
    executablePath: executable,
    env,
  });
  const win = await electronApp.firstWindow();
  await win
    .locator("#splash")
    .waitFor({ state: "detached", timeout: 30000 })
    .catch(() => {});
  await sleep(2000);
  const text = await win.locator("body").innerText();
  check(text.includes("v" + version), "la app arranca y dice v" + version);
  await win.evaluate(() => nav("settings"));
  await sleep(1500);
  const settings = await win.locator("main").innerText();
  check(
    settings.includes(data),
    "Configuración enseña la carpeta de datos: " + data,
  );
  check(
    fs.existsSync(path.join(data, "gelatostock.sqlite")),
    "la base de datos se creó ahí",
  );
  await electronApp.close();
  fs.rmSync(data, { recursive: true, force: true });
  console.log(failures ? `FALLOS: ${failures}` : "TODO PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("FALLO", String(e).slice(0, 1200));
  process.exit(1);
});
