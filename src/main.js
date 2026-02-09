import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, exec } from 'child_process';
import started from 'electron-squirrel-startup';
import { depsOk, instalarDeps, setBinPath, binPath } from '../core/dependencyManager.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindowGlobal = null;
const downloadProcesses = new Map(); // Map<tabId, process>
const downloadCancelledFlags = new Map(); // Map<tabId, boolean>
let tray = null;

// Configurar binPath assim que o app estiver pronto
app.whenReady().then(() => {
  // Em dev mode, usar o diretório do projeto, não o .vite/build
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const appPath = isDev ? process.cwd() : app.getAppPath();
  const binDirectory = path.join(appPath, 'bin');
  setBinPath(binDirectory);
  
  createWindow();

  // Verificar dependências automaticamente após criar a janela
  setTimeout(() => {
    verificarEInstalarDeps();
  }, 1000);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Função para verificar e instalar dependências automaticamente
async function verificarEInstalarDeps() {
  if (!depsOk()) {
    await instalarDepsComUI();
  }
}

async function instalarDepsComUI() {
  // Criar janela de confirmação customizada
  const confirmWindow = new BrowserWindow({
    width: 500,
    height: 300,
    modal: true,
    parent: mainWindowGlobal,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  confirmWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
          color: #fff;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        .header {
          padding: 20px 30px;
          border-bottom: 1px solid #3a3a3a;
          -webkit-app-region: drag;
          cursor: move;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .icon-warning {
          width: 24px;
          height: 24px;
          background: #ff9800;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          flex-shrink: 0;
        }
        h2 {
          font-size: 18px;
          font-weight: 600;
          background: linear-gradient(90deg, #0078d4, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .message {
          flex: 1;
          padding: 18px 30px;
          font-size: 14px;
          color: #e0e0e0;
          line-height: 1.6;
          overflow-y: auto;
        }
        .warning {
          color: #ff9800;
          font-size: 12px;
          margin-top: 15px;
          padding: 10px 12px;
          background: rgba(255, 152, 0, 0.1);
          border-left: 3px solid #ff9800;
          border-radius: 4px;
        }
        .buttons {
          display: flex;
          gap: 10px;
          padding: 12px 30px 18px 30px;
          border-top: 1px solid #3a3a3a;
          background: #252525;
          flex-shrink: 0;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-yes {
          background: linear-gradient(90deg, #0078d4, #0098ff);
          color: white;
        }
        .btn-yes:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 120, 212, 0.4);
        }
        .btn-no {
          background: #3a3a3a;
          color: #e0e0e0;
        }
        .btn-no:hover {
          background: #4a4a4a;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="icon-warning">!</div>
        <h2>Dependências não encontradas</h2>
      </div>
      <div class="message">
        <strong>yt-dlp</strong> e <strong>ffmpeg</strong> são necessários para o funcionamento do DLWave.<br><br>
        Deseja baixar e instalar agora? (~110 MB)
        <div class="warning">
          ! O app não funcionará sem essas dependências
        </div>
      </div>
      <div class="buttons">
        <button class="btn-no" onclick="respond(false)">Não</button>
        <button class="btn-yes" onclick="respond(true)">Sim, baixar agora</button>
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        function respond(confirm) {
          ipcRenderer.send('confirm-response', confirm);
        }
      </script>
    </body>
    </html>
  `)}`);

  const userConfirmed = await new Promise((resolve) => {
    ipcMain.once('confirm-response', (event, confirmed) => {
      confirmWindow.close();
      resolve(confirmed);
    });
  });

  if (userConfirmed) {
    // Criar janela de progresso
    const progressWindow = new BrowserWindow({
      width: 480,
      height: 240,
      modal: true,
      parent: mainWindowGlobal,
      resizable: false,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
            color: #fff;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }
          .header {
            padding: 18px 30px;
            border-bottom: 1px solid #3a3a3a;
            -webkit-app-region: drag;
            cursor: move;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }
          .icon-download {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
          }
          h2 {
            font-size: 16px;
            font-weight: 600;
            background: linear-gradient(90deg, #0078d4, #00d4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .content {
            flex: 1;
            padding: 22px 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .file-name {
            font-size: 14px;
            color: #00d4ff;
            font-weight: 600;
            margin-bottom: 8px;
            text-align: center;
          }
          .progress-container {
            background: #252525;
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            overflow: hidden;
            height: 8px;
            margin-bottom: 12px;
          }
          .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #0078d4, #0098ff);
            width: 0%;
            transition: width 0.3s ease;
          }
          .percentage {
            font-size: 24px;
            font-weight: 700;
            text-align: center;
            background: linear-gradient(90deg, #0078d4, #00d4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 1px;
          }
          .status {
            font-size: 12px;
            color: #999;
            text-align: center;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="icon-download">↓</div>
          <h2>Baixando dependências...</h2>
        </div>
        <div class="content">
          <div class="file-name" id="fileName">Preparando...</div>
          <div class="progress-container">
            <div class="progress-bar" id="progress"></div>
          </div>
          <div class="percentage" id="percentage">0%</div>
          <div class="status" id="status">Iniciando download...</div>
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          ipcRenderer.on('progresso', (_, data) => {
            const progressBar = document.getElementById('progress');
            const percentage = document.getElementById('percentage');
            const fileName = document.getElementById('fileName');
            const status = document.getElementById('status');
            
            if (data.percent) {
              progressBar.style.width = data.percent + '%';
              percentage.textContent = data.percent + '%';
            }
            
            if (data.etapa) {
              if (data.etapa.includes('yt-dlp')) {
                fileName.textContent = 'yt-dlp.exe';
                status.textContent = 'Baixando yt-dlp...';
              } else if (data.etapa.includes('ffmpeg')) {
                fileName.textContent = 'ffmpeg.zip';
                status.textContent = 'Baixando ffmpeg...';
              } else if (data.etapa.includes('Extraindo')) {
                fileName.textContent = 'ffmpeg.exe';
                status.textContent = 'Extraindo arquivo...';
              } else if (data.etapa.includes('Concluído')) {
                fileName.textContent = '✓ Concluído';
                status.textContent = 'Download finalizado com sucesso!';
              } else {
                status.textContent = data.etapa;
              }
            }
          });
          
          ipcRenderer.on('concluido', () => {
            setTimeout(() => window.close(), 1000);
          });
        </script>
      </body>
      </html>
    `)}`);

    // Usuário confirmou, iniciar download
    const resultado = await instalarDeps((progresso) => {
      if (progressWindow && !progressWindow.isDestroyed()) {
        progressWindow.webContents.send('progresso', progresso);
      }
    });
    
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.webContents.send('concluido');
      setTimeout(() => {
        if (!progressWindow.isDestroyed()) progressWindow.close();
      }, 1500);
    }
    
    return resultado;
  }

  return { sucesso: false, cancelado: true };
}

// Handler IPC (caso necessário no futuro)
ipcMain.handle("instalar-deps", instalarDepsComUI);

// Handler para seleção de pasta
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindowGlobal, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handler para selecionar arquivo de cookies
ipcMain.handle("select-cookies-file", async () => {
  const result = await dialog.showOpenDialog(mainWindowGlobal, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handler para abrir pasta
ipcMain.handle("open-folder", async (event, folderPath) => {
  if (folderPath) {
    await shell.openPath(folderPath);
  }
});

// Handler para solicitar nome da pasta de playlist
ipcMain.handle("request-playlist-folder-name", async (event, basePath) => {
  return new Promise((resolve) => {
    const inputWindow = new BrowserWindow({
      width: 500,
      height: 280,
      resizable: false,
      frame: false,
      modal: true,
      parent: mainWindowGlobal,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    inputWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
            color: #fff;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }
          .header {
            padding: 20px 30px;
            border-bottom: 1px solid #3a3a3a;
            -webkit-app-region: drag;
            cursor: move;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .icon { font-size: 24px; }
          h2 {
            font-size: 18px;
            font-weight: 600;
            background: linear-gradient(90deg, #0078d4, #00d4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .content {
            flex: 1;
            padding: 30px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .message {
            font-size: 14px;
            color: #999;
            margin-bottom: 15px;
          }
          input {
            width: 100%;
            padding: 14px 18px;
            background: #252525;
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            margin-bottom: 25px;
            transition: all 0.2s;
          }
          input:focus {
            outline: none;
            border-color: #0078d4;
            box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.1);
          }
          input::placeholder { color: #666; }
          .buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }
          button {
            padding: 12px 28px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-cancel {
            background: #3a3a3a;
            color: #e0e0e0;
          }
          .btn-cancel:hover { background: #4a4a4a; }
          .btn-confirm {
            background: linear-gradient(90deg, #0078d4, #0098ff);
            color: white;
          }
          .btn-confirm:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 120, 212, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="icon">📁</span>
          <h2>Nome da Pasta</h2>
        </div>
        <div class="content">
          <div class="message">Digite o nome da pasta para salvar a playlist:</div>
          <input type="text" id="folderName" placeholder="Deixe vazio para gerar automaticamente (playlist_0, playlist_1...)" autofocus />
          <div class="buttons">
            <button class="btn-cancel" onclick="cancel()">Cancelar</button>
            <button class="btn-confirm" onclick="confirm()">Confirmar</button>
          </div>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          const input = document.getElementById('folderName');
          
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
          });
          
          function cancel() {
            ipcRenderer.send('playlist-folder-response', null);
          }
          
          function confirm() {
            const name = input.value.trim();
            ipcRenderer.send('playlist-folder-response', name || '');
          }
        </script>
      </body>
      </html>
    `)}`);
    
    ipcMain.once('playlist-folder-response', (event, folderName) => {
      inputWindow.close();
      
      if (folderName === null) {
        resolve(null); // Usuário cancelou
      } else if (folderName === '') {
        // Gerar nome automático playlist_0, playlist_1, etc
        const fs = require('fs');
        let counter = 0;
        let finalName;
        
        do {
          finalName = `playlist_${counter}`;
          counter++;
        } while (fs.existsSync(path.join(basePath, finalName)));
        
        resolve(finalName);
      } else {
        resolve(folderName);
      }
    });
  });
});

// Handler para extrair informações de playlist
ipcMain.handle("get-playlist-info", async (event, url) => {
  return new Promise((resolve, reject) => {
    const ytdlpPath = path.join(binPath, 'yt-dlp.exe');
    
    const args = [
      '--flat-playlist',
      '--print', '%(id)s|||%(title)s',  // Retornar ID e título separados por |||
      '--playlist-end', '1000',
      url
    ];
    
    const ytdlp = spawn(ytdlpPath, args);
    const items = [];
    
    ytdlp.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
          const [id, title] = trimmed.split('|||');
          if (id && title) {
            items.push({
              id: id,
              title: title,
              url: `https://www.youtube.com/watch?v=${id}`
            });
          }
        }
      });
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0) {
        resolve(items);
      } else {
        reject(new Error(`Erro ao extrair playlist: código ${code}`));
      }
    });
    
    ytdlp.on('error', (error) => {
      reject(error);
    });
  });
});

// Handler para verificar Resolução (usado antes de downloads)
ipcMain.handle("check-resolution", async (event, url, resolution, allowLowerQuality) => {
  // Se allowLowerQuality estiver ativado ou for "best", não verificar
  if (allowLowerQuality || !resolution || resolution === 'best') {
    return true;
  }
  
  try {
    const ytdlpPath = path.join(binPath, 'yt-dlp.exe');
    const requestedHeight = parseInt(resolution);
    
    const shouldContinue = await new Promise((checkResolve) => {
      let formatString = `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/bestvideo+bestaudio/best`;
      const checkArgs = [
        '-f', formatString,
        '--print', '%(height)s',
        '--no-playlist',
        url
      ];
      
      const checkProcess = spawn(ytdlpPath, checkArgs);
      let detectedHeight = '';
      
      checkProcess.stdout.on('data', (data) => {
        detectedHeight += data.toString().trim();
      });
      
      checkProcess.on('close', async (code) => {
        if (code === 0 && detectedHeight) {
          const actualHeight = parseInt(detectedHeight.split('\\n')[0]);
          
          if (actualHeight < requestedHeight) {
            const resNames = {
              2160: '4K (2160p)',
              1440: '2K (1440p)',
              1080: 'Full HD (1080p)',
              720: 'HD (720p)',
              480: 'SD (480p)',
              360: '360p',
              240: '240p'
            };
            
            const requestedName = resNames[requestedHeight] || `${requestedHeight}p`;
            const actualName = resNames[actualHeight] || `${actualHeight}p`;
            
            const warningWindow = new BrowserWindow({
              width: 500,
              height: 280,
              resizable: false,
              frame: false,
              modal: true,
              parent: mainWindowGlobal,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
              }
            });

            warningWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset=\"UTF-8\">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden;
                  }
                  .header {
                    padding: 20px 30px;
                    border-bottom: 1px solid #3a3a3a;
                    -webkit-app-region: drag;
                    cursor: move;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  }
                  .icon { font-size: 24px; }
                  h2 {
                    font-size: 18px;
                    font-weight: 600;
                    background: linear-gradient(90deg, #0078d4, #00d4ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                  }
                  .content {
                    flex: 1;
                    padding: 30px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                  }
                  .message {
                    font-size: 15px;
                    color: #e0e0e0;
                    margin-bottom: 8px;
                    font-weight: 500;
                  }
                  .detail {
                    font-size: 13px;
                    color: #999;
                    line-height: 1.6;
                    margin-bottom: 30px;
                  }
                  .highlight {
                    color: #00d4ff;
                    font-weight: 600;
                  }
                  .buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                  }
                  button {
                    padding: 12px 28px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                  }
                  .btn-cancel {
                    background: #3a3a3a;
                    color: #e0e0e0;
                  }
                  .btn-cancel:hover { background: #4a4a4a; }
                  .btn-continue {
                    background: linear-gradient(90deg, #0078d4, #0098ff);
                    color: white;
                  }
                  .btn-continue:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0, 120, 212, 0.4);
                  }
                </style>
              </head>
              <body>
                <div class=\"header\">
                  <span class=\"icon\">\u2139\ufe0f</span>
                  <h2>Resolu\u00e7\u00e3o Ajustada</h2>
                </div>
                <div class=\"content\">
                  <div class=\"message\">Resolu\u00e7\u00e3o n\u00e3o dispon\u00edvel</div>
                  <div class=\"detail\">
                    A Resolu\u00e7\u00e3o <span class=\"highlight\">${requestedName}</span> n\u00e3o est\u00e1 dispon\u00edvel para este v\u00eddeo.<br><br>
                    Melhor qualidade dispon\u00edvel: <span class=\"highlight\">${actualName}</span>
                  </div>
                  <div class=\"buttons\">
                    <button class=\"btn-cancel\" onclick=\"cancel()\">Cancelar</button>
                    <button class=\"btn-continue\" onclick=\"continueDownload()\">Continuar Download</button>
                  </div>
                </div>
                <script>
                  const { ipcRenderer } = require('electron');
                  function cancel() {
                    ipcRenderer.send('resolution-warning-response', false);
                  }
                  function continueDownload() {
                    ipcRenderer.send('resolution-warning-response', true);
                  }
                </script>
              </body>
              </html>
            `)}`);
            
            const userChoice = await new Promise((resolve) => {
              ipcMain.once('resolution-warning-response', (event, shouldContinue) => {
                warningWindow.close();
                resolve(shouldContinue);
              });
            });
            
            checkResolve(userChoice);
          } else {
            checkResolve(true);
          }
        } else {
          checkResolve(true);
        }
      });
      
      checkProcess.on('error', () => checkResolve(true));
    });
    
    return shouldContinue;
  } catch (err) {
    return true;
  }
});

// Handler para iniciar download
ipcMain.handle("start-download", async (event, dados) => {
  const { tabId, url, type, format, resolution, downloadPath, playlistFolderName, allowLowerQuality, playlistItems, ignorePlaylist, cookiesFilePath } = dados;
  
  // Reset flag de cancelamento no início do download
  downloadCancelledFlags.set(tabId, false);
  
  try {
    // Verificar espaço em disco disponível
    const driveLetter = path.parse(downloadPath).root;
    const checkDiskSpace = () => {
      return new Promise((resolve) => {
        exec(`powershell -command "Get-PSDrive -Name ${driveLetter.replace(':', '').replace('\\', '')} | Select-Object -ExpandProperty Free"`, (error, stdout) => {
          if (error) {
            resolve(null); // Ignorar erro se não conseguir verificar
          } else {
            const freeBytes = parseInt(stdout.trim());
            resolve(freeBytes);
          }
        });
      });
    };
    
    const freeSpace = await checkDiskSpace();
    if (freeSpace !== null) {
      const freeGB = (freeSpace / 1024 / 1024 / 1024).toFixed(2);
      const minRequiredBytes = 500 * 1024 * 1024; // 500 MB mínimo
      
      if (freeSpace < minRequiredBytes) {
        const errorMsg = `⚠️ Espaço em disco insuficiente! Disponível: ${freeGB} GB. Recomendado: pelo menos 0.5 GB livre.`;
        if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
          mainWindowGlobal.webContents.send('log', tabId, errorMsg);
        }
        throw new Error('Espaço em disco insuficiente');
      } else {
        if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
          mainWindowGlobal.webContents.send('log', tabId, `ℹ️ Espaço disponível: ${freeGB} GB`);
        }
      }
    }
    
    // Informar se cookies estão sendo usados
    if (cookiesFilePath && cookiesFilePath.trim() !== '') {
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, `🍪 Usando arquivo de cookies para autenticação`);
      }
    }
    
    // Determinar o caminho final (com pasta da playlist se aplicável)
    let finalDownloadPath = downloadPath;
    if (playlistFolderName) {
      finalDownloadPath = path.join(downloadPath, playlistFolderName);
    }
    
    // Criar pasta se for playlist
    if (dados.isPlaylist) {
      const fs = require('fs');
      if (!fs.existsSync(finalDownloadPath)) {
        fs.mkdirSync(finalDownloadPath, { recursive: true });
      }
    }
    
    // Se for playlist grande (>200 itens), dividir em lotes
    const isLargePlaylist = dados.isPlaylist && playlistItems && playlistItems.length > 200;
    
    if (isLargePlaylist) {
      const totalItems = playlistItems.length;
      const chunkSize = 200;
      const chunks = Math.ceil(totalItems / chunkSize);
      
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, `📦 Playlist grande detectada: ${totalItems} itens`);
        mainWindowGlobal.webContents.send('log', tabId, `🔄 Dividindo em ${chunks} lotes de até ${chunkSize} itens cada`);
      }
      
      // Processar cada lote
      for (let i = 0; i < chunks; i++) {
        // Verificar se o download foi cancelado antes de processar próximo chunk
        if (downloadCancelledFlags.get(tabId)) {
          throw new Error('Download cancelado pelo usuário');
        }
        
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, totalItems);
        
        if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
          mainWindowGlobal.webContents.send('log', tabId, `\n📥 Lote ${i + 1}/${chunks}: baixando itens ${start} a ${end}`);
        }
        
        try {
          await downloadChunk(tabId, dados, finalDownloadPath, start, end);
        } catch (error) {
          // Se houve erro, reportar mas continuar com próximo lote se usuário não cancelou
          if (downloadCancelledFlags.get(tabId)) {
            throw error; // Se foi cancelamento, parar tudo
          }
          if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
            mainWindowGlobal.webContents.send('log', tabId, `⚠️ Erro no lote ${i + 1}: ${error.message}`);
            mainWindowGlobal.webContents.send('log', tabId, `➡️ Continuando com próximo lote...`);
          }
        }
      }
      
      return { sucesso: true, mensagem: `Download concluído! ${totalItems} itens processados em ${chunks} lotes` };
    } else {
      // Playlist pequena ou vídeo único - download normal
      return downloadChunk(tabId, dados, finalDownloadPath);
    }
  } catch (error) {
    // Resetar flag de cancelamento quando houver erro
    if (downloadCancelledFlags.get(tabId)) {
      downloadCancelledFlags.set(tabId, false);
    }
    throw error;
  }
});

