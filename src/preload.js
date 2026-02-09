const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  selectCookiesFile: () => ipcRenderer.invoke("select-cookies-file"),
  openFolder: (folderPath) => ipcRenderer.invoke("open-folder", folderPath),
  getPlaylistInfo: (url) => ipcRenderer.invoke("get-playlist-info", url),
  requestPlaylistFolderName: (basePath) => ipcRenderer.invoke("request-playlist-folder-name", basePath),
  startDownload: (tabId, dados) => ipcRenderer.invoke("start-download", { tabId, ...dados }),
  cancelDownload: (tabId) => ipcRenderer.invoke("cancel-download", tabId),
  checkResolution: (url, resolution, allowLowerQuality) => ipcRenderer.invoke("check-resolution", url, resolution, allowLowerQuality),
  savePreferences: (prefs) => ipcRenderer.invoke("save-preferences", prefs),
  loadPreferences: () => ipcRenderer.invoke("load-preferences"),
  getBinPath: () => ipcRenderer.invoke("get-bin-path"),
  openBinFolder: () => ipcRenderer.invoke("open-bin-folder"),
  checkDependencies: () => ipcRenderer.invoke("check-dependencies"),
  installDependencies: () => ipcRenderer.invoke("install-dependencies"),
  onBeforeQuit: (callback) => ipcRenderer.on("before-quit-check", async (event) => {
    const shouldClose = await callback();
    event.sender.send("before-quit-response", shouldClose);
  }),
  onLog: (callback) => ipcRenderer.on("log", (_, tabId, msg) => callback(tabId, msg)),
  onFileInUseError: (callback) => ipcRenderer.on("file-in-use-error", (_, tabId, fileName) => callback(tabId, fileName))
});
