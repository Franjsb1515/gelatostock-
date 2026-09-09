const { app, BrowserWindow, dialog, Notification } = require("electron");
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
// Unexpected failures are written locally instead of closing the app or showing raw traces.
const errorLog = path.join(data, "runtime", "logs", "errores.log");
const logError = (kind, e) => {
  try {
    fs.mkdirSync(path.dirname(errorLog), { recursive: true });
    fs.appendFileSync(
      errorLog,
      `${new Date().toISOString()} ${kind}: ${String((e && (e.stack || e.message)) || e).slice(0, 2000)}\n`,
    );
  } catch {}
};
process.on("unhandledRejection", (e) => logError("rechazo no controlado", e));
process.on("uncaughtException", (e) => logError("excepción no controlada", e));
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
        await backend.ai.cancel();
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
          webSecurity: true,
          allowRunningInsecureContent: false,
          spellcheck: false,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e, url) => {
        if (new URL(url).origin !== origin) e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
        cb(false),
      );
      win.webContents.session.setPermissionCheckHandler(() => false);
      win.webContents.on("will-attach-webview", (e) => e.preventDefault());
      const connectWhatsApp = process.argv.includes("--connect-whatsapp");
      await win.loadURL(backend.url + (connectWhatsApp ? "#whatsapp" : ""));
      // Native notice when an authorized supplier writes; clicking brings the window back.
      backend.whatsapp.events.on("message", (m) => {
        try {
          if (!Notification.isSupported()) return;
          const n = new Notification({
            title: "WhatsApp · " + m.label,
            body: m.text || "Mensaje recibido",
          });
          n.on("click", () => {
            if (!win) return;
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          });
          n.show();
        } catch (e) {
          logError("aviso nativo", e);
        }
      });
      if (connectWhatsApp || backend.whatsapp.autoConnect)
        backend.whatsapp
          .connect()
          .catch((e) => logError("conexión WhatsApp", e));
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
