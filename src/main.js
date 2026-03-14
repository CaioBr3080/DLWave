import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, exec } from 'child_process';
import started from 'electron-squirrel-startup';
import { depsOk, instalarDeps, setBinPath, binPath, verificarDependencias } from '../core/dependencyManager.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Impedir múltiplas instâncias do app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Já existe uma instância rodando, sair
  app.quit();
} else {
  // Quando alguém tentar abrir uma segunda instância, focar na janela existente
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindowGlobal) {
      if (mainWindowGlobal.isMinimized()) mainWindowGlobal.restore();
      mainWindowGlobal.focus();
      mainWindowGlobal.show();
    }
  });
}

let mainWindowGlobal = null;
const downloadProcesses = new Map(); // Map<tabId, process>
const downloadCancelledFlags = new Map(); // Map<tabId, boolean>

const isWindows = process.platform === 'win32';
const isLinux   = process.platform === 'linux';
const ffmpegBin = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const ytdlpBin  = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
let tray = null;
let ytdlpUpdatePending = false; // Flag: yt-dlp precisa de atualização

// Configurar binPath assim que o app estiver pronto
app.whenReady().then(() => {
  // Em dev mode, usar o diretório do projeto
  // Em produção, usar userData (AppData\Local\dlwave\bin)
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const appPath = isDev ? process.cwd() : app.getPath('userData');
  const binDirectory = path.join(appPath, 'bin');
  setBinPath(binDirectory);
  
  createWindow();

  // Verificar silenciosamente se yt-dlp precisa de atualização
  setTimeout(() => {
    checkYtdlpUpdate();
  }, 1000);

  // Verificar se é primeira execução e mostrar EULA
  setTimeout(async () => {
    const eulaAccepted = await checkAndShowEULA();
    if (eulaAccepted) {
      // Só verificar dependências se EULA foi aceito
      setTimeout(() => {
        verificarEInstalarDeps();
      }, 500);
    }
  }, 500);

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
  console.log('🔍 Verificando dependências...');
  const deps = await verificarDependencias();
  console.log('📊 Status das dependências:', {
    ffmpeg: deps.ffmpeg,
    ytdlp: deps.ytdlp,
    ytdlpGlobal: deps.ytdlpGlobal,
    ytdlpLocal: deps.ytdlpLocal,
    todasOk: deps.todasOk
  });
  
  if (!deps.todasOk) {
    console.log('⚠️ Dependências faltando! Abrindo UI de instalação...');
    await instalarDepsComUI();
  } else {
    console.log('✅ Todas as dependências estão OK!');
  }
}

// Verificação silenciosa de atualização do yt-dlp
function checkYtdlpUpdate() {
  exec('yt-dlp --version', (err, stdout) => {
    if (err) return;
    const localVersion = stdout.trim();
    console.log('📌 yt-dlp versão local:', localVersion);
    
    // Consultar versão mais recente via GitHub API
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/yt-dlp/yt-dlp/releases/latest',
      headers: { 'User-Agent': 'DLWave' }
    };
    
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const latestVersion = release.tag_name;
          console.log('📌 yt-dlp versão mais recente:', latestVersion);
          
          if (localVersion === latestVersion) {
            console.log('✅ yt-dlp está atualizado');
            ytdlpUpdatePending = false;
          } else {
            console.log('🆙 yt-dlp desatualizado, solicitando atualização...');
            ytdlpUpdatePending = true;
            showYtdlpUpdatePrompt();
          }
        } catch (parseErr) {
          console.log('⚠️ Erro ao verificar versão do yt-dlp:', parseErr.message);
        }
      });
    }).on('error', (reqErr) => {
      console.log('⚠️ Sem internet para verificar atualização do yt-dlp:', reqErr.message);
    });
  });
}