// Função auxiliar para baixar um chunk (lote) da playlist
async function downloadChunk(tabId, dados, finalDownloadPath, playlistStart = null, playlistEnd = null) {
  const { url, type, format, resolution, ignorePlaylist, cookiesFilePath } = dados;
  
  return new Promise((resolve, reject) => {
    const ytdlpPath = path.join(binPath, 'yt-dlp.exe');
    const ffmpegPath = path.join(binPath, 'ffmpeg.exe');
    
    // Configurar argumentos do yt-dlp
    const args = [];
    
    if (type === 'audio') {
      // Download de áudio
      args.push('-x'); // Extrair áudio
      args.push('--audio-format', format);
      args.push('--audio-quality', '0'); // Melhor qualidade
    } else {
      // Download de vídeo
      let formatString;
      if (resolution && resolution !== 'best') {
        // Limitar pela Resolução escolhida com múltiplos fallbacks
        // 1. Tenta melhor vídeo até a Resolução + melhor áudio
        // 2. Se não disponível, tenta melhor formato combinado até a Resolução
        // 3. Se ainda não disponível, pega o melhor disponível sem limites
        formatString = `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/bestvideo+bestaudio/best`;
      } else {
        // Melhor qualidade disponível
        formatString = 'bestvideo+bestaudio/best';
      }
      args.push('-f', formatString);
      args.push('--merge-output-format', format);
    }
    
    // Configurações gerais
    args.push('--ffmpeg-location', ffmpegPath);
    args.push('-o', path.join(finalDownloadPath, '%(title)s.%(ext)s'));
    
    // Se marcou "Ignorar Playlist", adicionar flag
    if (ignorePlaylist) {
      args.push('--no-playlist');
    } else {
      // Se for lote específico, adicionar range
      if (playlistStart !== null && playlistEnd !== null) {
        args.push('--playlist-start', playlistStart.toString());
        args.push('--playlist-end', playlistEnd.toString());
      } else {
        args.push('--playlist-end', '1000'); // Limitar a 1000 itens
      }
    }
    
    // Se houver arquivo de cookies, adicionar
    if (cookiesFilePath && cookiesFilePath.trim() !== '') {
      args.push('--cookies', cookiesFilePath);
    }
    
    args.push('--progress'); // Mostrar progresso
    args.push('--newline'); // Nova linha para cada atualização de progresso
    args.push(url);
    
    const ytdlp = spawn(ytdlpPath, args);
    downloadProcesses.set(tabId, ytdlp); // Armazenar referência para cancelamento
    
    // Capturar saída
    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, output.trim());
      }
    });
    
    ytdlp.stderr.on('data', (data) => {
      const error = data.toString();
      
      // Verificar se é erro de arquivo em uso
      const fileInUseErrors = [
        'being used by another',
        'file is in use',
        'permission denied',
        'cannot create',
        'access denied',
        'cannot access the file',
        'the process cannot access',
        'used by another application'
      ];
      
      const isFileInUse = fileInUseErrors.some(msg => error.toLowerCase().includes(msg));
      
      if (isFileInUse && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        // Tentar extrair nome do arquivo do erro
        const fileMatch = error.match(/['"]([^'"]+\.(mp4|mp3|mkv|webm|m4a|opus|flac|wav|aac|avi|mov|flv|ogg))['"]?/i);
        const fileName = fileMatch ? fileMatch[1] : 'arquivo de destino';
        
        mainWindowGlobal.webContents.send('file-in-use-error', tabId, fileName);
        return; // Não mostrar erro bruto
      }
      
      // Verificar se é erro de espaço em disco
      const diskSpaceErrors = [
        'no space left',
        'disk full',
        'insufficient disk space',
        'not enough space',
        'out of disk space'
      ];
      
      const isDiskSpaceError = diskSpaceErrors.some(msg => error.toLowerCase().includes(msg));
      
      if (isDiskSpaceError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '💾 ERRO: Espaço em disco insuficiente! Libere espaço e tente novamente.');
      }
      
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, error.trim());
      }
    });
    
    ytdlp.on('close', (code) => {
      downloadProcesses.delete(tabId); // Limpar referência
      
      // Se foi cancelado manualmente
      if (downloadCancelledFlags.get(tabId)) {
        // NÃO resetar a flag aqui - será resetada no próximo download ou deve persistir para parar todos os chunks
        reject(new Error('Download cancelado pelo usuário'));
        return;
      }
      
      if (code === 0) {
        resolve({ sucesso: true, mensagem: 'Download concluído com sucesso!' });
      } else {
        reject(new Error(`yt-dlp encerrou com código ${code}`));
      }
    });
    
    ytdlp.on('error', (error) => {
      downloadProcesses.delete(tabId);
      // NÃO resetar downloadCancelled aqui - pode ser um erro durante cancelamento
      reject(new Error(`Erro ao executar yt-dlp: ${error.message}`));
    });
  });
}

