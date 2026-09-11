// Preload (sandboxed, context-isolated): the page gets exactly one capability, asking the
// main process to show the system folder picker. Nothing else from Node or Electron leaks in.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("gelato", {
  // Returns the chosen absolute path, or "" if the person cancels.
  pickFolder: (purpose) =>
    ipcRenderer.invoke("pick-folder", String(purpose || "").slice(0, 20)),
});