// Popup pedindo permissão para atualizar o yt-dlp
// Retorna Promise<boolean> - true se atualizou, false se recusou
function showYtdlpUpdatePrompt() {
  return new Promise((resolve) => {
    if (!mainWindowGlobal || mainWindowGlobal.isDestroyed()) {
      resolve(false);
      return;
    }
  const updateWindow = new BrowserWindow({
    width: 480,
    height: 260,
    resizable: false,
    frame: false,
    modal: true,
    parent: mainWindowGlobal,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  updateWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
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
          padding: 18px 25px;
          border-bottom: 1px solid #3a3a3a;
          -webkit-app-region: drag;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .icon { font-size: 22px; }
        h2 {
          font-size: 16px;
          font-weight: 600;
          background: linear-gradient(90deg, #0078d4, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .content {
          flex: 1;
          padding: 25px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .message {
          font-size: 14px;
          color: #e0e0e0;
          line-height: 1.6;
          margin-bottom: 25px;
        }
        .highlight { color: #00d4ff; font-weight: 600; }
        .buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        button {
          padding: 10px 24px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-no { background: #3a3a3a; color: #e0e0e0; }
        .btn-no:hover { background: #4a4a4a; }
        .btn-yes {
          background: linear-gradient(90deg, #0078d4, #0098ff);
          color: white;
        }
        .btn-yes:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0, 120, 212, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="icon">🔄</span>
        <h2>Atualização Disponível</h2>
      </div>
      <div class="content">
        <div class="message">
          O <span class="highlight">yt-dlp</span> está desatualizado. É necessário atualizar para garantir o funcionamento correto dos downloads.<br><br>
          Deseja atualizar agora?
        </div>
        <div class="buttons">
          <button class="btn-no" onclick="respond(false)">Depois</button>
          <button class="btn-yes" onclick="respond(true)">Atualizar</button>
        </div>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        function respond(accept) {
          ipcRenderer.send('ytdlp-update-response', accept);
        }
      </script>
    </body>
    </html>
  `)}`);

  let resolved = false;
  
  ipcMain.once('ytdlp-update-response', (event, accepted) => {
    if (resolved) return;
    resolved = true;
    updateWindow.close();
    if (accepted) {
      exec('yt-dlp -U', (err, stdout) => {
        if (!err) {
          console.log('🆙 yt-dlp atualizado com sucesso:', stdout.trim());
          ytdlpUpdatePending = false;
          resolve(true);
        } else {
          console.log('⚠️ Falha ao atualizar yt-dlp:', err.message);
          resolve(false);
        }
      });
    } else {
      resolve(false);
    }
  });

  updateWindow.on('closed', () => {
    if (!resolved) {
      resolved = true;
      resolve(false);
    }
  });
  });
}

// Função para verificar primeira execução e mostrar EULA
async function checkAndShowEULA() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const userDataPath = isDev ? process.cwd() : app.getPath('userData');
  const eulaFlagPath = path.join(userDataPath, '.eula-accepted');
  
  // Se já aceitou o EULA, retornar true
  if (fs.existsSync(eulaFlagPath)) {
    return true;
  }
  
  // Ler conteúdo do EULA
  const eulaPath = isDev ? path.join(process.cwd(), 'EULA.txt') : path.join(process.resourcesPath, 'EULA.txt');
  let eulaText = 'EULA not found';
  
  try {
    if (fs.existsSync(eulaPath)) {
      eulaText = fs.readFileSync(eulaPath, 'utf-8');
    }
  } catch (error) {
    console.error('Erro ao ler EULA:', error);
  }
  
  // Criar janela do EULA
  return new Promise((resolve) => {
    const eulaWindow = new BrowserWindow({
      width: 700,
      height: 600,
      resizable: false,
      frame: false,
      backgroundColor: '#1e1e1e',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      parent: mainWindowGlobal,
      modal: true,
    });

    let accepted = false;

    eulaWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
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
          }
          .header {
            padding: 20px 30px;
            border-bottom: 1px solid #3a3a3a;
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            font-size: 32px;
          }
          .title-area h2 {
            font-size: 18px;
            margin-bottom: 3px;
          }
          .title-area p {
            font-size: 12px;
            color: #888;
          }
          .content {
            flex: 1;
            padding: 20px 30px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          .eula-text {
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.6;
            white-space: pre-wrap;
            height: 350px;
            overflow-y: auto;
            margin-bottom: 20px;
          }
          .eula-text::-webkit-scrollbar {
            width: 8px;
          }
          .eula-text::-webkit-scrollbar-track {
            background: #1e1e1e;
            border-radius: 4px;
          }
          .eula-text::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 4px;
          }
          .eula-text::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
          .notice {
            background: #2a2a2a;
            border-left: 3px solid #4caf50;
            padding: 15px;
            border-radius: 4px;
            font-size: 13px;
            margin-bottom: 20px;
          }
          .notice strong {
            color: #4caf50;
          }
          .buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 20px 30px;
            border-top: 1px solid #3a3a3a;
          }
          button {
            padding: 12px 30px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
          }
          .btn-decline {
            background: #3a3a3a;
            color: #fff;
          }
          .btn-decline:hover {
            background: #4a4a4a;
          }
          .btn-accept {
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: #fff;
          }
          .btn-accept:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🌊</div>
          <div class="title-area">
            <h2>DLWave - End User License Agreement</h2>
            <p>Please read and accept to continue</p>
          </div>
        </div>
        <div class="content">
          <div class="notice">
            <strong>Open Source Software:</strong> DLWave is free and open source (MIT License). By using this software, you agree to comply with YouTube's Terms of Service and respect copyright laws.
          </div>
          <div class="eula-text">${eulaText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
        <div class="buttons">
          <button class="btn-decline" onclick="decline()">I Decline</button>
          <button class="btn-accept" onclick="accept()">I Accept</button>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          
          function accept() {
            ipcRenderer.send('eula-response', true);
          }
          
          function decline() {
            ipcRenderer.send('eula-response', false);
          }
        </script>
      </body>
      </html>
    `)}`);

    // Listener para resposta do EULA
    ipcMain.once('eula-response', (event, userAccepted) => {
      accepted = userAccepted;
      eulaWindow.close();
    });

    eulaWindow.on('close', () => {
      if (!accepted) {
        // Usuário recusou ou fechou - sair do app
        app.quit();
        resolve(false);
      } else {
        // Usuário aceitou
        try {
          fs.writeFileSync(eulaFlagPath, new Date().toISOString(), 'utf-8');
        } catch (error) {
          console.error('Erro ao salvar flag EULA:', error);
        }
        resolve(true);
      }
    });
  });
}

// Função para mostrar termos do yt-dlp e pedir concordância
async function mostrarTermosYtdlp() {
  const termsWindow = new BrowserWindow({
    width: 650,
    height: 550,
    modal: true,
    parent: mainWindowGlobal,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  termsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
          background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
          color: #fff;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        .header {
          padding: 18px 25px;
          border-bottom: 1px solid #3a3a3a;
          -webkit-app-region: drag;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .icon { font-size: 24px; }
        h2 {
          font-size: 17px;
          font-weight: 600;
          background: linear-gradient(90deg, #0078d4, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .content {
          flex: 1;
          padding: 20px 25px;
          overflow-y: auto;
        }
        .terms-box {
          background: #252525;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          padding: 18px;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.7;
          color: #d0d0d0;
          max-height: 320px;
          overflow-y: auto;
        }
        .terms-box h3 {
          color: #00d4ff;
          font-size: 15px;
          margin-bottom: 12px;
        }
        .terms-box p {
          margin-bottom: 10px;
        }
        .terms-box ul {
          margin-left: 20px;
          margin-bottom: 10px;
        }
        .warning {
          padding: 12px;
          background: rgba(255, 152, 0, 0.15);
          border-left: 3px solid #ff9800;
          border-radius: 4px;
          font-size: 12px;
          color: #ffb74d;
        }
        .buttons {
          display: flex;
          gap: 12px;
          padding: 18px 25px;
          border-top: 1px solid #3a3a3a;
          background: #252525;
        }
        button {
          flex: 1;
          padding: 13px;
          border: none;
          border-radius: 7px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-accept {
          background: linear-gradient(90deg, #0078d4, #0098ff);
          color: white;
        }
        .btn-accept:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 120, 212, 0.4);
        }
        .btn-decline {
          background: #3a3a3a;
          color: #e0e0e0;
        }
        .btn-decline:hover { background: #4a4a4a; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1e1e1e; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="icon">📜</div>
        <h2>Termos de Uso do yt-dlp</h2>
      </div>
      <div class="content">
        <div class="terms-box">
          <h3>LICENÇA E TERMOS DE USO</h3>
          <p><strong>yt-dlp</strong> é um software de código aberto licenciado sob <strong>The Unlicense</strong>.</p>
          
          <h3>Permissões:</h3>
          <ul>
            <li>Uso comercial e privado</li>
            <li>Modificação e distribuição</li>
            <li>Sem restrições de patente</li>
          </ul>

          <h3>Responsabilidade:</h3>
          <p>O software é fornecido "como está", sem garantias de qualquer tipo. Os autores não se responsabilizam por qualquer dano decorrente do uso do software.</p>

          <h3>Uso Responsável:</h3>
          <p>⚠️ <strong>IMPORTANTE:</strong> É de sua responsabilidade usar o yt-dlp de acordo com:</p>
          <ul>
            <li>Termos de serviço das plataformas (YouTube, etc.)</li>
            <li>Leis de direitos autorais do seu país</li>
            <li>Respeito aos criadores de conteúdo</li>
          </ul>

          <p style="margin-top: 15px; font-size: 12px; color: #888;">
            Para mais informações: <br>
            <a href="#" style="color: #0078d4;">https://github.com/yt-dlp/yt-dlp</a>
          </p>
        </div>
        
        <div class="warning">
          ⚠️ Ao aceitar, você confirma que leu e concorda com os termos acima e usará o software de forma responsável e legal.
        </div>
      </div>
      <div class="buttons">
        <button class="btn-decline" onclick="respond(false)">Recusar</button>
        <button class="btn-accept" onclick="respond(true)">Aceitar e Instalar</button>
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        function respond(accepted) {
          ipcRenderer.send('ytdlp-terms-response', accepted);
        }
      </script>
    </body>
    </html>
  `)}`)

  return new Promise((resolve) => {
    ipcMain.once('ytdlp-terms-response', (event, accepted) => {
      termsWindow.close();
      resolve(accepted);
    });
  });
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
        <strong>yt-dlp:</strong> Será instalado globalmente via Windows Package Manager (winget)<br>
        <strong>ffmpeg:</strong> Será baixado localmente (~110 MB)<br><br>
        Deseja instalar agora?
        <div class="warning">
          ! O app não funcionará sem essas dependências
        </div>
      </div>
      <div class="buttons">
        <button class="btn-no" onclick="respond(false)">Não</button>
        <button class="btn-yes" onclick="respond(true)">Sim, instalar agora</button>
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
              // Detectar tipo de instalação
              if (data.etapa.includes('winget')) {
                fileName.textContent = '🌐 yt-dlp (Global)';
                status.textContent = data.etapa;
              } else if (data.etapa.includes('yt-dlp')) {
                fileName.textContent = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
                status.textContent = 'Baixando yt-dlp...';
              } else if (data.etapa.includes('ffmpeg')) {
                fileName.textContent = process.platform === 'win32' ? 'ffmpeg.zip' : 'ffmpeg.tar.xz';
                status.textContent = 'Baixando ffmpeg...';
              } else if (data.etapa.includes('Extraindo')) {
                fileName.textContent = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
                status.textContent = 'Extraindo arquivo...';
              } else if (data.etapa.includes('Concluído') || data.etapa.includes('✅')) {
                fileName.textContent = '✓ Concluído';
                status.textContent = data.info || 'Download finalizado com sucesso!';
              } else {
                status.textContent = data.etapa;
              }
            }
            
            // Mostrar informação adicional se disponível
            if (data.info && !data.etapa.includes('Concluído')) {
              const infoElement = document.createElement('div');
              infoElement.style.fontSize = '11px';
              infoElement.style.color = '#888';
              infoElement.style.marginTop = '5px';
              infoElement.textContent = data.info;
              
              // Substituir status existente
              status.textContent = data.etapa;
              if (!status.querySelector('.info-extra')) {
                const infoExtra = document.createElement('div');
                infoExtra.className = 'info-extra';
                infoExtra.style.fontSize = '11px';
                infoExtra.style.color = '#888';
                infoExtra.style.marginTop = '5px';
                status.parentElement.appendChild(infoExtra);
              }
              const infoExtra = status.parentElement.querySelector('.info-extra');
              if (infoExtra) infoExtra.textContent = data.info;
            }
          });
          
          ipcRenderer.on('concluido', () => {
            setTimeout(() => window.close(), 2000);
          });
        </script>
      </body>
      </html>
    `)}`);

    // Usuário confirmou, iniciar download
    const resultado = await instalarDeps(async (progresso) => {
      // Verificar se é uma solicitação de aceitação de termos
      if (progresso.requestTermsAcceptance && progresso.onTermsResponse) {
        console.log('📜 Solicitação de aceitação de termos detectada');
        const termsAccepted = await mostrarTermosYtdlp();
        console.log(`📜 Termos ${termsAccepted ? 'ACEITOS' : 'RECUSADOS'} pelo usuário`);
        progresso.onTermsResponse(termsAccepted);
        return;
      }
      
      // Progresso normal
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
    
    // Se falhou com instruções, mostrar janela de erro detalhada
    if (!resultado.sucesso && resultado.instrucoes) {
      const errorWindow = new BrowserWindow({
        width: 650,
        height: 550,
        modal: true,
        parent: mainWindowGlobal,
        resizable: false,
        frame: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      errorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
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
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .icon-error {
              font-size: 32px;
            }
            .title-area h2 {
              font-size: 20px;
              margin-bottom: 5px;
              color: #ff6b6b;
            }
            .title-area p {
              font-size: 13px;
              color: #888;
            }
            .content {
              flex: 1;
              padding: 25px 35px;
              overflow-y: auto;
            }
            .error-message {
              background: #2a2a2a;
              border-left: 4px solid #ff6b6b;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              line-height: 1.8;
              white-space: pre-wrap;
              font-size: 14px;
              font-family: 'Segoe UI', system-ui, sans-serif;
            }
            .error-message strong {
              color: #ff9999;
              display: block;
              margin-bottom: 15px;
              font-size: 16px;
            }
            .buttons {
              display: flex;
              gap: 12px;
              padding: 20px 35px;
              border-top: 1px solid #3a3a3a;
              background: #252525;
            }
            button {
              flex: 1;
              padding: 14px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }
            .btn-close {
              background: linear-gradient(90deg, #dc3545, #c82333);
              color: white;
            }
            .btn-close:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
            }
            ::-webkit-scrollbar {
              width: 8px;
            }
            ::-webkit-scrollbar-track {
              background: #1e1e1e;
            }
            ::-webkit-scrollbar-thumb {
              background: #444;
              border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #555;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="icon-error">⚠️</div>
            <div class="title-area">
              <h2>Requisitos Não Atendidos</h2>
              <p>Dependências obrigatórias não encontradas</p>
            </div>
          </div>
          <div class="content">
            <div class="error-message">${resultado.instrucoes.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="buttons">
            <button class="btn-close" onclick="window.close()">Fechar</button>
          </div>
        </body>
        </html>
      `)}`);
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

// Handler para selecionar executável do navegador
ipcMain.handle("select-browser-file", async () => {
  const result = await dialog.showOpenDialog(mainWindowGlobal, {
    properties: ['openFile'],
    filters: [
      ...(isWindows ? [{ name: 'Executáveis', extensions: ['exe'] }] : []),
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ],
    title: 'Selecione o executável do navegador'
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

// Função helper para carregar preferências localmente
function loadPreferences() {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = isDev ? process.cwd() : app.getPath('userData');
    const prefsPath = path.join(appPath, 'preferences.json');
    
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Erro ao carregar preferências:', error);
    return null;
  }
}

// Função helper para detectar navegador para cookies
function detectBrowser(userPreference = '') {
  // Se usuário forneceu um caminho de arquivo, extrair o nome do navegador
  if (userPreference && (userPreference.includes('\\') || userPreference.includes('/') || userPreference.endsWith('.exe'))) {
    if (fs.existsSync(userPreference)) {
      // Extrair nome do arquivo do caminho (sem extensão)
      const fileName = path.basename(userPreference, '.exe').toLowerCase();
      
      const browserMap = {
        'brave': 'brave',
        'chrome': 'chrome',
        'chromium': 'chromium',
        'msedge': 'edge',
        'firefox': 'firefox',
        'opera': 'opera',
        'safari': 'safari',
        'vivaldi': 'vivaldi',
        'whale': 'whale'
      };
      
      const browserName = browserMap[fileName] || 'chrome';
      console.log(`🍪 Navegador customizado detectado: ${fileName} -> ${browserName}`);
      return browserName;
    } else {
      console.warn(`⚠️ Navegador não encontrado: ${userPreference}, tentando auto-detectar...`);
    }
  }
  
  // Auto-detect: caminhos por plataforma
  let browser = 'chrome';
  
  if (isWindows) {
    const edgePath   = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    const chromePath = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe');
    const bravePath  = path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
    const firefoxPath= path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Mozilla Firefox', 'firefox.exe');
    const operaPath  = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Opera', 'opera.exe');
    if      (fs.existsSync(bravePath))   browser = 'brave';
    else if (fs.existsSync(edgePath))    browser = 'edge';
    else if (fs.existsSync(chromePath))  browser = 'chrome';
    else if (fs.existsSync(firefoxPath)) browser = 'firefox';
    else if (fs.existsSync(operaPath))   browser = 'opera';
  } else {
    // Linux / macOS
    const linuxPaths = [
      ['/opt/brave.com/brave/brave',          'brave'],
      ['/usr/bin/brave-browser',               'brave'],
      ['/usr/bin/google-chrome',               'chrome'],
      ['/usr/bin/google-chrome-stable',        'chrome'],
      ['/usr/bin/chromium-browser',            'chromium'],
      ['/usr/bin/chromium',                    'chromium'],
      ['/usr/bin/firefox',                     'firefox'],
      ['/usr/bin/opera',                       'opera'],
      ['/usr/bin/vivaldi',                     'vivaldi'],
    ];
    for (const [p, name] of linuxPaths) {
      if (fs.existsSync(p)) { browser = name; break; }
    }
  }
  
  if (userPreference && userPreference.trim() !== '') {
    console.log(`🍪 Usando navegador configurado: ${browser}`);
  }
  
  return browser;
}

// Função helper para criar opções de spawn do yt-dlp com Node.js do Electron
function getYtdlpSpawnOptions() {
  const electronNodePath = path.dirname(process.execPath);
  const pathSep = isWindows ? ';' : ':';
  
  let extraPaths;
  if (isWindows) {
    extraPaths = [
      electronNodePath,
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs'),
      path.join(process.env.APPDATA || '', 'npm')
    ].filter(p => p && fs.existsSync(p)).join(pathSep);
  } else {
    extraPaths = [
      electronNodePath,
      '/usr/bin',
      '/usr/local/bin',
      '/opt/homebrew/bin',
      path.join(process.env.HOME || '', '.local', 'bin')
    ].filter(p => p && fs.existsSync(p)).join(pathSep);
  }
  
  const currentPath = process.env.PATH || '';
  const newPath = `${extraPaths}${pathSep}${currentPath}`;
  
  console.log('🔧 PATH configurado para yt-dlp:', extraPaths);
  
  return {
    env: {
      ...process.env,
      PATH: newPath,
      NODE_OPTIONS: '',
      NODE_PATH: extraPaths.split(pathSep)[0]
    }
  };
}

// Handler para extrair informações de playlist
ipcMain.handle("get-playlist-info", async (event, url) => {
  // Detectar yt-dlp (global ou local)
  const ytdlpPath = await getYtdlpPath();
  
  return new Promise((resolve, reject) => {
    // Obter configuração do navegador
    const prefs = loadPreferences();
    const browser = detectBrowser(prefs?.browserPath || '');
    const browserPath = prefs?.browserPath || '';
    
    // Verificar se há browserPath configurado
    const useBrowserCookies = browserPath.trim() !== '';
    
    // Obter limite de playlist das preferências (padrão: 1000)
    const playlistLimit = prefs?.playlistLimit || 1000;
    
    const args = [
      '--flat-playlist',
      '--print', '%(id)s|||%(title)s',  // Retornar ID e título separados por |||
      '--playlist-end', String(playlistLimit),
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept-Encoding:gzip, deflate, br',
      '--add-header', 'Referer:https://www.youtube.com/',
      '--extractor-retries', '5',
      '--fragment-retries', '5',
      '--sleep-interval', '2',
      '--max-sleep-interval', '5'
    ];
    
    if (useBrowserCookies) {
      console.log('🍪 Usando cookies do navegador:', browser);
      args.push('--cookies-from-browser', browser);
    } else {
      console.log('⚠️ Cookies do navegador desabilitados nas preferências');
    }
    
    args.push(url);
    
    const ytdlp = spawn(ytdlpPath, args, getYtdlpSpawnOptions());
    const items = [];
    let errorOutput = '';
    
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
    
    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('yt-dlp stderr:', data.toString());
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0) {
        resolve(items);
      } else {
        let errorMsg = errorOutput.trim() || `Erro ao extrair playlist: código ${code}`;
        
        // Erro de DPAPI (criptografia do Windows)
        const dpapiError = errorOutput.toLowerCase().includes('failed to decrypt with dpapi');
        if (dpapiError) {
          errorMsg = '🔒 ERRO DE CRIPTOGRAFIA: Não foi possível descriptografar os cookies do navegador.\n\n' +
                     '📌 SOLUÇÕES:\n' +
                     '   1. FECHE TODAS as janelas do navegador e tente novamente\n' +
                     '   2. Execute o DLWave como Administrador (clique direito → Executar como administrador)\n' +
                     '   3. OU use cookies.txt manual (recomendado):\n' +
                     '      • Instale a extensão "Get cookies.txt LOCALLY" no navegador\n' +
                     '      • Exporte o arquivo cookies.txt\n' +
                     '      • Configure em Configurações → Cookies.txt';
        }
        
        // Erro de cookie database locked (navegador aberto)
        const cookieDbError = errorOutput.toLowerCase().includes('could not copy chrome cookie database');
        if (cookieDbError && !dpapiError) {
          errorMsg = '⚠️ FECHE O NAVEGADOR: O navegador precisa estar completamente fechado para extrair os cookies. Feche todas as janelas do navegador e tente novamente.';
        }
        
        // Se for erro de autenticação, dar dica
        const authErrors = ['please sign in', 'sign in to confirm', 'requires authentication', 'po token', 'gvs po token'];
        const isAuthError = authErrors.some(msg => errorOutput.toLowerCase().includes(msg));
        
        if (isAuthError && !cookieDbError && !dpapiError) {
          errorMsg = '🔐 Erro de autenticação: Este conteúdo requer login. Habilite cookies do navegador nas Configurações.';
        }
        
        console.error('Erro completo:', errorMsg);
        reject(new Error(errorMsg));
      }
    });
    
    ytdlp.on('error', (error) => {
      console.error('Erro ao executar yt-dlp:', error);
      reject(error);
    });
  });
});

// Handler para verificar Resolução (NOVA LÓGICA SEM best/bestvideo)
ipcMain.handle("check-resolution", async (event, url, resolution, allowLowerQuality) => {
  console.log('🔍 check-resolution chamado com:', { url, resolution, allowLowerQuality });
  
  // Se allowLowerQuality estiver ativado ou for "best", não verificar
  if (allowLowerQuality || !resolution || resolution === 'best') {
    console.log('❌ Pulando verificação:', { allowLowerQuality, resolution });
    return true;
  }
  
  console.log('✅ Iniciando verificação de resolução (NOVA LÓGICA)...');
  
  try {
    const ytdlpPath = await getYtdlpPath();
    const requestedHeight = parseInt(resolution);
    
    // Detectar browser para cookies
    const prefs = loadPreferences();
    const browser = detectBrowser(prefs?.browserPath || '');
    
    const shouldContinue = await new Promise((checkResolve) => {
      // NOVA ABORDAGEM: Usar --list-formats e fazer parsing manual
      const checkArgs = [
        '--list-formats',
        '--no-playlist'
      ];
      
      // Adicionar cookies se browserPath configurado
      const browserPath = prefs?.browserPath || '';
      const useBrowserCookies = browserPath.trim() !== '';
      if (useBrowserCookies) {
        checkArgs.push('--cookies-from-browser', browser);
      }
      
      checkArgs.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        '--add-header', 'Accept-Language:pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        '--add-header', 'Accept-Encoding:gzip, deflate, br',
        '--add-header', 'Referer:https://www.youtube.com/',
        '--extractor-retries', '5',
        '--fragment-retries', '5',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        url
      );
      
      console.log('🚨 COMANDO LIST-FORMATS:', ytdlpPath, checkArgs.join(' '));
      
      const checkProcess = spawn(ytdlpPath, checkArgs, getYtdlpSpawnOptions());
      let formatsOutput = '';
      let stderrOutput = '';
      
      checkProcess.stdout.on('data', (data) => {
        formatsOutput += data.toString();
      });
      
      checkProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        console.log('😱 list-formats stderr:', data.toString());
      });
      
      checkProcess.on('close', async (code) => {
        console.log('📏 List-formats código de saída:', code);
        console.log('😱 Stderr completo:', stderrOutput);
        
        if (code === 0 && formatsOutput) {
          // Parser das linhas de formato para encontrar a maior resolução
          const lines = formatsOutput.split('\n');
          console.log('📄 Total de linhas do list-formats:', lines.length);
          
          let maxHeight = 0;
          const resolutions = [];
          
          for (const line of lines) {
            // Buscar padrões como "1920x1080", "1280x720" etc
            const resMatch = line.match(/(\d+)x(\d+)/);
            if (resMatch) {
              const height = parseInt(resMatch[2]);
              if (height > maxHeight) {
                maxHeight = height;
              }
              resolutions.push(height);
              console.log('📐 Resolução encontrada na linha:', height, '|', line.substring(0, 80));
            }
          }
          
          console.log('📊 Resoluções encontradas:', resolutions.sort((a, b) => b - a));
          console.log('📏 Altura máxima detectada:', maxHeight, 'Altura solicitada:', requestedHeight);
          
          if (maxHeight < requestedHeight) {
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
            const actualName = resNames[maxHeight] || `${maxHeight}p`;
            
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
              let isResolved = false;
              
              ipcMain.once('resolution-warning-response', (event, shouldContinue) => {
                if (!isResolved) {
                  isResolved = true;
                  warningWindow.close();
                  resolve(shouldContinue);
                }
              });
              
              warningWindow.on('closed', () => {
                if (!isResolved) {
                  isResolved = true;
                  resolve(false); // Se usuário fechou a janela, cancelar download
                }
              });
            });
            
            // Se o usuário aceitou, retornar a resolução máxima disponível
            checkResolve(userChoice ? maxHeight : false);
          } else {
            checkResolve(true);
          }
        } else {
          checkResolve(true);
        }
      });
      
      checkProcess.on('error', () => checkResolve(true));
    });
    
    console.log('🎯 check-resolution resultado final:', shouldContinue);
    return shouldContinue;
  } catch (err) {
    console.log('❌ check-resolution erro:', err.message);
    return true;
  }
});

// Handler para iniciar download
ipcMain.handle("start-download", async (event, dados) => {
  const { tabId, url, type, format, resolution, downloadPath, playlistFolderName, allowLowerQuality, playlistItems, ignorePlaylist, cookiesFilePath } = dados;
  
  console.log('🚀 START-DOWNLOAD DADOS RECEBIDOS:', {
    tabId, 
    url: url?.substring(0, 50),
    type, 
    format, 
    resolution, 
    allowLowerQuality,
    ignorePlaylist
  });
  
  // Reset flag de cancelamento no início do download
  downloadCancelledFlags.set(tabId, false);
  
  // Se yt-dlp precisa de atualização, mostrar prompt antes de baixar
  if (ytdlpUpdatePending) {
    const updated = await showYtdlpUpdatePrompt();
    
    if (!updated) {
      throw new Error('yt-dlp precisa ser atualizado para continuar. Atualize nas configurações ou reinicie o app.');
    }
  }
  
  // Verificar se dependências estão instaladas ANTES de tudo
  const deps = await verificarDependencias();
  const ytdlpPath = await getYtdlpPath();
  const ffmpegPath = path.join(binPath, ffmpegBin);
  
  if (!deps.todasOk) {
    const errorMsg = `❌ ERRO: Dependências não instaladas!\n` +
                    `   yt-dlp: ${deps.ytdlp ? '✅' : '❌'} ${deps.ytdlpGlobal ? '(Global)' : deps.ytdlpLocal ? '(Local)' : '(Não encontrado)'}\n` +
                    `   ffmpeg: ${deps.ffmpeg ? '✅' : '❌'}\n` +
                    `\n📌 SOLUÇÃO: Abra as Configurações e clique em "Reinstalar Dependências"`;
    
    if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
      mainWindowGlobal.webContents.send('log', tabId, errorMsg);
    }
    throw new Error('Dependências não instaladas');
  }
  
  console.log(`✅ Verificação de dependências OK`);
  console.log(`   yt-dlp: ${ytdlpPath} ${deps.ytdlpGlobal ? '(Global)' : '(Local)'}`);
  console.log(`   ffmpeg: ${ffmpegPath}`);
  
  try {
    // Verificar espaço em disco disponível
    const checkDiskSpace = () => {
      return new Promise((resolve) => {
        try {
          // Node 18+: fs.statfsSync — funciona em Windows e Linux
          const stat = fs.statfsSync(downloadPath);
          resolve(stat.bfree * stat.bsize);
        } catch {
          resolve(null);
        }
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
    
    // Determinar se deve verificar cada vídeo da playlist individualmente
    const shouldCheckEachVideo = dados.isPlaylist && playlistItems && !allowLowerQuality && type === 'video' && resolution !== 'best';
    
    if (shouldCheckEachVideo) {
      // Processar playlist video por video com verificação de resolução
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, `🎬 Processando playlist: ${playlistItems.length} vídeos`);
        mainWindowGlobal.webContents.send('log', tabId, `⚙️ Verificando resolução disponível para cada vídeo...`);
      }
      
      let downloadedCount = 0;
      let skippedCount = 0;
      let cancelledByUser = false;
      
      for (let i = 0; i < playlistItems.length; i++) {
        if (downloadCancelledFlags.get(tabId)) {
          console.log(`🛑 Cancelamento detectado no loop da playlist (tabId: ${tabId})`);
          cancelledByUser = true;
          break;
        }
        
        const item = playlistItems[i];
        const videoUrl = item.url;
        const videoTitle = item.title || `Vídeo ${i + 1}`;
        
        if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
          mainWindowGlobal.webContents.send('log', tabId, `\n[${i + 1}/${playlistItems.length}] ${videoTitle}`);
        }
        
        try {
          // Verificar resolução disponível do vídeo
          const ytdlpPath = await getYtdlpPath();
          const ffmpegPath = path.join(binPath, ffmpegBin);
          const requestedHeight = parseInt(resolution);
          
          // Detectar browser para cookies
          const prefs = loadPreferences();
          const browser = detectBrowser(prefs?.browserPath || '');
          const browserPath = prefs?.browserPath || '';
          const useBrowserCookies = browserPath.trim() !== '';
          
          // Primeiro: verificar se a resolução solicitada está disponível
          const strictFormat = `bestvideo[height>=${resolution}]+bestaudio`;
          const checkArgs1 = [
            '-f', strictFormat,
            '--print', '%(height)s',
            '--no-playlist'
          ];
          
          if (useBrowserCookies) {
            checkArgs1.push('--cookies-from-browser', browser);
          }
          
          checkArgs1.push(
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            '--add-header', 'Accept-Language:pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            '--add-header', 'Accept-Encoding:gzip, deflate, br',
            '--add-header', 'Referer:https://www.youtube.com/',
            '--extractor-retries', '3',
            '--fragment-retries', '3',
            videoUrl
          );
          
          const checkExactFormat = await new Promise((resolve) => {
            // Verificar cancelamento antes de iniciar check
            if (downloadCancelledFlags.get(tabId)) {
              resolve({ success: false, height: '', cancelled: true });
              return;
            }
            
            const proc = spawn(ytdlpPath, checkArgs1, getYtdlpSpawnOptions());
            downloadProcesses.set(tabId, proc); // Armazenar para permitir cancelamento
            let output = '';
            proc.stdout.on('data', (data) => { output += data.toString(); });
            proc.on('close', (code) => {
              resolve({ success: code === 0, height: output.trim(), cancelled: downloadCancelledFlags.get(tabId) });
            });
          });
          
          // Se foi cancelado, sair do loop
          if (checkExactFormat.cancelled || downloadCancelledFlags.get(tabId)) {
            cancelledByUser = true;
            break;
          }
          
          if (checkExactFormat.success && checkExactFormat.height) {
            // Formato exato disponível - baixar sem perguntar
            if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
              mainWindowGlobal.webContents.send('log', tabId, `✅ Resolução ${resolution}p disponível - baixando...`);
            }
            
            try {
              await downloadSingleVideo(tabId, videoUrl, dados, finalDownloadPath);
              downloadedCount++;
            } catch (err) {
              // Se foi cancelado, parar tudo
              if (err.message && err.message.includes('cancelado')) {
                cancelledByUser = true;
                break;
              }
              throw err; // Re-lançar outros erros
            }
            continue;
          }
          
          // Segundo: buscar a melhor resolução disponível para comparar
          const fallbackFormat = `bestvideo+bestaudio/best`;
          const checkArgs2 = [
            '-f', fallbackFormat,
            '--print', '%(height)s',
            '--no-playlist'
          ];
          
          if (useBrowserCookies) {
            checkArgs2.push('--cookies-from-browser', browser);
          }
          
          checkArgs2.push(
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            '--add-header', 'Accept-Language:pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            '--add-header', 'Accept-Encoding:gzip, deflate, br',
            '--add-header', 'Referer:https://www.youtube.com/',
            '--extractor-retries', '3',
            '--fragment-retries', '3',
            videoUrl
          );
          
          const checkBestAvailable = await new Promise((resolve) => {
            // Verificar cancelamento antes de iniciar check
            if (downloadCancelledFlags.get(tabId)) {
              resolve({ success: false, height: '', cancelled: true });
              return;
            }
            
            const proc = spawn(ytdlpPath, checkArgs2, getYtdlpSpawnOptions());
            downloadProcesses.set(tabId, proc); // Armazenar para permitir cancelamento
            let output = '';
            proc.stdout.on('data', (data) => { output += data.toString(); });
            proc.on('close', (code) => {
              resolve({ success: code === 0, height: output.trim(), cancelled: downloadCancelledFlags.get(tabId) });
            });
          });
          
          // Se foi cancelado, sair do loop
          if (checkBestAvailable.cancelled || downloadCancelledFlags.get(tabId)) {
            cancelledByUser = true;
            break;
          }
          
          if (!checkBestAvailable.success || !checkBestAvailable.height) {
            // Vídeo inacessível ou com erro - perguntar ao usuário o que fazer
            const userDecision = await new Promise((resolve) => {
              const warningWindow = new BrowserWindow({
                width: 550,
                height: 320,
                resizable: false,
                frame: false,
                modal: true,
                parent: mainWindowGlobal,
                webPreferences: {
                  nodeIntegration: true,
                  contextIsolation: false
                }
              });

              const htmlContent = `
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
                      background: linear-gradient(90deg, #ff6b6b, #ff9999);
                      -webkit-background-clip: text;
                      -webkit-text-fill-color: transparent;
                    }
                    .content {
                      flex: 1;
                      padding: 30px;
                      display: flex;
                      flex-direction: column;
                      justify-content: center;
                      gap: 15px;
                    }
                    .video-title {
                      font-size: 13px;
                      color: #999;
                      margin-bottom: 5px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    }
                    .message {
                      font-size: 14px;
                      line-height: 1.6;
                      color: #e0e0e0;
                    }
                    .highlight {
                      color: #ff6b6b;
                      font-weight: 600;
                    }
                    .progress {
                      font-size: 12px;
                      color: #888;
                      margin-top: 10px;
                    }
                    .buttons {
                      display: flex;
                      gap: 10px;
                      margin-top: 20px;
                    }
                    button {
                      flex: 1;
                      padding: 12px 0;
                      border: none;
                      border-radius: 6px;
                      font-size: 13px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;
                    }
                    .btn-cancel {
                      background: #dc3545;
                      color: white;
                    }
                    .btn-cancel:hover { background: #c82333; transform: translateY(-1px); }
                    .btn-skip {
                      background: #6c757d;
                      color: white;
                    }
                    .btn-skip:hover { background: #5a6268; transform: translateY(-1px); }
                    .btn-retry {
                      background: #ffc107;
                      color: #1e1e1e;
                    }
                    .btn-retry:hover { background: #e0a800; transform: translateY(-1px); }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <span class="icon">⚠️</span>
                    <h2>Vídeo Inacessível</h2>
                  </div>
                  <div class="content">
                    <div class="video-title">${videoTitle}</div>
                    <div class="message">
                      Este vídeo <span class="highlight">não está disponível</span> para download.<br>
                      Pode estar privado, removido ou geograficamente bloqueado.
                    </div>
                    <div class="progress">[${i + 1}/${playlistItems.length}] vídeos processados</div>
                    <div class="buttons">
                      <button class="btn-cancel" onclick="window.close(); require('electron').ipcRenderer.send('playlist-item-response', 'cancel')">Cancelar Playlist</button>
                      <button class="btn-skip" onclick="window.close(); require('electron').ipcRenderer.send('playlist-item-response', 'skip')">Pular Este Vídeo</button>
                      <button class="btn-retry" onclick="window.close(); require('electron').ipcRenderer.send('playlist-item-response', 'retry')">Tentar Baixar</button>
                    </div>
                  </div>
                </body>
                </html>
              `;

              warningWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

              ipcMain.once('playlist-item-response', (e, response) => {
                resolve(response);
              });

              warningWindow.on('closed', () => {
                resolve('skip');
              });
            });
            
            if (userDecision === 'cancel') {
              if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                mainWindowGlobal.webContents.send('log', tabId, `\n❌ Playlist cancelada pelo usuário`);
              }
              cancelledByUser = true;
              break;
            } else if (userDecision === 'skip') {
              if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                mainWindowGlobal.webContents.send('log', tabId, `⏭️ Vídeo pulado`);
              }
              skippedCount++;
              continue;
            } else {
              // retry - tentar baixar mesmo sem conseguir verificar
              if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                mainWindowGlobal.webContents.send('log', tabId, `🔄 Tentando baixar...`);
              }
              try {
                await downloadSingleVideo(tabId, videoUrl, dados, finalDownloadPath);
                downloadedCount++;
              } catch (err) {
                // Se foi cancelado, parar tudo
                if (err.message && err.message.includes('cancelado')) {
                  cancelledByUser = true;
                  break;
                }
                if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                  mainWindowGlobal.webContents.send('log', tabId, `⚠️ Falha: ${err.message}`);
                }
                skippedCount++;
              }
              continue;
            }
          }
          
          const lines = checkBestAvailable.height.split('\n').filter(l => l.trim());
          const actualHeight = parseInt(lines[lines.length - 1]);
          
          if (actualHeight < requestedHeight) {
            // Resolução inferior disponível - perguntar ao usuário
            
            // Verificar cancelamento antes de mostrar dialog
            if (downloadCancelledFlags.get(tabId)) {
              cancelledByUser = true;
              break;
            }
            
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
            
            const userDecision = await new Promise((resolve) => {
              const warningWindow = new BrowserWindow({
                width: 550,
                height: 320,
                resizable: false,
                frame: false,
                modal: true,
                parent: mainWindowGlobal,
                webPreferences: {
                  nodeIntegration: true,
                  contextIsolation: false
                }
              });

              const htmlContent = `
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
                      gap: 15px;
                    }
                    .video-title {
                      font-size: 13px;
                      color: #999;
                      margin-bottom: 5px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    }
                    .message {
                      font-size: 14px;
                      line-height: 1.6;
                      color: #e0e0e0;
                    }
                    .highlight {
                      color: #0078d4;
                      font-weight: 600;
                    }
                    .progress {
                      font-size: 12px;
                      color: #888;
                      margin-top: 10px;
                    }
                    .buttons {
                      display: flex;
                      gap: 10px;
                      margin-top: 20px;
                    }
                    button {
                      flex: 1;
                      padding: 12px 0;
                      border: none;
                      border-radius: 6px;
                      font-size: 13px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;
                    }
                    .btn-cancel {
                      background: #dc3545;
                      color: white;
                    }
                    .btn-cancel:hover { background: #c82333; transform: translateY(-1px); }
                    .btn-skip {
                      background: #6c757d;
                      color: white;
                    }
                    .btn-skip:hover { background: #5a6268; transform: translateY(-1px); }
                    .btn-download {
                      background: #0078d4;
                      color: white;
                    }
                    .btn-download:hover { background: #0063b1; transform: translateY(-1px); }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <span class="icon">⚠️</span>
                    <h2>Resolução Inferior Disponível</h2>
                  </div>
                  <div class="content">
                    <div class="video-title">${videoTitle}</div>
                    <div class="message">
                      Este vídeo não está disponível em <span class="highlight">${requestedName}</span>.<br>
                      A melhor qualidade disponível é <span class="highlight">${actualName}</span>.
                    </div>
                    <div class="progress">[${i + 1}/${playlistItems.length}] vídeos processados</div>
                    <div class="buttons">
                      <button class="btn-cancel" onclick="window.close(); require('electron').ipcRenderer.send('playlist-item-response', 'cancel')">Cancelar Playlist</button>
                      <button class="btn-skip" onclick="window.close(); require('electron').ipcRenderer.send('playlist-item-response', 'skip')">Pular Este Vídeo</button>
                      <button class="btn-download" onclick="window.close(); require('electron').ipcRenderer.send('playlist-item-response', 'download')">Baixar ${actualName}</button>
                    </div>
                  </div>
                </body>
                </html>
              `;

              warningWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

              ipcMain.once('playlist-item-response', (e, response) => {
                resolve(response);
              });

              warningWindow.on('closed', () => {
                resolve('skip');
              });
            });
            
            if (userDecision === 'cancel') {
              if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                mainWindowGlobal.webContents.send('log', tabId, `\n❌ Playlist cancelada pelo usuário`);
              }
              cancelledByUser = true;
              break;
            } else if (userDecision === 'skip') {
              if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                mainWindowGlobal.webContents.send('log', tabId, `⏭️ Vídeo pulado`);
              }
              skippedCount++;
              continue;
            } else {
              // download - usar a resolução real disponível
              if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
                mainWindowGlobal.webContents.send('log', tabId, `📥 Baixando em ${actualName}...`);
              }
              try {
                const adjustedDados = { ...dados, resolution: String(actualHeight), allowLowerQuality: true };
                await downloadSingleVideo(tabId, videoUrl, adjustedDados, finalDownloadPath);
                downloadedCount++;
              } catch (err) {
                // Se foi cancelado, parar tudo
                if (err.message && err.message.includes('cancelado')) {
                  cancelledByUser = true;
                  break;
                }
                throw err; // Re-lançar outros erros
              }
            }
          } else {
            // Resolução igual ou superior disponível
            
            // Verificar cancelamento antes de baixar
            if (downloadCancelledFlags.get(tabId)) {
              cancelledByUser = true;
              break;
            }
            
            if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
              mainWindowGlobal.webContents.send('log', tabId, `✅ Resolução ${resolution}p disponível - baixando...`);
            }
            try {
              await downloadSingleVideo(tabId, videoUrl, dados, finalDownloadPath);
              downloadedCount++;
            } catch (err) {
              // Se foi cancelado, parar tudo
              if (err.message && err.message.includes('cancelado')) {
                cancelledByUser = true;
                break;
              }
              throw err; // Re-lançar outros erros
            }
          }
          
        } catch (error) {
          // Se foi cancelado, parar loop
          if (error.message && error.message.includes('cancelado')) {
            cancelledByUser = true;
            break;
          }
          if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
            mainWindowGlobal.webContents.send('log', tabId, `⚠️ Erro ao processar vídeo: ${error.message}`);
          }
          skippedCount++;
        }
      }
      
      if (cancelledByUser) {
        throw new Error('Download cancelado pelo usuário');
      }
      
      const summary = `\n✅ Playlist finalizada: ${downloadedCount} baixados, ${skippedCount} pulados`;
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, summary);
      }
      
      return { sucesso: true, mensagem: summary };
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
    // NÃO resetar a flag aqui - será resetada no cancel-download handler
    // para garantir que todos os processos parem antes
    throw error;
  }
});