// Handler para cancelar download
ipcMain.handle("cancel-download", async (event, tabId) => {
  const downloadProcess = downloadProcesses.get(tabId);
  if (downloadProcess) {
    try {
      downloadCancelledFlags.set(tabId, true);
      
      // No Windows, precisamos matar o processo de forma mais agressiva
      if (process.platform === 'win32') {
        // Usar taskkill para formar o encerramento no Windows
        exec(`taskkill /pid ${downloadProcess.pid} /T /F`, (error) => {
          if (error) {
            console.error('Erro ao matar processo:', error);
          }
        });
      } else {
        // Unix/Linux/Mac
        downloadProcess.kill('SIGTERM');
      }
      
      downloadProcesses.delete(tabId);
      
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, 'Download cancelado!');
      }
      
      return { sucesso: true, mensagem: 'Download cancelado' };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro ao cancelar: ${error.message}` };
    }
  }
  return { sucesso: false, mensagem: 'Nenhum download em andamento' };
});

// Handler para salvar preferencias
ipcMain.handle("save-preferences", async (event, prefs) => {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = isDev ? process.cwd() : app.getAppPath();
    const prefsPath = path.join(appPath, 'preferences.json');
    
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8');
    return { sucesso: true };
  } catch (error) {
    console.error('Erro ao salvar preferências:', error);
    return { sucesso: false, erro: error.message };
  }
});

// Handler para carregar preferências
ipcMain.handle("load-preferences", async () => {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = isDev ? process.cwd() : app.getAppPath();
    const prefsPath = path.join(appPath, 'preferences.json');
    
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Erro ao carregar preferencias:', error);
    return null;
  }
});


// Handler para obter caminho da pasta bin
ipcMain.handle("get-bin-path", async () => {
  return binPath;
});

// Handler para abrir pasta bin
ipcMain.handle("open-bin-folder", async () => {
  try {
    if (fs.existsSync(binPath)) {
      await shell.openPath(binPath);
      return { sucesso: true };
    } else {
      return { sucesso: false, erro: 'Pasta não encontrada' };
    }
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
});

// Handler para verificar se dependências estão instaladas
ipcMain.handle("check-dependencies", async () => {
  return depsOk();
});

// Handler para forçar instalação de dependências
ipcMain.handle("install-dependencies", async () => {
  await instalarDepsComUI();
  return depsOk();
});

// Função para criar o tray icon - VERSÃO CORRIGIDA
function createTray() {
  // Carregar o ícone do arquivo assets/tray-icon.png
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const trayIconPath = isDev 
    ? path.join(process.cwd(), 'assets', 'tray-icon.png')
    : path.join(path.dirname(app.getPath('exe')), 'resources', 'assets', 'tray-icon.png');
  
  let icon;
  if (fs.existsSync(trayIconPath)) {
    console.log('Carregando icone do tray de:', trayIconPath);
    icon = nativeImage.createFromPath(trayIconPath);
    // Redimensionar para 16x16 (tamanho esperado pela bandeja do Windows)
    icon = icon.resize({ width: 16, height: 16 });
  } else {
    console.log('⚠ Arquivo tray-icon.png não encontrado em:', trayIconPath);
    console.log('  Usando ícone fallback base64');
    // Fallback: icone base64 se não encontrar o arquivo
    const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADlSURBVDiNpdMxSwJhHMfxz+NxehYEDdIWBS0NDU3R0BAN0RAN0RAN0dAQLdHQ0BAt0dAQLdEQRUND0NAQDdHQ0BAN0RAN0RAN0dIi3RBFnedc/ODh/8A/+PJ7nnsuIiICYA/YBzaAGWAUGADagC7QAVpAA3gAngADuAeugEvgDDgBjoEj4BA4AA6AfeA3sAfsAr+AXWAHiAE7wDYQBbaAKLAJbABrwCqwAiwDy8ASsAgsAAvAPDAPzAFzwCwwA0wD08AUMA1MApPABDAOjAFjwCgwAowAw8AQMAiEgQFgAOgH+oA+oA/oA/qAPqAvcA/4A1p8qQlnEvjAAAAAElFTkSuQmCC';
    icon = nativeImage.createFromDataURL(iconData);
  }
  
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '⌂ Mostrar DLWave',
      click: () => {
        if (mainWindowGlobal) {
          mainWindowGlobal.setSkipTaskbar(false); // Voltar para taskbar
          mainWindowGlobal.show();
          mainWindowGlobal.focus();
          
          // Remover da bandeja quando restaurar
          if (tray && !tray.isDestroyed()) {
            tray.destroy();
            tray = null;
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('DLWave');
  tray.setContextMenu(contextMenu);
  
  // Duplo clique ou clique simples para restaurar
  tray.on('click', () => {
    if (mainWindowGlobal) {
      if (mainWindowGlobal.isVisible()) {
        mainWindowGlobal.hide();
        mainWindowGlobal.setSkipTaskbar(true);
      } else {
        mainWindowGlobal.setSkipTaskbar(false); // Voltar para taskbar
        mainWindowGlobal.show();
        mainWindowGlobal.focus();
        
        // Remover da bandeja quando restaurar
        if (tray && !tray.isDestroyed()) {
          tray.destroy();
          tray = null;
        }
      }
    }
  });
  
  tray.on('double-click', () => {
    if (mainWindowGlobal) {
      mainWindowGlobal.setSkipTaskbar(false); // Voltar para taskbar
      mainWindowGlobal.show();
      mainWindowGlobal.focus();
      
      // Remover da bandeja quando restaurar
      if (tray && !tray.isDestroyed()) {
        tray.destroy();
        tray = null;
      }
    }
  });
}


const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'), // Ícone da janela
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindowGlobal = mainWindow;

  // Remover menu nativo do Electron
  Menu.setApplicationMenu(null);

  // Listener para verificar downloads ativos ao fechar
  mainWindow.on('close', async (event) => {
    event.preventDefault(); // Prevenir fechamento imediato
    
    // Enviar mensagem para renderer verificar downloads ativos e mostrar diálogo
    mainWindow.webContents.send('before-quit-check');
    
    // Aguardar resposta do renderer (true = pode fechar, false = cancelar)
    ipcMain.once('before-quit-response', async (_, shouldClose) => {
      if (shouldClose) {
        // Usuário confirmou - cancelar todos os downloads e fechar
        for (const [tabId, downloadProc] of downloadProcesses) {
          try {
            if (process.platform === 'win32') {
              exec(`taskkill /pid ${downloadProc.pid} /T /F`);
            } else {
              downloadProc.kill('SIGTERM');
            }
          } catch (err) {
            console.error('Erro ao cancelar download:', err);
          }
        }
        downloadProcesses.clear();
        
        // Remover listener para evitar loop
        mainWindow.removeAllListeners('close');
        mainWindow.close();
      }
      // Se shouldClose === false, não faz nada (cancelou o fechamento)
    });
  });

  // Listener para minimizar
  mainWindow.on('minimize', async (event) => {
    try {
      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
      const appPath = isDev ? process.cwd() : app.getAppPath();
      const prefsPath = path.join(appPath, 'preferences.json');
      
      if (fs.existsSync(prefsPath)) {
        const data = fs.readFileSync(prefsPath, 'utf-8');
        const prefs = JSON.parse(data);
        
        if (prefs && prefs.minimizeToTray) {
          event.preventDefault();
          mainWindow.hide();
          mainWindow.setSkipTaskbar(true); // Remover da taskbar
          
          // Criar tray icon se não existir
          if (!tray || tray.isDestroyed()) {
            createTray();
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar preferência de minimizar:', error);
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

