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

// Caminho será definido pelo main.js
let binPath = path.join(__dirname, "..", "bin");

function setBinPath(customPath) {
  binPath = customPath;
}

/**
 * Verifica se winget está disponível no sistema
 */
async function isWingetAvailable() {
  try {
    await execAsync('winget --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verifica se yt-dlp está instalado globalmente
 */
async function isYtdlpGlobal() {
  try {
    const { stdout } = await execAsync('where yt-dlp');
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Instala yt-dlp via winget
 */
async function installYtdlpViaWinget(onProgress) {
  return new Promise((resolve, reject) => {
    onProgress?.({ etapa: 'Instalando yt-dlp via winget...', percent: 0 });
    
    // Usar spawn para capturar saída em tempo real
    const process = spawn('winget', ['install', '--id', 'yt-dlp.yt-dlp', '--accept-source-agreements', '--accept-package-agreements', '--silent'], {
      shell: true
    });
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
      console.log('winget:', data.toString());
      
      // Detectar progresso (winget não tem barra de progresso, então simular)
      if (data.toString().includes('Downloading')) {
        onProgress?.({ etapa: 'Baixando yt-dlp via winget...', percent: 30 });
      } else if (data.toString().includes('Installing')) {
        onProgress?.({ etapa: 'Instalando yt-dlp...', percent: 60 });
      }
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('winget stderr:', data.toString());
    });
    
    process.on('close', async (code) => {
      if (code === 0 || output.includes('successfully installed')) {
        onProgress?.({ etapa: 'yt-dlp instalado via winget!', percent: 100 });
        
        // Aguardar um pouco para PATH atualizar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        resolve({ sucesso: true, metodo: 'winget' });
      } else {
        reject(new Error(`winget falhou com código ${code}: ${errorOutput}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Verificação rápida e síncrona apenas do ffmpeg local
 */
function depsOk() {
  // Verificar se ffmpeg local existe (sempre necessário local)
  const ffmpegLocal = fs.existsSync(path.join(binPath, "ffmpeg.exe"));
  return ffmpegLocal;
}

/**
 * Verificação completa e assíncrona de todas as dependências
 * Retorna objeto com status detalhado
 */
async function verificarDependencias() {
  const ffmpegLocal = fs.existsSync(path.join(binPath, "ffmpeg.exe"));
  const ytdlpLocal = fs.existsSync(path.join(binPath, "yt-dlp.exe"));
  const ytdlpGlobal = await isYtdlpGlobal();
  const ytdlpOk = ytdlpLocal || ytdlpGlobal;
  
  return {
    ffmpeg: ffmpegLocal,
    ytdlp: ytdlpOk,
    ytdlpGlobal,
    ytdlpLocal,
    todasOk: ffmpegLocal && ytdlpOk
  };
}

/**
 * Baixa um arquivo de uma URL
 */
async function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      // Seguir redirecionamentos
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
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

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Instala as dependências (yt-dlp e ffmpeg)
 */
async function instalarDeps(onProgress) {
  // Garantir que a pasta bin existe
  if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
  }

  const ffmpegPath = path.join(binPath, "ffmpeg.exe");
  const ffmpegZipPath = path.join(binPath, 'ffmpeg.zip');

  try {
    let ytdlpMethod = 'none';
    
    // Verificar se yt-dlp já está instalado globalmente
    const ytdlpAlreadyInstalled = await isYtdlpGlobal();
    
    if (ytdlpAlreadyInstalled) {
      onProgress?.({ 
        etapa: '✅ yt-dlp já instalado no sistema!',
        info: 'Detectado yt-dlp no PATH. Pulando instalação.',
        percent: 20
      });
      ytdlpMethod = 'existing';
    } else {
      // Verificar se winget está disponível
      const hasWinget = await isWingetAvailable();
      
      if (hasWinget) {
        onProgress?.({ 
          etapa: '🔍 winget detectado! Instalando yt-dlp globalmente...',
          info: 'O yt-dlp será instalado via Windows Package Manager e adicionado ao PATH do sistema automaticamente.'
        });
        
        try {
          await installYtdlpViaWinget(onProgress);
          ytdlpMethod = 'winget';
          
          onProgress?.({ 
            etapa: '✅ yt-dlp instalado globalmente!',
            info: 'Localização: Gerenciado pelo winget (acessível de qualquer lugar)',
            percent: 40
          });
        } catch (error) {
          console.error('Falha ao instalar via winget:', error);
          
          // Não há fallback - retornar erro
          return { 
            sucesso: false, 
            erro: 'Falha ao instalar yt-dlp via winget',
            detalhes: error.message,
            instrucoes: 'Por favor, instale o yt-dlp manualmente usando um dos métodos:\n\n' +
                       '1. Via winget: winget install yt-dlp.yt-dlp\n' +
                       '2. Via pip: pip install yt-dlp\n' +
                       '3. Via scoop: scoop install yt-dlp\n\n' +
                       'Depois de instalar, reinicie o aplicativo.'
          };
        }
      } else {
        // Sem winget e sem yt-dlp global - não pode continuar
        console.warn('winget não disponível e yt-dlp não encontrado no PATH');
        
        return { 
          sucesso: false, 
          erro: 'Requisitos não atendidos',
          instrucoes: '❌ ERRO: winget não encontrado e yt-dlp não está instalado.\n\n' +
                     '📌 SOLUÇÕES:\n\n' +
                     '1️⃣ INSTALAR WINGET (Recomendado):\n' +
                     '   • Windows 11: Já vem instalado\n' +
                     '   • Windows 10: Baixe em https://aka.ms/getwinget\n' +
                     '   Depois execute o DLWave novamente.\n\n' +
                     '2️⃣ INSTALAR YT-DLP MANUALMENTE:\n' +
                     '   Escolha um método:\n' +
                     '   • Via pip: pip install yt-dlp\n' +
                     '   • Via scoop: scoop install yt-dlp\n' +
                     '   • Via chocolatey: choco install yt-dlp\n\n' +
                     'ℹ️ O yt-dlp precisa estar no PATH do sistema para funcionar corretamente.'
        };
      }
    }

    // Baixar ffmpeg (sempre local para ter ffmpeg-location)
    onProgress?.({ 
      etapa: 'Baixando ffmpeg (pode demorar)...',
      percent: 50,
      info: 'O ffmpeg será instalado localmente para garantir compatibilidade.'
    });
    await downloadFile(
      'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      ffmpegZipPath,
      (prog) => onProgress?.({ etapa: 'ffmpeg', ...prog })
    );

    // Extrair ffmpeg.exe do ZIP
    onProgress?.({ etapa: 'Extraindo ffmpeg...', percent: 90 });
    const zip = new AdmZip(ffmpegZipPath);
    const zipEntries = zip.getEntries();
    
    // Procurar o ffmpeg.exe dentro do ZIP
    const ffmpegEntry = zipEntries.find(entry => 
      entry.entryName.endsWith('bin/ffmpeg.exe')
    );

    if (ffmpegEntry) {
      zip.extractEntryTo(ffmpegEntry, binPath, false, true, false, 'ffmpeg.exe');
    } else {
      throw new Error('ffmpeg.exe não encontrado no arquivo ZIP');
    }

    // Limpar o arquivo ZIP
    fs.unlinkSync(ffmpegZipPath);

    let mensagemFinal = 'Concluído!';
    if (ytdlpMethod === 'winget') {
      mensagemFinal = '✅ Instalação concluída!\n\nyt-dlp: Instalado globalmente via winget (no PATH do sistema)\nffmpeg: Instalado localmente';
    } else if (ytdlpMethod === 'existing') {
      mensagemFinal = '✅ Instalação concluída!\n\nyt-dlp: Já instalado no sistema (detectado no PATH)\nffmpeg: Instalado localmente';
    }
    
    onProgress?.({ 
      etapa: mensagemFinal,
      sucesso: true,
      percent: 100,
      metodo: ytdlpMethod
    });
    
    return { sucesso: true, metodo: ytdlpMethod };
  } catch (error) {
    // Limpar arquivos em caso de erro
    if (fs.existsSync(ffmpegZipPath)) fs.unlinkSync(ffmpegZipPath);
    
    return { sucesso: false, erro: error.message };
  }
}

export { depsOk, binPath, instalarDeps, setBinPath, isWingetAvailable, isYtdlpGlobal, verificarDependencias };
