// Development-only: downloads the Chromium build that WhatsApp Web needs into runtime/browser
// for THIS platform (Windows, macOS or Linux) and writes runtime/browser.json. The delivered
// app never downloads anything. Uses the installer that puppeteer already ships.
// Usage: node scripts/setup-browser.cjs [buildId]
const path = require("node:path");
const fs = require("node:fs");
const {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
} = require("@puppeteer/browsers");
(async () => {
  const root = path.resolve(__dirname, "..");
  const cacheDir = path.join(root, "runtime", "browser");
  const current = fs.existsSync(path.join(root, "runtime", "browser.json"))
    ? JSON.parse(
        fs.readFileSync(path.join(root, "runtime", "browser.json"), "utf8"),
      )
    : null;
  // Same Chrome build as the Windows package unless overridden.
  const buildId =
    process.argv[2] ||
    (current && (current.executable.match(/win64-([\d.]+)\//) || [])[1]) ||
    "152.0.7977.75";
  const platform = detectBrowserPlatform();
  if (!platform) throw Error("Plataforma no reconocida para Chromium.");
  console.log(`Descargando Chrome ${buildId} para ${platform} en ${cacheDir}…`);
  const installed = await install({
    browser: "chrome",
    buildId,
    cacheDir,
    platform,
  });
  const executable = computeExecutablePath({
    browser: "chrome",
    buildId,
    cacheDir,
    platform,
  });
  const relative = path
    .relative(path.join(root, "runtime"), executable)
    .split(path.sep)
    .join("/");
  fs.writeFileSync(
    path.join(root, "runtime", "browser.json"),
    JSON.stringify({ executable: relative }) + "\n",
  );
  console.log("Listo:", installed.path);
  console.log("runtime/browser.json →", relative);
})().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
