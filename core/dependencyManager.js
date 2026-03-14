import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AdmZip from 'adm-zip';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWindows = process.platform === 'win32';
const isLinux   = process.platform === 'linux';

// Nomes dos binários dependem da plataforma
const ytdlpBin  = isWindows ? 'yt-dlp.exe'  : 'yt-dlp';
const ffmpegBin = isWindows ? 'ffmpeg.exe'   : 'ffmpeg';

// Caminho será definido pelo main.js
let binPath = path.join(__dirname, "..", "bin");

function setBinPath(customPath) {
  binPath = customPath;
}

// ─── Windows: winget ──────────────────────────────────────────────────────────

async function isWingetAvailable() {
  if (!isWindows) return false;
  try {
    const { stdout } = await execAsync('winget --version');
    console.log('✅ winget encontrado! Versão:', stdout.trim());
    return true;
  } catch {
    console.log('❌ winget NÃO encontrado no sistema');
    return false;
  }
}

async function isYtdlpGlobal() {
  try {
    if (isWindows) {
      // WinGet Links
      const wingetLinksPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe');
      if (fs.existsSync(wingetLinksPath)) {
        console.log('✅ yt-dlp via WinGet Links:', wingetLinksPath);
        return true;
      }
      // WinGet Packages
      const packagesPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
      if (fs.existsSync(packagesPath)) {
        const dirs = fs.readdirSync(packagesPath).filter(d => d.startsWith('yt-dlp.yt-dlp'));
        for (const dir of dirs) {
          const p = path.join(packagesPath, dir, 'yt-dlp.exe');
          if (fs.existsSync(p)) { console.log('✅ yt-dlp via WinGet Packages:', p); return true; }
        }
      }
      // where (PATH)
      try {
        const { stdout } = await execAsync('where yt-dlp');
        for (const p of stdout.trim().split('\n')) {
          const clean = p.trim();
          if (clean.toLowerCase().endsWith('.exe') && fs.existsSync(clean)) {
            console.log('✅ yt-dlp.exe no PATH:', clean); return true;
          }
        }
      } catch { /* ignorar */ }
    } else {
      // Linux/macOS: usar which
      try {
        const { stdout } = await execAsync('which yt-dlp');
        const p = stdout.trim();
        if (p && fs.existsSync(p)) { console.log('✅ yt-dlp no PATH:', p); return true; }
      } catch { /* ignorar */ }
    }
    console.log('❌ yt-dlp NÃO encontrado globalmente');
    return false;
  } catch (error) {
    console.log('❌ Erro ao verificar yt-dlp:', error.message);
    return false;
  }
}

async function installYtdlpViaWinget(onProgress) {
  return new Promise((resolve, reject) => {
    console.log('🚀 Instalando yt-dlp via winget...');
    onProgress?.({ etapa: 'Instalando yt-dlp via winget...', percent: 10 });

    const proc = spawn('winget', [
      'install', '--id', 'yt-dlp.yt-dlp',
      '--accept-source-agreements', '--accept-package-agreements'
    ], { shell: true, windowsHide: false });

    let output = '', errorOutput = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (text.includes('Downloading') || text.includes('Download'))
        onProgress?.({ etapa: 'Baixando yt-dlp via winget...', percent: 30 });
      else if (text.includes('Installing') || text.includes('Install'))
        onProgress?.({ etapa: 'Instalando yt-dlp...', percent: 60 });
      else if (text.toLowerCase().includes('successfully'))
        onProgress?.({ etapa: '✅ yt-dlp instalado!', percent: 90 });
    });
    proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
    proc.on('close', async (code) => {
      if (code === 0 || output.toLowerCase().includes('successfully installed')) {
        onProgress?.({ etapa: 'yt-dlp instalado via winget!', percent: 100 });
        await new Promise(r => setTimeout(r, 3000));
        resolve({ sucesso: true, metodo: 'winget' });
      } else {
        reject(new Error(`winget falhou com código ${code}: ${errorOutput || output}`));
      }
    });
    proc.on('error', reject);
  });
}

// ─── Linux: download direto do binário yt-dlp ────────────────────────────────

async function installYtdlpLinux(onProgress) {
  const ytdlpDest = path.join(binPath, 'yt-dlp');
  console.log('🐧 Baixando yt-dlp (binário Linux) do GitHub Releases...');
  onProgress?.({ etapa: 'Baixando yt-dlp...', percent: 10 });

  await downloadFile(
    'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    ytdlpDest,
    (prog) => onProgress?.({ etapa: 'yt-dlp', ...prog })
  );

  // Tornar executável
  fs.chmodSync(ytdlpDest, 0o755);
  console.log('✅ yt-dlp instalado em:', ytdlpDest);
}