// Função auxiliar para detectar e retornar o caminho do yt-dlp (global ou local)
function getYtdlpPath() {
  return new Promise((resolve) => {
    const localPath = path.join(binPath, ytdlpBin);
    
    if (isWindows) {
      // WinGet Links
      const wingetLinksPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe');
      if (fs.existsSync(wingetLinksPath)) {
        console.log(`🌐 yt-dlp via WinGet Links: ${wingetLinksPath}`);
        resolve(wingetLinksPath); return;
      }
      // WinGet Packages
      const packagesPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
      if (fs.existsSync(packagesPath)) {
        try {
          const dirs = fs.readdirSync(packagesPath).filter(d => d.startsWith('yt-dlp.yt-dlp'));
          for (const dir of dirs) {
            const p = path.join(packagesPath, dir, 'yt-dlp.exe');
            if (fs.existsSync(p)) { console.log(`🌐 yt-dlp via WinGet Packages: ${p}`); resolve(p); return; }
          }
        } catch (err) { console.warn('⚠️ Erro WinGet Packages:', err.message); }
      }
      // where (PATH)
      exec('where yt-dlp', (error, stdout) => {
        if (!error && stdout.trim()) {
          for (const p of stdout.trim().split('\n')) {
            const clean = p.trim();
            if (clean.toLowerCase().endsWith('.exe') && fs.existsSync(clean)) {
              console.log(`🌐 yt-dlp.exe no PATH: ${clean}`); resolve(clean); return;
            }
          }
        }
        console.log(`📦 Usando yt-dlp LOCAL: ${localPath}`);
        resolve(localPath);
      });
    } else {
      // Linux / macOS: which
      exec('which yt-dlp', (error, stdout) => {
        if (!error && stdout.trim()) {
          const p = stdout.trim();
          if (fs.existsSync(p)) {
            console.log(`🌐 yt-dlp no PATH: ${p}`); resolve(p); return;
          }
        }
        console.log(`📦 Usando yt-dlp LOCAL: ${localPath}`);
        resolve(localPath);
      });
    }
  });
}

