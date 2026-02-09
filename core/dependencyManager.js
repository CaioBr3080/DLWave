import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminho será definido pelo main.js
let binPath = path.join(__dirname, "..", "bin");

function setBinPath(customPath) {
  binPath = customPath;
}

function depsOk() {
  return (
    fs.existsSync(path.join(binPath, "yt-dlp.exe")) &&
    fs.existsSync(path.join(binPath, "ffmpeg.exe"))
  );
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

  const ytdlpPath = path.join(binPath, "yt-dlp.exe");
  const ffmpegPath = path.join(binPath, "ffmpeg.exe");
  const ffmpegZipPath = path.join(binPath, 'ffmpeg.zip');

  try {
    // Baixar yt-dlp
    onProgress?.({ etapa: 'Baixando yt-dlp...' });
    await downloadFile(
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
      ytdlpPath,
      (prog) => onProgress?.({ etapa: 'yt-dlp', ...prog })
    );

    // Baixar ffmpeg (versão essentials do GitHub)
    onProgress?.({ etapa: 'Baixando ffmpeg (pode demorar)...' });
    await downloadFile(
      'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      ffmpegZipPath,
      (prog) => onProgress?.({ etapa: 'ffmpeg', ...prog })
    );

    // Extrair ffmpeg.exe do ZIP
    onProgress?.({ etapa: 'Extraindo ffmpeg...' });
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

    onProgress?.({ etapa: 'Concluído!', sucesso: true });
    
    return { sucesso: true };
  } catch (error) {
    // Limpar arquivos em caso de erro
    if (fs.existsSync(ffmpegZipPath)) fs.unlinkSync(ffmpegZipPath);
    
    return { sucesso: false, erro: error.message };
  }
}

export { depsOk, binPath, instalarDeps, setBinPath };
