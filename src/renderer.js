// Elementos da UI
const urlInput = document.getElementById('url');
const typeSelect = document.getElementById('type');
const formatSelect = document.getElementById('format');
const resolutionSelect = document.getElementById('resolution');
const pathDisplay = document.getElementById('pathDisplay');
const btnBrowse = document.getElementById('btnBrowse');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnDownload = document.getElementById('btnDownload');
const btnCancelDownload = document.getElementById('btnCancelDownload');
const btnSettings = document.getElementById('btnSettings');
const btnQualityWarning = document.getElementById('btnQualityWarning');
const ignorePlaylistCheckbox = document.getElementById('ignorePlaylist');
const logEl = document.getElementById('log');
const queueArea = document.getElementById('queueArea');
const queueContent = document.getElementById('queueContent');
const queueCount = document.getElementById('queueCount');

// Formatos disponíveis
const formats = {
  video: [
    { value: 'mp4', label: 'MP4 (Recomendado)' },
    { value: 'mkv', label: 'MKV (Alta Qualidade)' },
    { value: 'webm', label: 'WEBM' },
    { value: 'avi', label: 'AVI' },
    { value: 'mov', label: 'MOV' },
    { value: 'flv', label: 'FLV' }
  ],
  audio: [
    { value: 'mp3', label: 'MP3 (Recomendado)' },
    { value: 'm4a', label: 'M4A (AAC)' },
    { value: 'opus', label: 'OPUS (Alta Qualidade)' },
    { value: 'flac', label: 'FLAC (Sem Perda)' },
    { value: 'wav', label: 'WAV' },
    { value: 'aac', label: 'AAC' },
    { value: 'ogg', label: 'OGG Vorbis' }
  ]
};

let downloadPath = '';
let playlistItems = [];
let currentItem = 0;
let isPlaylistDownload = false;

// Funções auxiliares
function updateQueue() {
  if (playlistItems.length === 0) {
    queueArea.style.display = 'none';
    queueContent.textContent = 'Nenhum item na fila';
    queueCount.textContent = '0/0';
  } else {
    queueArea.style.display = 'flex';
    const total = playlistItems.length;
    const remaining = total - currentItem;
    
    if (currentItem < total) {
      const currentTitle = typeof playlistItems[currentItem] === 'string' 
        ? playlistItems[currentItem] 
        : playlistItems[currentItem].title;
      queueContent.textContent = `Próximo: ${currentTitle}`;
    } else {
      queueContent.textContent = 'Todos os itens processados';
    }
    
    queueCount.textContent = `${currentItem}/${total}`;
  }
}

function checkIfPlaylist(url) {
  return url.includes('playlist') || url.includes('&list=') || url.includes('?list=');
}