// Função auxiliar para baixar um único vídeo
async function downloadSingleVideo(tabId, videoUrl, dados, finalDownloadPath) {
  const { type, format, resolution, cookiesFilePath, allowLowerQuality } = dados;
  
  // Detectar yt-dlp (global ou local)
  const ytdlpPath = await getYtdlpPath();
  const ffmpegPath = path.join(binPath, ffmpegBin);
  
  return new Promise((resolve, reject) => {
    // Verificar cancelamento antes de iniciar
    if (downloadCancelledFlags.get(tabId)) {
      console.log(`🛑 downloadSingleVideo: Cancelamento detectado antes de iniciar (tabId: ${tabId})`);
      reject(new Error('Download cancelado'));
      return;
    }
    
    // Verificar se yt-dlp existe
    if (!fs.existsSync(ytdlpPath)) {
      const errorMsg = `❌ ERRO: yt-dlp não encontrado em: ${ytdlpPath}\nReinstale as dependências nas Configurações.`;
      console.error(errorMsg);
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, errorMsg);
      }
      reject(new Error('yt-dlp não encontrado'));
      return;
    }
    
    // Verificar se ffmpeg existe
    if (!fs.existsSync(ffmpegPath)) {
      const errorMsg = `❌ ERRO: ffmpeg não encontrado em: ${ffmpegPath}\nReinstale as dependências nas Configurações.`;
      console.error(errorMsg);
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, errorMsg);
      }
      reject(new Error('ffmpeg não encontrado'));
      return;
    }
    
    console.log(`✅ Dependências encontradas:`);
    console.log(`   yt-dlp: ${ytdlpPath}`);
    console.log(`   ffmpeg: ${ffmpegPath}`);
    
    const args = [];
    
    // Detectar browser para cookies
    const prefs = loadPreferences();
    const browser = detectBrowser(prefs?.browserPath || '');
    
    if (type === 'audio') {
      args.push('-x');
      args.push('--audio-format', format);
      args.push('--audio-quality', '0');
    } else {
      let formatString;
      console.log('🎬 CONFIGURANDO FORMATO DE DOWNLOAD:', { resolution, allowLowerQuality, type, format });
      
      if (resolution && resolution !== 'best') {
        const height = parseInt(resolution);
        
        if (allowLowerQuality) {
          // Com fallback: melhor vídeo até a resolução solicitada, senão o melhor disponível
          formatString = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/bestvideo+bestaudio/best`;
          console.log('📺 Usando formato com fallback progressivo:', formatString);
        } else {
          // Sem fallback: melhor vídeo até a resolução solicitada
          formatString = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
          console.log('📺 Usando formato estrito (até resolução solicitada):', formatString);
        }
      } else {
        // Para resolution='best', pegar o melhor disponível
        formatString = `bestvideo+bestaudio/best`;
        console.log('📺 Usando melhor formato disponível:', formatString);
      }
      
      args.push('-f', formatString);
      args.push('--merge-output-format', format);
    }
    
    args.push('--ffmpeg-location', ffmpegPath);
    args.push('-o', path.join(finalDownloadPath, '%(title)s.%(ext)s'));
    args.push('--no-playlist');
    
    // Cookies e anti-bot
    const browserPath = prefs?.browserPath || '';
    const useBrowserCookies = browserPath.trim() !== '';
    const hasCookies = (cookiesFilePath && cookiesFilePath.trim() !== '') || useBrowserCookies;
    
    if (cookiesFilePath && cookiesFilePath.trim() !== '') {
      args.push('--cookies', cookiesFilePath);
    } else if (useBrowserCookies) {
      args.push('--cookies-from-browser', browser);
    }
    
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    args.push('--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    args.push('--add-header', 'Accept-Language:pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    args.push('--add-header', 'Accept-Encoding:gzip, deflate, br');
    
    // Headers específicos por plataforma
    const isTwitterUrl = videoUrl && (videoUrl.includes('twitter.com') || videoUrl.includes('x.com'));
    if (isTwitterUrl) {
      args.push('--add-header', 'Referer:https://x.com/');
      args.push('--add-header', 'Origin:https://x.com');
      args.push('--legacy-server-connect');
    } else {
      args.push('--add-header', 'Referer:https://www.youtube.com/');
    }
    
    args.push('--extractor-retries', '5');
    args.push('--fragment-retries', '5');
    args.push('--sleep-interval', '1');
    args.push('--max-sleep-interval', '5');
    
    // Verificar se Node.js está disponível
    const spawnOptions = getYtdlpSpawnOptions();
    console.log('🔍 Verificando Node.js disponível...');
    try {
      const nodeCheck = spawn('node', ['--version'], spawnOptions);
      let nodeVersion = '';
      nodeCheck.stdout.on('data', (data) => { nodeVersion += data.toString(); });
      nodeCheck.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Node.js encontrado: ${nodeVersion.trim()}`);
        } else {
          console.warn('⚠️ Node.js NÃO encontrado! yt-dlp pode falhar em resolver desafios JavaScript');
          if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
            mainWindowGlobal.webContents.send('log', tabId, '⚠️ AVISO: Node.js não detectado. Alguns vídeos podem falhar.');
          }
        }
      });
    } catch (err) {
      console.error('❌ Erro ao verificar Node.js:', err);
    }
    
    args.push('--progress');
    args.push('--newline');
    args.push(videoUrl);
    
    console.log('🚀 Iniciando download com argumentos completos:');
    console.log('📋 Args array:', args);
    console.log('🎯 Comando final será:', ytdlpPath, args.join(' '));
    
    const ytdlp = spawn(ytdlpPath, args, spawnOptions);
    downloadProcesses.set(tabId, ytdlp); // Armazenar para permitir cancelamento
    
    let stderrBuffer = ''; // Buffer para acumular erros
    
    ytdlp.stdout.on('data', (data) => {
      // Verificar se foi cancelado durante download
      if (downloadCancelledFlags.get(tabId)) {
        console.log(`🛑 downloadSingleVideo: Cancelamento detectado durante download (tabId: ${tabId}), matando processo`);
        ytdlp.kill('SIGTERM');
        reject(new Error('Download cancelado'));
        return;
      }
      const output = data.toString();
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, output.trim());
      }
    });
    
    ytdlp.stderr.on('data', (data) => {
      const error = data.toString();
      stderrBuffer += error; // Acumular erros
      
      // Verificar se é erro de autenticação
      const authErrors = [
        'please sign in',
        'sign in to confirm',
        'requires authentication',
        'po token',
        'gvs po token'
      ];
      
      const isAuthError = authErrors.some(msg => error.toLowerCase().includes(msg));
      
      // Erro de DPAPI (criptografia do Windows)
      const dpapiError = error.toLowerCase().includes('failed to decrypt with dpapi');
      if (dpapiError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '🔒 ERRO: Falha ao descriptografar cookies (DPAPI)');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÕES:');
        mainWindowGlobal.webContents.send('log', tabId, '   1. FECHE todas as janelas do navegador e tente novamente');
        mainWindowGlobal.webContents.send('log', tabId, '   2. Execute o DLWave como Administrador');
        mainWindowGlobal.webContents.send('log', tabId, '   3. OU use cookies.txt manual (recomendado):');
        mainWindowGlobal.webContents.send('log', tabId, '      • Extensão: "Get cookies.txt LOCALLY"');
        mainWindowGlobal.webContents.send('log', tabId, '      • Configure em Configurações');
        mainWindowGlobal.webContents.send('log', tabId, '');
        return;
      }
      
      // Erro de cookie database locked (navegador aberto)
      const cookieDbError = error.toLowerCase().includes('could not copy chrome cookie database');
      if (cookieDbError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '⚠️ ERRO: Cookie Database Bloqueado!');
        mainWindowGlobal.webContents.send('log', tabId, '🚫 O navegador está ABERTO e bloqueando o acesso aos cookies.');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÃO: Feche TODAS as janelas do navegador e tente novamente.');
        mainWindowGlobal.webContents.send('log', tabId, '');
        return;
      }
      
      // Erro específico do Twitter/X
      const isTwitterErr = videoUrl && (videoUrl.includes('twitter.com') || videoUrl.includes('x.com'));
      const twitterErrors = ['could not send request', 'unable to extract', 'http error 403', 'http error 401', 'nsig extraction failed', 'login required', 'not available', 'unable to download video data', 'failed to download m3u8'];
      const isTwitterError = isTwitterErr && twitterErrors.some(msg => error.toLowerCase().includes(msg));
      
      if (isTwitterError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '🐦 ERRO: O Twitter/X bloqueou o acesso ao vídeo (403).');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÕES (tente na ordem):');
        mainWindowGlobal.webContents.send('log', tabId, '   1. Use cookies do NAVEGADOR (mais confiável):');
        mainWindowGlobal.webContents.send('log', tabId, '      • Faça login no Twitter/X no Chrome/Brave/Edge');
        mainWindowGlobal.webContents.send('log', tabId, '      • FECHE o navegador completamente');
        mainWindowGlobal.webContents.send('log', tabId, '      • Nas Configurações do DLWave → selecione o navegador');
        mainWindowGlobal.webContents.send('log', tabId, '   2. Se já configurou cookies e ainda dá 403:');
        mainWindowGlobal.webContents.send('log', tabId, '      • Certifique-se que o navegador está FECHADO');
        mainWindowGlobal.webContents.send('log', tabId, '      • Atualize o yt-dlp (Configurações → Reinstalar)');
        mainWindowGlobal.webContents.send('log', tabId, '      • O Twitter muda frequentemente, a versão mais nova do yt-dlp pode resolver');
        mainWindowGlobal.webContents.send('log', tabId, '');
        return;
      }
      
      if (isAuthError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '🔐 ERRO: Este vídeo requer autenticação (pode ter restrição de idade).');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÃO:');
        mainWindowGlobal.webContents.send('log', tabId, '   1. Abra o Brave/Chrome/Edge e faça LOGIN no YouTube');
        mainWindowGlobal.webContents.send('log', tabId, '   2. Nas Configurações do DLWave:');
        mainWindowGlobal.webContents.send('log', tabId, '      ✓ Selecione o navegador ou adicione cookies.txt');
        mainWindowGlobal.webContents.send('log', tabId, '   3. Tente baixar novamente');
        return;
      }
      
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, error.trim());
      }
    });
    
    ytdlp.on('close', (code) => {
      downloadProcesses.delete(tabId); // Remover referência ao finalizar
      
      // Se foi cancelado, rejeitar
      if (downloadCancelledFlags.get(tabId)) {
        console.log(`🛑 downloadSingleVideo: Processo fechado com cancelamento ativo (tabId: ${tabId})`);
        reject(new Error('Download cancelado'));
        return;
      }
      
      if (code === 0) {
        resolve({ sucesso: true });
      } else {
        // Mostrar mensagem de erro completa
        const errorMsg = `❌ yt-dlp encerrou com código ${code}\n\n📋 DETALHES DO ERRO:\n${stderrBuffer || 'Nenhum erro detalhado disponível'}`;
        console.error(errorMsg);
        if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
          mainWindowGlobal.webContents.send('log', tabId, errorMsg);
        }
        reject(new Error(`yt-dlp encerrou com código ${code}`));
      }
    });
    
    ytdlp.on('error', (error) => {
      reject(error);
    });
  });
}

