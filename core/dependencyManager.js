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
    const { stdout } = await execAsync('winget --version');
    console.log('✅ winget encontrado! Versão:', stdout.trim());
    return true;
  } catch (error) {
    console.log('❌ winget NÃO encontrado no sistema');
    return false;
  }
}

/**
 * Verifica se yt-dlp está instalado globalmente via winget
 */
async function isYtdlpGlobal() {
  try {
    // Primeiro: verificar no WinGet Links (local padrão)
    const wingetLinksPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe');
    if (fs.existsSync(wingetLinksPath)) {
      console.log('✅ yt-dlp encontrado via WinGet Links:', wingetLinksPath);
      return true;
    }
    
    // Segundo: verificar na pasta Packages do WinGet
    const packagesPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(packagesPath)) {
      const ytdlpDirs = fs.readdirSync(packagesPath).filter(dir => dir.startsWith('yt-dlp.yt-dlp'));
      for (const dir of ytdlpDirs) {
        const ytdlpExePath = path.join(packagesPath, dir, 'yt-dlp.exe');
        if (fs.existsSync(ytdlpExePath)) {
          console.log('✅ yt-dlp encontrado via WinGet Packages:', ytdlpExePath);
          return true;
        }
      }
    }
    
    // Terceiro: usar where mas validar que é .exe (não script Python)
    try {
      const { stdout } = await execAsync('where yt-dlp');
      const paths = stdout.trim().split('\n');
      for (const p of paths) {
        const cleanPath = p.trim();
        // Aceitar apenas .exe, rejeitar scripts Python (.py, sem extensão no PATH do Python)
        if (cleanPath.toLowerCase().endsWith('.exe') && fs.existsSync(cleanPath)) {
          console.log('✅ yt-dlp.exe encontrado no PATH:', cleanPath);
          return true;
        }
      }
    } catch (error) {
      // where falhou, continuar
    }
    
    console.log('❌ yt-dlp NÃO encontrado (winget ou .exe válido)');
    return false;
  } catch (error) {
    console.log('❌ Erro ao verificar yt-dlp:', error.message);
    return false;
  }
}

/**
 * Instala yt-dlp via winget
 */
async function installYtdlpViaWinget(onProgress) {
  return new Promise((resolve, reject) => {
    console.log('🚀 Iniciando instalação do yt-dlp via winget...');
    onProgress?.({ etapa: 'Instalando yt-dlp via winget...', percent: 10 });
    
    // Usar spawn para capturar saída em tempo real
    const process = spawn('winget', [
      'install', 
      '--id', 'yt-dlp.yt-dlp', 
      '--accept-source-agreements', 
      '--accept-package-agreements'
    ], {
      shell: true,
      windowsHide: false // Mostrar janela para debug
    });
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📦 [winget stdout]:', text);
      
      // Detectar progresso
      if (text.includes('Downloading') || text.includes('Download')) {
        onProgress?.({ etapa: 'Baixando yt-dlp via winget...', percent: 30 });
      } else if (text.includes('Installing') || text.includes('Install')) {
        onProgress?.({ etapa: 'Instalando yt-dlp...', percent: 60 });
      } else if (text.includes('Successfully installed') || text.includes('successfully')) {
        onProgress?.({ etapa: '✅ yt-dlp instalado com sucesso!', percent: 90 });
      }
    });
    
    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error('⚠️ [winget stderr]:', text);
    });
    
    process.on('close', async (code) => {
      console.log(`📋 winget finalizou com código: ${code}`);
      console.log(`📋 Output completo: ${output}`);
      
      if (code === 0 || output.includes('successfully installed') || output.includes('Successfully installed')) {
        onProgress?.({ etapa: 'yt-dlp instalado via winget!', percent: 100 });
        
        console.log('⏳ Aguardando 3s para PATH atualizar...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificar se realmente instalou
        const instalado = await isYtdlpGlobal();
        console.log(`🔍 Verificação pós-instalação: yt-dlp ${instalado ? 'ENCONTRADO' : 'NÃO ENCONTRADO'} no PATH`);
        
        resolve({ sucesso: true, metodo: 'winget' });
      } else {
        console.error(`❌ winget falhou! Código: ${code}`);
        reject(new Error(`winget falhou com código ${code}: ${errorOutput || output}`));
      }
    });
    
    process.on('error', (error) => {
      console.error('❌ Erro ao executar winget:', error);
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
  console.log('🚀 instalarDeps() iniciado...');
  
  // Garantir que a pasta bin existe
  if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
    console.log('📁 Pasta bin criada:', binPath);
  }

  const ffmpegPath = path.join(binPath, "ffmpeg.exe");
  const ffmpegZipPath = path.join(binPath, 'ffmpeg.zip');

  try {
    let ytdlpMethod = 'none';
    
    // Verificar se yt-dlp já está instalado globalmente
    console.log('🔍 Verificando se yt-dlp já está instalado globalmente...');
    const ytdlpAlreadyInstalled = await isYtdlpGlobal();
    
    if (ytdlpAlreadyInstalled) {
      console.log('✅ yt-dlp já instalado! Pulando instalação.');
      onProgress?.({ 
        etapa: '✅ yt-dlp já instalado no sistema!',
        info: 'Detectado yt-dlp no PATH. Pulando instalação.',
        percent: 20
      });
      ytdlpMethod = 'existing';
    } else {
      console.log('❌ yt-dlp não encontrado. Verificando winget...');
      // Verificar se winget está disponível
      const hasWinget = await isWingetAvailable();
      
      if (hasWinget) {
        console.log('✅ winget disponível! Verificando aceitação de termos...');
        
        // onProgressCallback especial para solicitar aceitação dos termos
        const needsTermsAcceptance = await new Promise((resolve) => {
          onProgress?.({
            etapa: '📜 Aguardando aceitação dos termos do yt-dlp...',
            info: 'Uma janela será aberta para você revisar e aceitar os termos de uso.',
            percent: 5,
            requestTermsAcceptance: true, // Sinal especial
            onTermsResponse: resolve
          });
        });
        
        if (!needsTermsAcceptance) {
          console.log('❌ Usuário recusou os termos do yt-dlp');
          return {
            sucesso: false,
            erro: 'Termos do yt-dlp não aceitos',
            cancelado: true
          };
        }
        
        console.log('✅ Termos aceitos! Iniciando instalação do yt-dlp...');
        onProgress?.({ 
          etapa: '🔍 Instalando yt-dlp globalmente via winget...',
          info: 'O yt-dlp será instalado e adicionado ao PATH do sistema automaticamente.',
          percent: 10        });        
        try {
          console.log('📦 Chamando installYtdlpViaWinget()...');
          await installYtdlpViaWinget(onProgress);
          ytdlpMethod = 'winget';
          
          console.log('✅ yt-dlp instalado via winget com sucesso!');
          onProgress?.({ 
            etapa: '✅ yt-dlp instalado globalmente!',
            info: 'Localização: Gerenciado pelo winget (acessível de qualquer lugar)',
            percent: 40
          });
        } catch (error) {
          console.error('❌ Falha ao instalar via winget:', error);
          
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
        console.warn('❌ winget não disponível e yt-dlp não encontrado no PATH');
        
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
