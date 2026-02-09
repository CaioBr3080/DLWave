const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  openFolder: (folderPath) => ipcRenderer.invoke("open-folder", folderPath),
  getPlaylistInfo: (url) => ipcRenderer.invoke("get-playlist-info", url),
  requestPlaylistFolderName: (basePath) => ipcRenderer.invoke("request-playlist-folder-name", basePath),
  startDownload: (dados) => ipcRenderer.invoke("start-download", dados),
  cancelDownload: () => ipcRenderer.invoke("cancel-download"),
  checkResolution: (url, resolution, allowLowerQuality) => ipcRenderer.invoke("check-resolution", url, resolution, allowLowerQuality),
  savePreferences: (prefs) => ipcRenderer.invoke("save-preferences", prefs),
  loadPreferences: () => ipcRenderer.invoke("load-preferences"),
  getBinPath: () => ipcRenderer.invoke("get-bin-path"),
  openBinFolder: () => ipcRenderer.invoke("open-bin-folder"),
  checkDependencies: () => ipcRenderer.invoke("check-dependencies"),
  installDependencies: () => ipcRenderer.invoke("install-dependencies"),
  onLog: (callback) => ipcRenderer.on("log", (_, msg) => callback(msg))
});