// ─── Verificação rápida (síncrona) ───────────────────────────────────────────

function depsOk() {
  return fs.existsSync(path.join(binPath, ffmpegBin));
}

async function verificarDependencias() {
  const ffmpegLocal = fs.existsSync(path.join(binPath, ffmpegBin));
  const ytdlpLocal  = fs.existsSync(path.join(binPath, ytdlpBin));
  const ytdlpGlobal = await isYtdlpGlobal();
  const ytdlpOk     = ytdlpLocal || ytdlpGlobal;

  return {
    ffmpeg: ffmpegLocal,
    ytdlp: ytdlpOk,
    ytdlpGlobal,
    ytdlpLocal,
    todasOk: ffmpegLocal && ytdlpOk
  };
}

// ─── Download genérico de arquivo ────────────────────────────────────────────

async function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Falha no download: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      const fileStream = fs.createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          onProgress({ downloadedSize, totalSize, percent });
        }
      });
      response.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(); });
      fileStream.on('error', (err) => { try { fs.unlinkSync(destPath); } catch {} reject(err); });
    }).on('error', reject);
  });
}

// ─── Instalação principal ─────────────────────────────────────────────────────

async function instalarDeps(onProgress) {
  console.log('🚀 instalarDeps() iniciado — plataforma:', process.platform);

  if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
    console.log('📁 Pasta bin criada:', binPath);
  }

  const ffmpegPath     = path.join(binPath, ffmpegBin);
  const ffmpegArchive  = path.join(binPath, isWindows ? 'ffmpeg.zip' : 'ffmpeg.tar.xz');

  try {
    let ytdlpMethod = 'none';

    // ── yt-dlp ──────────────────────────────────────────────────────────────
    console.log('🔍 Verificando yt-dlp...');
    const ytdlpAlreadyInstalled = await isYtdlpGlobal();

    if (ytdlpAlreadyInstalled) {
      console.log('✅ yt-dlp já instalado! Pulando.');
      onProgress?.({ etapa: '✅ yt-dlp já instalado no sistema!', info: 'Detectado no PATH.', percent: 20 });
      ytdlpMethod = 'existing';
    } else if (isLinux) {
      // Linux: baixar binário direto (sem necessidade de package manager)
      const ytdlpLocal = path.join(binPath, 'yt-dlp');
      if (fs.existsSync(ytdlpLocal)) {
        console.log('✅ yt-dlp local já existe.');
        onProgress?.({ etapa: '✅ yt-dlp já instalado localmente!', percent: 20 });
        ytdlpMethod = 'existing';
      } else {
        try {
          await installYtdlpLinux(onProgress);
          ytdlpMethod = 'local';
          onProgress?.({ etapa: '✅ yt-dlp instalado!', info: 'Binário local em bin/yt-dlp', percent: 40 });
        } catch (error) {
          console.error('❌ Falha ao baixar yt-dlp para Linux:', error);
          return {
            sucesso: false, erro: 'Falha ao baixar yt-dlp',
            instrucoes: '❌ Não foi possível baixar o yt-dlp automaticamente.\n\n' +
                        '📌 INSTALE MANUALMENTE:\n' +
                        '   sudo apt install yt-dlp\n' +
                        '   OU: sudo pip install yt-dlp\n\n' +
                        'Depois reinicie o DLWave.'
          };
        }
      }
    } else {
      // Windows: usar winget
      const hasWinget = await isWingetAvailable();
      if (hasWinget) {
        const needsTermsAcceptance = await new Promise((resolve) => {
          onProgress?.({
            etapa: '📜 Aguardando aceitação dos termos do yt-dlp...',
            info: 'Uma janela será aberta para você revisar e aceitar os termos de uso.',
            percent: 5,
            requestTermsAcceptance: true,
            onTermsResponse: resolve
          });
        });

        if (!needsTermsAcceptance) {
          return { sucesso: false, erro: 'Termos do yt-dlp não aceitos', cancelado: true };
        }

        onProgress?.({ etapa: '🔍 Instalando yt-dlp via winget...', info: 'Será adicionado ao PATH.', percent: 10 });
        try {
          await installYtdlpViaWinget(onProgress);
          ytdlpMethod = 'winget';
          onProgress?.({ etapa: '✅ yt-dlp instalado globalmente!', info: 'Gerenciado pelo winget.', percent: 40 });
        } catch (error) {
          console.error('❌ Falha ao instalar via winget:', error);
          return {
            sucesso: false, erro: 'Falha ao instalar yt-dlp via winget',
            instrucoes: 'Instale manualmente:\n\n' +
                        '  winget install yt-dlp.yt-dlp\n' +
                        '  OU: pip install yt-dlp\n' +
                        '  OU: scoop install yt-dlp\n\n' +
                        'Depois reinicie o aplicativo.'
          };
        }
      } else {
        return {
          sucesso: false, erro: 'Requisitos não atendidos',
          instrucoes: '❌ winget não encontrado e yt-dlp não está instalado.\n\n' +
                      '📌 SOLUÇÕES:\n\n' +
                      '1️⃣ INSTALAR WINGET:\n' +
                      '   • Windows 11: já vem instalado\n' +
                      '   • Windows 10: https://aka.ms/getwinget\n\n' +
                      '2️⃣ INSTALAR YT-DLP MANUALMENTE:\n' +
                      '   pip install yt-dlp  OU  scoop install yt-dlp\n\n' +
                      'Depois reinicie o aplicativo.'
        };
      }
    }

    // ── ffmpeg ───────────────────────────────────────────────────────────────
    onProgress?.({ etapa: 'Baixando ffmpeg (pode demorar)...', percent: 50, info: 'Instalação local.' });

    if (isWindows) {
      await downloadFile(
        'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
        ffmpegArchive,
        (prog) => onProgress?.({ etapa: 'ffmpeg', ...prog })
      );
      onProgress?.({ etapa: 'Extraindo ffmpeg...', percent: 90 });
      const zip = new AdmZip(ffmpegArchive);
      const ffmpegEntry = zip.getEntries().find(e => e.entryName.endsWith('bin/ffmpeg.exe'));
      if (!ffmpegEntry) throw new Error('ffmpeg.exe não encontrado no ZIP');
      zip.extractEntryTo(ffmpegEntry, binPath, false, true, false, 'ffmpeg.exe');
    } else {
      // Linux: baixar tar.xz e extrair com tar
      await downloadFile(
        'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
        ffmpegArchive,
        (prog) => onProgress?.({ etapa: 'ffmpeg', ...prog })
      );
      onProgress?.({ etapa: 'Extraindo ffmpeg...', percent: 90 });
      const extractDir = path.join(binPath, '_ffmpeg_extract');
      if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });
      // Extrair arquivo tar.xz
      await execAsync(`tar -xJf "${ffmpegArchive}" -C "${extractDir}"`);
      // Encontrar o binário ffmpeg dentro da pasta extraída
      const findBinary = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findBinary(fullPath);
            if (found) return found;
          } else if (entry.name === 'ffmpeg' && entry.isFile()) {
            return fullPath;
          }
        }
        return null;
      };
      const foundBin = findBinary(extractDir);
      if (!foundBin) throw new Error('ffmpeg não encontrado no arquivo tar.xz');
      fs.copyFileSync(foundBin, ffmpegPath);
      fs.chmodSync(ffmpegPath, 0o755);
      // Limpar pasta temporária
      fs.rmSync(extractDir, { recursive: true, force: true });
    }

    fs.unlinkSync(ffmpegArchive);

    const mensagemFinal = ytdlpMethod === 'winget'
      ? '✅ Concluído!\n\nyt-dlp: via winget (PATH do sistema)\nffmpeg: instalado localmente'
      : ytdlpMethod === 'local'
      ? '✅ Concluído!\n\nyt-dlp: binário local (bin/yt-dlp)\nffmpeg: instalado localmente'
      : '✅ Concluído!\n\nyt-dlp: já estava instalado\nffmpeg: instalado localmente';

    onProgress?.({ etapa: mensagemFinal, sucesso: true, percent: 100, metodo: ytdlpMethod });
    return { sucesso: true, metodo: ytdlpMethod };
  } catch (error) {
    try { fs.unlinkSync(ffmpegArchive); } catch {}
    console.error('❌ Erro em instalarDeps:', error);
    onProgress?.({ etapa: `❌ Erro: ${error.message}`, sucesso: false, percent: 0 });
    return { sucesso: false, erro: error.message };
  }
}

export {
  binPath,
  setBinPath,
  depsOk,
  verificarDependencias,
  instalarDeps
};
