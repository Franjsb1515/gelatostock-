const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const base = app.isPackaged
  ? path.dirname(process.execPath)
  : path.resolve(__dirname, "..");
const data = process.env.GELATO_DATA_DIR || path.join(base, "data");
fs.mkdirSync(path.join(data, "runtime"), { recursive: true });
app.setPath("userData", path.join(data, "runtime"));
app.setPath("sessionData", path.join(data, "runtime"));
app.setPath("logs", path.join(data, "runtime", "logs"));
app.setPath("crashDumps", path.join(data, "runtime", "crashes"));
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win, server;
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const backend = await require("./server.cjs").createApp({
        dataDir: data,
      });
      server = backend.server;
      let quitting = false;
      app.on("before-quit", async (e) => {
        if (quitting) return;
        e.preventDefault();
        quitting = true;
        await backend.whatsapp.close();
        app.quit();
      });
      const origin = new URL(backend.url).origin;
      win = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: "#f7f7f2",
        title: "GelatoStock",
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e, url) => {
        if (new URL(url).origin !== origin) e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
        cb(false),
      );
      const connectWhatsApp = process.argv.includes("--connect-whatsapp");
      await win.loadURL(backend.url + (connectWhatsApp ? "#whatsapp" : ""));
      if (connectWhatsApp) await backend.whatsapp.connect();
    })
    .catch((e) => {
      dialog.showErrorBox("No se pudo abrir GelatoStock", e.message);
      app.quit();
    });
  app.on("window-all-closed", () => {
    if (server) server.close();
    app.quit();
  });
}
