const {
  app,
  BrowserWindow,
  dialog,
  Notification,
  shell,
  ipcMain,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const base = app.isPackaged
  ? path.dirname(process.execPath)
  : path.resolve(__dirname, "..");
// Portátil: «data» junto al ejecutable. Instalada: en la carpeta local de la persona (src/datadir.cjs).
const data = require("./datadir.cjs").resolveDataDir({
  env: process.env,
  base,
  localAppData: process.env.LOCALAPPDATA || app.getPath("appData"),
  platform: process.platform,
  packaged: app.isPackaged,
  appData: app.getPath("appData"),
});
fs.mkdirSync(path.join(data, "runtime"), { recursive: true });
app.setPath("userData", path.join(data, "runtime"));
app.setPath("sessionData", path.join(data, "runtime"));
app.setPath("logs", path.join(data, "runtime", "logs"));
app.setPath("crashDumps", path.join(data, "runtime", "crashes"));
// Unexpected failures are written locally instead of closing the app or showing raw traces.
const errorLog = path.join(data, "runtime", "logs", "errores.log");
const { appendLog } = require("./logs.cjs");
const logError = (kind, e) =>
  appendLog(errorLog, kind + ": " + String((e && (e.stack || e.message)) || e));
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
        icon: path.join(__dirname, "..", "build-assets", "icon.png"),
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          spellcheck: false,
        },
      });
      // Links with target=_blank never open windows here. A supplier's purchase website
      // (https, saved in its card) opens in the system browser; anything else is denied.
      win.webContents.setWindowOpenHandler(({ url }) => {
        try {
          const u = new URL(url);
          const known = backend.store
            .load()
            .suppliers.some(
              (s) => s.web && u.protocol === "https:" && url.startsWith(s.web),
            );
          if (known) shell.openExternal(url);
        } catch {}
        return { action: "deny" };
      });
      win.webContents.on("will-navigate", (e, url) => {
        if (new URL(url).origin !== origin) e.preventDefault();
      });
      // The only bridge from the page: a native folder picker. Only our window may ask.
      ipcMain.handle("pick-folder", async (event, purpose) => {
        if (!win || event.sender !== win.webContents) return "";
        const titles = {
          backup: "Carpeta secundaria de copias",
          export: "Carpeta para la exportación CSV",
        };
        const r = await dialog.showOpenDialog(win, {
          title: titles[purpose] || "Elegir carpeta",
          properties: ["openDirectory", "createDirectory"],
        });
        return r.canceled || !r.filePaths[0] ? "" : r.filePaths[0];
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
          // El aviso se puede apagar en Configuración; el mensaje entra igual en la bandeja.
          if (backend.store.setting("message_notices_off") === "1") return;
          const n = new Notification({
            title:
              "WhatsApp · " +
              m.label +
              (m.reading ? " · " + m.reading.label : ""),
            body:
              (m.reading?.needsReading ? "Hay que leerlo. " : "") +
              (m.text || "Mensaje recibido"),
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