// Função auxiliar para baixar um chunk (lote) da playlist
async function downloadChunk(tabId, dados, finalDownloadPath, playlistStart = null, playlistEnd = null) {
  const { url, type, format, resolution, ignorePlaylist, cookiesFilePath, allowLowerQuality } = dados;
  
  // Detectar yt-dlp (global ou local)
  const ytdlpPath = await getYtdlpPath();
  const ffmpegPath = path.join(binPath, ffmpegBin);
  
  return new Promise((resolve, reject) => {
    // Verificar se yt-dlp existe
    if (!fs.existsSync(ytdlpPath)) {
      const errorMsg = `❌ ERRO: yt-dlp não encontrado em: ${ytdlpPath}\nReinstale as dependências nas Configurações.`;
      console.error(errorMsg);
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, errorMsg);
      }
      reject(new Error('yt-dlp não encontrado'));
      return;
    }
    
    // Verificar se ffmpeg existe
    if (!fs.existsSync(ffmpegPath)) {
      const errorMsg = `❌ ERRO: ffmpeg não encontrado em: ${ffmpegPath}\nReinstale as dependências nas Configurações.`;
      console.error(errorMsg);
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, errorMsg);
      }
      reject(new Error('ffmpeg não encontrado'));
      return;
    }
    
    console.log(`✅ Dependências encontradas (chunk ${playlistStart}-${playlistEnd}):`);
    console.log(`   yt-dlp: ${ytdlpPath}`);
    console.log(`   ffmpeg: ${ffmpegPath}`);
    
    // Detectar browser para cookies
    const prefs = loadPreferences();
    const browser = detectBrowser(prefs?.browserPath || '');
    
    // Configurar argumentos do yt-dlp
    const args = [];
    
    if (type === 'audio') {
      // Download de áudio
      args.push('-x'); // Extrair áudio
      args.push('--audio-format', format);
      args.push('--audio-quality', '0'); // Melhor qualidade
    } else {
      // Download de vídeo (NOVA LÓGICA SEM best/bestvideo)
      let formatString;
      if (resolution && resolution !== 'best') {
        const height = parseInt(resolution);
        
        console.log('🎬 Configurando formato playlist/individual:', { resolution, allowLowerQuality, format });
        
        if (allowLowerQuality) {
          // Com fallback: melhor vídeo até a resolução solicitada, senão o melhor disponível
          formatString = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/bestvideo+bestaudio/best`;
        } else {
          // Sem fallback: melhor vídeo até a resolução solicitada
          formatString = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
        }
      } else {
        // Melhor qualidade disponível
        formatString = `bestvideo+bestaudio/best`;
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
    
    // Cookies e anti-bot measures
    const browserPath = prefs?.browserPath || '';
    const useBrowserCookies = browserPath.trim() !== '';
    const hasCookies = (cookiesFilePath && cookiesFilePath.trim() !== '') || useBrowserCookies;
    
    if (cookiesFilePath && cookiesFilePath.trim() !== '') {
      args.push('--cookies', cookiesFilePath);
    } else if (useBrowserCookies) {
      args.push('--cookies-from-browser', browser);
    }
    
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    args.push('--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    args.push('--add-header', 'Accept-Language:pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    args.push('--add-header', 'Accept-Encoding:gzip, deflate, br');
    
    // Headers específicos por plataforma
    const isTwitterUrl = url && (url.includes('twitter.com') || url.includes('x.com'));
    if (isTwitterUrl) {
      args.push('--add-header', 'Referer:https://x.com/');
      args.push('--add-header', 'Origin:https://x.com');
      args.push('--legacy-server-connect');
    } else {
      args.push('--add-header', 'Referer:https://www.youtube.com/');
    }
    
    args.push('--extractor-retries', '5');
    args.push('--fragment-retries', '5');
    args.push('--sleep-interval', '1');
    args.push('--max-sleep-interval', '5');
    
    args.push('--progress'); // Mostrar progresso
    args.push('--newline'); // Nova linha para cada atualização de progresso
    args.push(url);
    
    console.log(`🚀 Iniciando download chunk ${playlistStart}-${playlistEnd}`);
    
    const ytdlp = spawn(ytdlpPath, args, getYtdlpSpawnOptions());
    downloadProcesses.set(tabId, ytdlp); // Armazenar referência para cancelamento
    
    let stderrBuffer = ''; // Buffer para acumular erros
    
    // Capturar saída
    ytdlp.stdout.on('data', (data) => {
      // Verificar se foi cancelado durante download
      if (downloadCancelledFlags.get(tabId)) {
        ytdlp.kill('SIGTERM');
        reject(new Error('Download cancelado'));
        return;
      }
      
      const output = data.toString();
      if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, output.trim());
        
        // Detectar progresso de playlist: [download] Downloading video 2 of 5
        const playlistMatch = output.match(/Downloading (?:video|item) (\d+) of (\d+)/i);
        if (playlistMatch) {
          const current = playlistMatch[1];
          const total = playlistMatch[2];
          mainWindowGlobal.webContents.send('log', tabId, `[${current}/${total}]`);
        }
      }
    });
    
    ytdlp.stderr.on('data', (data) => {
      const error = data.toString();
      stderrBuffer += error; // Acumular erros
      
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
      
      // Verificar se é erro de autenticação (Please sign in)
      const authErrors = [
        'please sign in',
        'sign in to confirm',
        'requires authentication',
        'po token',
        'gvs po token'
      ];
      
      const isAuthError = authErrors.some(msg => error.toLowerCase().includes(msg));
      
      // Erro de DPAPI (criptografia do Windows)
      const dpapiError = error.toLowerCase().includes('failed to decrypt with dpapi');
      if (dpapiError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '🔒 ERRO: Falha ao descriptografar cookies (DPAPI)');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÕES:');
        mainWindowGlobal.webContents.send('log', tabId, '   1. FECHE todas as janelas do navegador e tente novamente');
        mainWindowGlobal.webContents.send('log', tabId, '   2. Execute o DLWave como Administrador');
        mainWindowGlobal.webContents.send('log', tabId, '   3. OU use cookies.txt manual (recomendado):');
        mainWindowGlobal.webContents.send('log', tabId, '      • Extensão: "Get cookies.txt LOCALLY"');
        mainWindowGlobal.webContents.send('log', tabId, '      • Configure em Configurações');
        mainWindowGlobal.webContents.send('log', tabId, '');
        return;
      }
      
      // Erro de cookie database locked (navegador aberto)
      const cookieDbError = error.toLowerCase().includes('could not copy chrome cookie database');
      if (cookieDbError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '⚠️ ERRO: Cookie Database Bloqueado!');
        mainWindowGlobal.webContents.send('log', tabId, '🚫 O navegador está ABERTO e bloqueando o acesso aos cookies.');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÃO: Feche TODAS as janelas do navegador e tente novamente.');
        mainWindowGlobal.webContents.send('log', tabId, '');
        return;
      }
      
      // Erro específico do Twitter/X
      const isTwitterErr = url && (url.includes('twitter.com') || url.includes('x.com'));
      const twitterErrors = ['could not send request', 'unable to extract', 'http error 403', 'http error 401', 'nsig extraction failed', 'login required', 'not available', 'unable to download video data', 'failed to download m3u8'];
      const isTwitterError = isTwitterErr && twitterErrors.some(msg => error.toLowerCase().includes(msg));
      
      if (isTwitterError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '🐦 ERRO: O Twitter/X bloqueou o acesso ao vídeo (403).');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÕES (tente na ordem):');
        mainWindowGlobal.webContents.send('log', tabId, '   1. Use cookies do NAVEGADOR (mais confiável):');
        mainWindowGlobal.webContents.send('log', tabId, '      • Faça login no Twitter/X no Chrome/Brave/Edge');
        mainWindowGlobal.webContents.send('log', tabId, '      • FECHE o navegador completamente');
        mainWindowGlobal.webContents.send('log', tabId, '      • Nas Configurações do DLWave → selecione o navegador');
        mainWindowGlobal.webContents.send('log', tabId, '   2. Se já configurou cookies e ainda dá 403:');
        mainWindowGlobal.webContents.send('log', tabId, '      • Certifique-se que o navegador está FECHADO');
        mainWindowGlobal.webContents.send('log', tabId, '      • Atualize o yt-dlp (Configurações → Reinstalar)');
        mainWindowGlobal.webContents.send('log', tabId, '      • O Twitter muda frequentemente, a versão mais nova do yt-dlp pode resolver');
        mainWindowGlobal.webContents.send('log', tabId, '');
        return;
      }
      
      if (isAuthError && mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
        mainWindowGlobal.webContents.send('log', tabId, '🔐 ERRO: Este vídeo requer autenticação (pode ter restrição de idade).');
        mainWindowGlobal.webContents.send('log', tabId, '📌 SOLUÇÃO:');
        mainWindowGlobal.webContents.send('log', tabId, '   1. Abra o Brave/Chrome/Edge e faça LOGIN no YouTube');
        mainWindowGlobal.webContents.send('log', tabId, '   2. Nas Configurações do DLWave:');
        mainWindowGlobal.webContents.send('log', tabId, '      ✓ Selecione o navegador ou adicione cookies.txt');
        mainWindowGlobal.webContents.send('log', tabId, '   3. Tente baixar novamente');
        return; // Não mostrar erro bruto
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
        // Mostrar mensagem de erro completa
        const errorMsg = `❌ yt-dlp encerrou com código ${code}\n\n📋 DETALHES DO ERRO:\n${stderrBuffer || 'Nenhum erro detalhado disponível'}`;
        console.error(errorMsg);
        if (mainWindowGlobal && !mainWindowGlobal.isDestroyed()) {
          mainWindowGlobal.webContents.send('log', tabId, errorMsg);
        }
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
  console.log(`🛑 Cancelamento solicitado para tabId: ${tabId}`);
  const downloadProcess = downloadProcesses.get(tabId);
  
  try {
    // Setar flag de cancelamento SEMPRE (mesmo sem processo ativo)
    downloadCancelledFlags.set(tabId, true);
    console.log(`🚩 Flag de cancelamento setada para tabId: ${tabId}`);
    
    if (downloadProcess) {
      console.log(`💀 Matando processo PID: ${downloadProcess.pid}`);
      // No Windows, precisamos matar o processo de forma mais agressiva
      if (process.platform === 'win32') {
        // Usar taskkill para forçar o encerramento no Windows
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
    }
    
    // NÃO resetar a flag aqui - ela será resetada no início do próximo download
    // (linha downloadCancelledFlags.set(tabId, false) no start-download handler)
    // Resetar cedo demais faz o close event e loops de playlist não detectarem o cancelamento
    
    return { sucesso: true, mensagem: 'Download cancelado' };
  } catch (error) {
    return { sucesso: false, mensagem: `Erro ao cancelar: ${error.message}` };
  }
});

// Handler para salvar preferencias
ipcMain.handle("save-preferences", async (event, prefs) => {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = isDev ? process.cwd() : app.getPath('userData');
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
    const appPath = isDev ? process.cwd() : app.getPath('userData');
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

// Handler para obter versão do app
ipcMain.handle("get-app-version", async () => {
  return app.getVersion();
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
  const deps = await verificarDependencias();
  return deps.todasOk;
});

// Handler para forçar instalação de dependências
ipcMain.handle("install-dependencies", async () => {
  await instalarDepsComUI();
  const deps = await verificarDependencias();
  return deps.todasOk;
});

// Função para criar o tray icon - VERSÃO CORRIGIDA
function createTray() {
  // Carregar o ícone do arquivo assets/tray-icon.png
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const trayIconPath = isDev 
    ? path.join(process.cwd(), 'assets', 'tray-icon.png')
    : path.join(process.resourcesPath, 'assets', 'tray-icon.png');
  
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

  // DEBUG: Abrir DevTools automaticamente para debug
  //mainWindow.webContents.openDevTools();

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
      const appPath = isDev ? process.cwd() : app.getPath('userData');
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