// Funções de log
function log(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const className = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info';
  logEl.innerHTML += `<span class="${className}">[${timestamp}] ${msg}</span>\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
  logEl.innerHTML = '';
}

// Atualizar formatos quando o tipo mudar
typeSelect.addEventListener('change', () => {
  const type = typeSelect.value;
  formatSelect.innerHTML = '';
  
  formats[type].forEach(format => {
    const option = document.createElement('option');
    option.value = format.value;
    option.textContent = format.label;
    formatSelect.appendChild(option);
  });
  
  // Habilitar/desabilitar resolução baseado no tipo
  if (type === 'video') {
    resolutionSelect.disabled = false;
  } else {
    resolutionSelect.disabled = true;
  }
});

// Escolher pasta de download
btnBrowse.addEventListener('click', async () => {
  const path = await window.api.selectFolder();
  if (path) {
    downloadPath = path;
    pathDisplay.textContent = path;
    pathDisplay.style.color = '#e0e0e0';
    btnOpenFolder.disabled = false;
    log(`Pasta selecionada: ${path}`, 'success');
  }
});

// Abrir pasta de download
btnOpenFolder.addEventListener('click', () => {
  if (downloadPath) {
    window.api.openFolder(downloadPath);
  }
});

// Cancelar download
btnCancelDownload.addEventListener('click', async () => {
  if (isPlaylistDownload) {
    btnCancelDownload.disabled = true;
    btnCancelDownload.textContent = 'Cancelando...';
    log('', 'info');
    log('Cancelando download...', 'error');
    
    try {
      await window.api.cancelDownload();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
    }
    
    // O resto será tratado no catch do download principal
  }
});

// Iniciar download
btnDownload.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  
  // Validações
  if (!url) {
    log('Por favor, insira uma URL', 'error');
    return;
  }
  
  if (!downloadPath) {
    log('Por favor, selecione uma pasta de download', 'error');
    return;
  }
  
  // Verificar se as dependências (yt-dlp e ffmpeg) estão instaladas
  const depsInstalled = await window.api.checkDependencies();
  if (!depsInstalled) {
    log('yt-dlp e FFmpeg não encontrados!', 'error');
    log('Abrindo janela de instalação...', 'info');
    await window.api.installDependencies();
    // Verificar novamente após instalação
    const depsNow = await window.api.checkDependencies();
    if (!depsNow) {
      log('Instalação cancelada ou falhou', 'error');
      return;
    }
    log('Dependências instaladas com sucesso!', 'success');
    log('', 'info');
  }
  
  const type = typeSelect.value;
  const format = formatSelect.value;
  
  // Desabilitar botão durante download
  btnDownload.disabled = true;
  btnDownload.textContent = 'Processando...';
  
  clearLog();
  
  let playlistFolderName = null;
  
  try {
    // Verificar se é uma playlist (mas apenas se não estiver marcado "Ignorar Playlist")
    if (!ignorePlaylistCheckbox.checked && checkIfPlaylist(url)) {
      log('Detectada playlist! Extraindo informações...', 'info');
      isPlaylistDownload = true;
      
      try {
        playlistItems = await window.api.getPlaylistInfo(url);
        currentItem = 0;
        
        log(`Playlist com ${playlistItems.length} itens encontrados`, 'success');
        log('', 'info');
        
        // Solicitar nome da pasta
        log('Solicitando nome da pasta...', 'info');
        playlistFolderName = await window.api.requestPlaylistFolderName(downloadPath);
        
        if (!playlistFolderName) {
          log('⚠ Download cancelado pelo usuário', 'error');
          btnDownload.disabled = false;
          btnDownload.textContent = 'Iniciar Download';
          isPlaylistDownload = false;
          return;
        }
        
        log(`Pasta criada: ${playlistFolderName}`, 'success');
        log('', 'info');
        
        updateQueue();
      } catch (error) {
        log(`Aviso: Não foi possível extrair info da playlist: ${error.message}`, 'error');
        log('Continuando com download normal...', 'info');
        playlistItems = [];
        isPlaylistDownload = false;
      }
    } else {
      if (ignorePlaylistCheckbox.checked && checkIfPlaylist(url)) {
        log('ℹ️ Ignorando playlist - baixando apenas o item individual', 'info');
      }
      playlistItems = [];
      isPlaylistDownload = false;
      updateQueue();
    }
    
    log(`Iniciando download de ${type}...`, 'info');
    log(`URL: ${url}`, 'info');
    log(`Formato: ${format.toUpperCase()}`, 'info');
    if (type === 'video') {
      const resLabel = resolutionSelect.options[resolutionSelect.selectedIndex].text;
      log(`Resolução: ${resLabel}`, 'info');
    }
    log(`Destino: ${downloadPath}`, 'info');
    log('', 'info');
    
    // Carregar preferências para verificar allowLowerQuality
    let prefs = await window.api.loadPreferences();
    let allowLowerQuality = prefs && prefs.allowLowerQuality ? true : false;
    
    // Mostrar botão cancelar se for playlist
    if (isPlaylistDownload) {
      btnCancelDownload.style.display = 'block';
    }
    
    btnDownload.textContent = 'Baixando...';
    
    // Se for playlist de vídeos com resolução específica
    // processar item por item verificando a resolução de cada um (a menos que allowLowerQuality esteja ativo)
    if (isPlaylistDownload && type === 'video' && resolutionSelect.value !== 'best') {
      log('Modo de processamento item por item', 'info');
      log('', 'info');
      
      for (let i = 0; i < playlistItems.length; i++) {
        currentItem = i;
        updateQueue();
        
        const item = playlistItems[i];
        const itemUrl = item.url;
        const itemTitle = item.title;
        
        log(`[${i+1}/${playlistItems.length}] Processando: ${itemTitle}`, 'info');
        
        // Recarregar preferências a cada item (permite mudança durante download)
        prefs = await window.api.loadPreferences();
        allowLowerQuality = prefs && prefs.allowLowerQuality ? true : false;
        
        // Se não permitir qualidade inferior, verificar resolução
        if (!allowLowerQuality) {
          log('Verificando resolução disponível...', 'info');
          const shouldContinue = await window.api.checkResolution(itemUrl, resolutionSelect.value, false);
          
          if (!shouldContinue) {
            log(`⚠ Item pulado: ${itemTitle}`, 'error');
            log('', 'info');
            continue; // Pula este item e vai para o próximo
          }
        } else {
          log('Qualidade inferior permitida - baixando sem verificação', 'info');
        }
        
        // Baixar este item individual
        log(`Baixando: ${itemTitle}`, 'info');
        try {
          await window.api.startDownload({
            url: itemUrl,
            type,
            format,
            resolution: resolutionSelect.value,
            downloadPath: downloadPath,
            playlistFolderName: playlistFolderName,
            isPlaylist: false, // Baixar como item individual, não playlist
            allowLowerQuality: allowLowerQuality,
            ignorePlaylist: ignorePlaylistCheckbox.checked
          });
          log(`✓ Concluído: ${itemTitle}`, 'success');
        } catch (error) {
          // Se foi cancelado ou erro
          if (error.message && error.message.includes('cancelado')) {
            log('⚠ Download cancelado pelo usuário', 'error');
            throw error; // Re-lançar para sair do loop
          }
          log(`✗ Erro ao baixar ${itemTitle}: ${error.message}`, 'error');
        }
        log('', 'info');
      }
      
      log('✓ Todos os itens processados!', 'success');
      
    } else {
      // Download normal (playlist completa de uma vez ou item único)
      
      // Se for vídeo com resolução específica e não permitir qualidade inferior, verificar antes
      if (type === 'video' && resolutionSelect.value !== 'best' && !allowLowerQuality) {
        log('Verificando disponibilidade de resolução...', 'info');
        const shouldContinue = await window.api.checkResolution(url, resolutionSelect.value, allowLowerQuality);
        
        if (!shouldContinue) {
          log('⚠ Download cancelado pelo usuário', 'error');
          btnDownload.disabled = false;
          btnDownload.textContent = 'Iniciar Download';
          
          // Limpar fila se for playlist
          if (isPlaylistDownload) {
            playlistItems = [];
            currentItem = 0;
            updateQueue();
            isPlaylistDownload = false;
          }
          return;
        }
        log('', 'info');
      }
      
      const result = await window.api.startDownload({
        url,
        type,
        format,
        resolution: type === 'video' ? resolutionSelect.value : null,
        downloadPath: downloadPath,
        playlistFolderName: isPlaylistDownload ? playlistFolderName : null,
        isPlaylist: isPlaylistDownload,
        allowLowerQuality: allowLowerQuality,
        playlistItems: isPlaylistDownload ? playlistItems : null,
        ignorePlaylist: ignorePlaylistCheckbox.checked
      });
      
      log('', 'info');
      
      // Verificar se foi cancelado pelo usuário
      if (result && result.sucesso === false) {
        log('⚠ Download cancelado', 'error');
      } else {
        log('✓ Download concluído com sucesso!', 'success');
      }
    }
    
    // Limpar fila após conclusão
    playlistItems = [];
    currentItem = 0;
    updateQueue();
    
  } catch (error) {
    log('', 'info');
    
    // Se foi cancelado, não mostrar como erro
    if (error.message && error.message.includes('cancelado')) {
      log('⚠ ' + error.message, 'error');
      
      // Limpar fila e esconder barra de fila
      playlistItems = [];
      currentItem = 0;
      updateQueue();
    } else {
      log(`✗ Erro: ${error.message}`, 'error');
    }
  } finally {
    btnDownload.disabled = false;
    btnDownload.textContent = 'Iniciar Download';
    btnCancelDownload.style.display = 'none';
    btnCancelDownload.disabled = false;
    btnCancelDownload.textContent = 'Cancelar Download';
    isPlaylistDownload = false;
  }
});

// Listener para logs do processo principal
if (window.api.onLog) {
  window.api.onLog((msg) => {
    log(msg, 'info');
    
    // Atualizar fila quando um download for concluído
    // yt-dlp exibe "[download] Destination:" quando começa a baixar um arquivo
    if (playlistItems.length > 0 && msg.includes('[download] Destination:')) {
      currentItem++;
      updateQueue();
    }
  });
}

// Botão de configurações
btnSettings.addEventListener('click', async () => {
  await showSettingsModal();
});

// Botão de aviso de qualidade (abre configurações)
btnQualityWarning.addEventListener('click', async () => {
  await showSettingsModal();
});

// Função para mostrar modal de configurações
async function showSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = `
    <div class="settings-modal">
      <div class="settings-header">
        <h2>⚙️ Configurações</h2>
        <button class="btn-close-modal" onclick="this.closest('.settings-modal-overlay').remove()">×</button>
      </div>
      <div class="settings-content">
        <div class="settings-section">
          <h3>Preferências Salvas</h3>
          <p class="settings-description">Salvar resolução e pasta de destino atual para próxima vez</p>
          
          <div class="settings-info">
            <div class="info-item">
              <span class="info-label">Resolução Atual:</span>
              <span class="info-value" id="currentResolution">-</span>
            </div>
            <div class="info-item">
              <span class="info-label">Pasta Atual:</span>
              <span class="info-value" id="currentPath">-</span>
            </div>
            <div class="info-item">
              <span class="info-label">Pasta Bin (yt-dlp + FFmpeg):</span>
              <span class="info-value" id="binPath">-</span>
            </div>
            <button class="btn-open-bin" id="btnOpenBin" style="margin-top: 10px;">📁 Abrir Pasta Bin</button>
          </div>
          
          <div class="settings-checkbox">
            <label>
              <input type="checkbox" id="allowLowerQuality" />
              <span>Permitir qualidade inferior!</span>
            </label>
            <p class="checkbox-description">Não perguntar quando a resolução escolhida não estiver disponível em playlists</p>
          </div>
          
          <div class="settings-checkbox">
            <label>
              <input type="checkbox" id="minimizeToTray" />
              <span>Minimizar para bandeja</span>
            </label>
            <p class="checkbox-description">Ao minimizar, o app fica na bandeja do sistema ao invés da barra de tarefas</p>
          </div>
          
          <div class="settings-checkbox">
            <label>
              <input type="checkbox" id="ignorePlaylistPref" />
              <span>Ignorar Playlist por padrão</span>
            </label>
            <p class="checkbox-description">Sempre baixar apenas o vídeo individual, ignorando mixes e playlists automaticamente</p>
          </div>
          
          <button class="btn-save-prefs" id="btnSavePrefs">Salvar Preferências</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Preencher valores atuais
  const currentRes = modal.querySelector('#currentResolution');
  const currentPathEl = modal.querySelector('#currentPath');
  const binPathEl = modal.querySelector('#binPath');
  const btnOpenBin = modal.querySelector('#btnOpenBin');
  
  const resLabel = resolutionSelect.options[resolutionSelect.selectedIndex].text;
  currentRes.textContent = resLabel;
  currentPathEl.textContent = downloadPath || 'Nenhuma pasta selecionada';
  
  // Obter e exibir pasta bin
  const binPath = await window.api.getBinPath();
  binPathEl.textContent = binPath;
  
  // Botão para abrir pasta bin
  btnOpenBin.addEventListener('click', async () => {
    await window.api.openBinFolder();
  });
  
  // Carregar preferências salvas
  const savedPrefs = await window.api.loadPreferences();
  const allowLowerQualityCheckbox = modal.querySelector('#allowLowerQuality');
  const minimizeToTrayCheckbox = modal.querySelector('#minimizeToTray');
  const ignorePlaylistPrefCheckbox = modal.querySelector('#ignorePlaylistPref');
  
  // Sincronizar valor atual da checkbox principal
  ignorePlaylistPrefCheckbox.checked = ignorePlaylistCheckbox.checked;
  
  if (savedPrefs) {
    if (savedPrefs.allowLowerQuality) {
      allowLowerQualityCheckbox.checked = true;
    }
    if (savedPrefs.minimizeToTray) {
      minimizeToTrayCheckbox.checked = true;
    }
    if (savedPrefs.ignorePlaylist) {
      ignorePlaylistPrefCheckbox.checked = true;
    }
  }
  
  // Sincronizar checkboxes em tempo real
  ignorePlaylistPrefCheckbox.addEventListener('change', () => {
    ignorePlaylistCheckbox.checked = ignorePlaylistPrefCheckbox.checked;
  });
  
  // Botão salvar
  modal.querySelector('#btnSavePrefs').addEventListener('click', async () => {
    const allowLowerQualityCheckbox = modal.querySelector('#allowLowerQuality');
    const minimizeToTrayCheckbox = modal.querySelector('#minimizeToTray');
    const ignorePlaylistPrefCheckbox = modal.querySelector('#ignorePlaylistPref');
    const prefs = {
      resolution: resolutionSelect.value,
      downloadPath: downloadPath,
      allowLowerQuality: allowLowerQualityCheckbox.checked,
      minimizeToTray: minimizeToTrayCheckbox.checked,
      ignorePlaylist: ignorePlaylistPrefCheckbox.checked
    };
    
    await window.api.savePreferences(prefs);
    
    // Feedback visual
    const btn = modal.querySelector('#btnSavePrefs');
    const originalText = btn.textContent;
    btn.textContent = '✓ Salvo!';
    btn.style.background = '#4caf50';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  });
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Carregar preferências ao iniciar
async function loadSavedPreferences() {
  try {
    const prefs = await window.api.loadPreferences();
    
    if (prefs) {
      // Restaurar resolução
      if (prefs.resolution) {
        resolutionSelect.value = prefs.resolution;
      }
      
      // Restaurar pasta
      if (prefs.downloadPath) {
        downloadPath = prefs.downloadPath;
        pathDisplay.textContent = prefs.downloadPath;
        pathDisplay.style.color = '#e0e0e0';
        btnOpenFolder.disabled = false;
        log(`Preferências carregadas: ${prefs.downloadPath}`, 'success');
      }
      
      // Restaurar ignorePlaylist
      if (prefs.ignorePlaylist !== undefined) {
        ignorePlaylistCheckbox.checked = prefs.ignorePlaylist;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar preferências:', error);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  log('DLWave pronto para uso', 'success');
  
  // Inicialmente, resolução desabilitada já que vídeo é padrão
  // Mas como vídeo é o padrão, vamos deixar habilitado
  resolutionSelect.disabled = false;
  
  // Carregar preferências salvas
  await loadSavedPreferences();
});
