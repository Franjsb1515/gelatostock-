// Ventana vacía de Electron para que scripts/make-calendar-photos.cjs dibuje cada foto de prueba.
const { app, BrowserWindow } = require("electron");
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1400,
    height: 1800,
    show: true,
    webPreferences: { sandbox: true, backgroundThrottling: false },
  });
  win.loadURL("about:blank");
});
