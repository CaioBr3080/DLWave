// ============================================
// SISTEMA DE TRADUÇÕES
// ============================================
import { t, setLanguage, currentLanguage } from './translations.js';

// ============================================
// SISTEMA DE TABS - GERENCIADOR
// ============================================

class TabManager {
  constructor() {
    this.tabs = new Map(); // Map<tabId, tabData>
    this.activeTabId = null;
    this.tabCounter = 0;
    
    // Elementos principais
    this.tabsContainer = document.getElementById('tabsContainer');
    this.tabsContent = document.getElementById('tabsContent');
    this.btnNewTab = document.getElementById('btnNewTab');
    this.tabTemplate = document.getElementById('tabTemplate');
    this.contextMenu = document.getElementById('contextMenu');
    
    // Inicializar
    this.init();
  }
  
  async init() {
    // Carregar tabs salvas ou criar primeira tab
    await this.loadTabsState();
    
    // Registrar handler para verificar downloads ao fechar app
    window.api.onBeforeQuit(async () => {
      const activeDownloads = this.checkActiveDownloads();
      
      if (activeDownloads.length > 0) {
        const tabList = activeDownloads.map(name => `• ${name}`).join('\n');
        
        const userConfirmed = await showConfirmDialog({
          type: 'warning',
          title: t('downloadsActiveTitle'),
          message: t('downloadsActiveMessage', { count: activeDownloads.length }),
          detail: `${tabList}\n\n${t('downloadsActiveDetail')}`,
          cancelLabel: t('cancel'),
          confirmLabel: t('closeApp')
        });
        
        return userConfirmed;
      }
      
      return true; // Sem downloads ativos, pode fechar
    });
    
    // Event listeners
    this.btnNewTab.addEventListener('click', async () => {
      const tabName = this.getNextTabName();
      await this.createTab(tabName);
    });
    
    // Fechar menu de contexto ao clicar fora
    document.addEventListener('click', () => {
      this.contextMenu.style.display = 'none';
    });
    
    // Listener de logs do main process
    window.api.onLog((tabId, message) => {
      this.logToTab(tabId, message);
    });
    
    // Listener de erro de arquivo em uso
    window.api.onFileInUseError((tabId, fileName) => {
      showFileInUseWarning(fileName);
    });
  }
  
  getNextTabName() {
    return t('newTab');
  }
  
  async createTab(name, autoActivate = true) {
    const tabId = `tab-${this.tabCounter++}`;
    
    // Criar elemento da tab na barra
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tabId;
    tabElement.innerHTML = `
      <span class="tab-label">${name}</span>
    `;
    
    // Clonar template do conteúdo
    const clone = this.tabTemplate.content.cloneNode(true);
    const contentElement = clone.querySelector('.tab-content');
    
    if (!contentElement) {
      console.error('ERRO: Não conseguiu clonar o template!');
      return;
    }
    
    contentElement.dataset.tabId = tabId;
    contentElement.id = `content-${tabId}`; // ID único para debug
    
    console.log(`Criando tab ${tabId} - Elemento content:`, contentElement);
    
    // Adicionar ao DOM
    this.tabsContainer.appendChild(tabElement);
    this.tabsContent.appendChild(contentElement);
    
    // Verificar se foi adicionado
    const verificacao = document.getElementById(`content-${tabId}`);
    console.log(`Tab ${tabId} adicionada ao DOM? ${verificacao ? 'SIM' : 'NÃO'}`);
    
    // Carregar preferências globais
    const savedPrefs = await window.api.loadPreferences();
    const ignorePlaylistDefault = savedPrefs?.ignorePlaylistGlobal || false;
    
    console.log('🆕 Criando nova tab - savedPrefs:', savedPrefs);
    
    // Criar dados da tab
    const tabData = {
      id: tabId,
      name: name,
      element: tabElement,
      content: contentElement,
      state: {
        url: '',
        type: 'video',
        format: 'mp4',
        resolution: 'best',
        downloadPath: '',
        ignorePlaylist: ignorePlaylistDefault,
        allowLowerQuality: false, // Padrão sempre false (sempre perguntar)
        isPlaylistDownload: false,
        playlistItems: [],
        currentItem: 0,
        downloadProcess: null,
        cancelRequested: false
      }
    };
    
    // Salvar tab
    this.tabs.set(tabId, tabData);
    
    // Event listeners da tab
    this.setupTabEvents(tabData);
    
    // Inicializar estado visual
    this.restoreTabInputState(tabId);
    
    // Ativar tab se necessário
    if (autoActivate) {
      this.switchTab(tabId);
    }
    
    // Salvar estado
    this.saveTabsState();
    
    return tabId;
  }
  
  setupTabEvents(tabData) {
    const { id, element, content } = tabData;
    
    // Click para ativar tab
    element.addEventListener('click', () => {
      this.switchTab(id);
    });
    
    // Menu de contexto (botão direito)
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, id);
    });
    
    // Event listeners dos elementos do conteúdo
    this.setupContentEvents(tabData);
  }
  
  setupContentEvents(tabData) {
    const { id, content, state } = tabData;
    
    console.log(`=== Setup events para tab ${id} ===`);
    
    // Elementos do conteúdo
    const urlInput = content.querySelector('.url-input');
    const typeSelect = content.querySelector('.type-select');
    const formatSelect = content.querySelector('.format-select');
    const resolutionSelect = content.querySelector('.resolution-select');
    const pathDisplay = content.querySelector('.path-display');
    const btnBrowse = content.querySelector('.btn-browse');
    const btnOpenFolder = content.querySelector('.btn-open-folder');
    const btnDownload = content.querySelector('.btn-download');
    const btnCancelDownload = content.querySelector('.btn-cancel-download');
    const ignorePlaylistCheckbox = content.querySelector('.ignorePlaylist-input');
    const btnQualityWarning = content.querySelector('.btn-quality-warning');
    
    // Inicializar checkbox de ignorar playlist com o estado da tab
    if (ignorePlaylistCheckbox) {
      ignorePlaylistCheckbox.checked = state.ignorePlaylist || false;
    }
    
    // Debug: verificar se os elementos foram encontrados
    console.log(`Tab ${id} - urlInput encontrado?`, urlInput !== null);
    console.log(`Tab ${id} - urlInput é único? ID pai:`, urlInput?.closest('.tab-content')?.id);
    
    // Adicionar ID único ao input para debug
    if (urlInput) {
      urlInput.dataset.tabId = id;
    }
    
    // Botão de qualidade inferior
    btnQualityWarning.addEventListener('click', async () => {
      // Verificar se há download em andamento
      const isDownloading = btnCancelDownload && btnCancelDownload.style.display !== 'none';
      
      if (isDownloading) {
        // Cancelar download atual e reiniciar com nova configuração
        const newValue = !state.allowLowerQuality;
        const action = newValue ? 'ativar' : 'desativar';
        
        const confirmed = await showConfirmDialog({
          type: 'warning',
          title: 'Download em andamento',
          message: `Deseja ${action} "Permitir qualidade inferior" e reiniciar o download?`,
          detail: 'O download será cancelado e reiniciado do zero com a nova configuração.',
          cancelLabel: 'Não',
          confirmLabel: 'Sim, reiniciar'
        });
        
        if (confirmed) {
          // Cancelar download
          await this.cancelDownload(id);
          
          // Atualizar configuração
          state.allowLowerQuality = newValue;
          if (state.allowLowerQuality) {
            btnQualityWarning.style.color = '#4caf50';
            btnQualityWarning.style.borderColor = '#4caf50';
            btnQualityWarning.title = 'Permitir qualidade inferior: ATIVADO';
          } else {
            btnQualityWarning.style.color = '#999';
            btnQualityWarning.style.borderColor = '#3a3a3a';
            btnQualityWarning.title = 'Permitir qualidade inferior: DESATIVADO';
          }
          this.saveTabsState();
          
          // Reiniciar download
          this.logToTab(id, `ℹ️ Reiniciando download com "Permitir qualidade inferior" ${state.allowLowerQuality ? 'ativado' : 'desativado'}...`, 'info');
          await new Promise(resolve => setTimeout(resolve, 500)); // Pequeno delay para garantir cancelamento
          await this.startDownload(id);
        }
      } else {
        // Sem download em andamento - apenas alternar
        state.allowLowerQuality = !state.allowLowerQuality;
        if (state.allowLowerQuality) {
          btnQualityWarning.style.color = '#4caf50';
          btnQualityWarning.style.borderColor = '#4caf50';
          btnQualityWarning.title = 'Permitir qualidade inferior: ATIVADO';
          this.logToTab(id, 'ℹ️ Modo "Permitir qualidade inferior" ativado', 'info');
        } else {
          btnQualityWarning.style.color = '#999';
          btnQualityWarning.style.borderColor = '#3a3a3a';
          btnQualityWarning.title = 'Permitir qualidade inferior: DESATIVADO';
          this.logToTab(id, 'ℹ️ Modo "Permitir qualidade inferior" desativado', 'info');
        }
        this.saveTabsState();
      }
    });
    
    // Inicializar aparência visual do botão baseado no estado inicial
    if (state.allowLowerQuality) {
      btnQualityWarning.style.color = '#4caf50';
      btnQualityWarning.style.borderColor = '#4caf50';
      btnQualityWarning.title = 'Permitir qualidade inferior: ATIVADO';
    } else {
      btnQualityWarning.style.color = '#999';
      btnQualityWarning.style.borderColor = '#3a3a3a';
      btnQualityWarning.title = 'Permitir qualidade inferior: DESATIVADO';
    }
    
    // Formatos disponíveis
    const formats = {
      video: [
        { value: 'mp4', label: t('formatMp4') },
        { value: 'mkv', label: t('formatMkv') },
        { value: 'webm', label: t('formatWebm') },
        { value: 'avi', label: t('formatAvi') },
        { value: 'mov', label: t('formatMov') },
        { value: 'flv', label: t('formatFlv') }
      ],
      audio: [
        { value: 'mp3', label: t('formatMp3') },
        { value: 'm4a', label: t('formatM4a') },
        { value: 'opus', label: t('formatOpus') },
        { value: 'flac', label: t('formatFlac') },
        { value: 'wav', label: t('formatWav') },
        { value: 'aac', label: t('formatAac') },
        { value: 'ogg', label: t('formatOgg') }
      ]
    };
    
    // Atualizar formatos quando tipo mudar
    typeSelect.addEventListener('change', () => {
      const type = typeSelect.value;
      state.type = type;
      formatSelect.innerHTML = '';
      
      formats[type].forEach(format => {
        const option = document.createElement('option');
        option.value = format.value;
        option.textContent = format.label;
        formatSelect.appendChild(option);
      });
      
      state.format = formatSelect.value;
      resolutionSelect.disabled = (type === 'audio');
    });
    
    // Inicializar formatos baseado no tipo atual
    const initialType = typeSelect.value || state.type;
    formatSelect.innerHTML = '';
    formats[initialType].forEach(format => {
      const option = document.createElement('option');
      option.value = format.value;
      option.textContent = format.label;
      if (format.value === state.format) {
        option.selected = true;
      }
      formatSelect.appendChild(option);
    });
    resolutionSelect.disabled = (initialType === 'audio');
    
    // Salvar estados
    urlInput.addEventListener('input', (e) => {
      const inputElement = e.target;
      const valorAntigo = state.url;
      state.url = inputElement.value;
      console.log(`Tab ${id}: URL mudou de "${valorAntigo}" para "${state.url}"`);
      console.log(`  - Elemento input pertence à tab:`, inputElement.dataset.tabId);
      console.log(`  - State atual completo:`, state);
    });
    
    typeSelect.addEventListener('change', () => {
      state.type = typeSelect.value;
      console.log(`Tab ${id}: Tipo atualizado para "${state.type}"`);
      this.saveTabsState();
    });
    
    formatSelect.addEventListener('change', () => {
      state.format = formatSelect.value;
      console.log(`Tab ${id}: Formato atualizado para "${state.format}"`);
      this.saveTabsState();
    });
    
    resolutionSelect.addEventListener('change', () => {
      state.resolution = resolutionSelect.value;
      console.log(`Tab ${id}: Resolução atualizada para "${state.resolution}"`);
      this.saveTabsState();
    });
    
    ignorePlaylistCheckbox.addEventListener('change', () => {
      state.ignorePlaylist = ignorePlaylistCheckbox.checked;
      console.log(`Tab ${id}: Ignorar playlist = ${state.ignorePlaylist}`);
      this.saveTabsState();
    });
    
    // Escolher pasta
    btnBrowse.addEventListener('click', async () => {
      const folder = await window.api.selectFolder();
      if (folder) {
        state.downloadPath = folder;
        pathDisplay.textContent = folder;
        btnOpenFolder.disabled = false;
        // Salvar estado imediatamente após selecionar pasta
        this.saveTabsState();
      }
    });
    
    // Abrir pasta
    btnOpenFolder.addEventListener('click', async () => {
      if (state.downloadPath) {
        await window.api.openFolder(state.downloadPath);
      }
    });
    
    // Iniciar download
    btnDownload.addEventListener('click', async () => {
      await this.startDownload(id);
    });
    
    // Cancelar download
    btnCancelDownload.addEventListener('click', async () => {
      await this.cancelDownload(id);
    });
  }
  
  switchTab(tabId) {
    console.log(`Trocando para tab: ${tabId}`);
    
    // Desativar tab anterior
    if (this.activeTabId) {
      const prevTab = this.tabs.get(this.activeTabId);
      if (prevTab) {
        prevTab.element.classList.remove('active');
        prevTab.content.classList.remove('active');
        // Salvar estado atual antes de trocar
        this.saveTabInputState(this.activeTabId);
        console.log(`Estado salvo da tab ${this.activeTabId}:`, prevTab.state);
      }
    }
    
    // Ativar nova tab
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.element.classList.add('active');
      tab.content.classList.add('active');
      this.activeTabId = tabId;
      
      console.log(`Estado da tab ${tabId} antes de restaurar:`, tab.state);
      // Restaurar estado visual da tab
      this.restoreTabInputState(tabId);
      
      // Salvar estado da tab ativa
      this.saveTabsState();
    }
  }
  
  saveTabInputState(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const { content, state } = tab;
    
    // Salvar valores dos inputs no state
    const urlInput = content.querySelector('.url-input');
    const typeSelect = content.querySelector('.type-select');
    const formatSelect = content.querySelector('.format-select');
    const resolutionSelect = content.querySelector('.resolution-select');
    const ignorePlaylistCheckbox = content.querySelector('.ignorePlaylist-input');
    
    if (urlInput) state.url = urlInput.value;
    if (typeSelect) state.type = typeSelect.value;
    if (formatSelect) state.format = formatSelect.value;
    if (resolutionSelect) state.resolution = resolutionSelect.value;
    if (ignorePlaylistCheckbox) state.ignorePlaylist = ignorePlaylistCheckbox.checked;
  }
  
  restoreTabInputState(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const { content, state } = tab;
    
    console.log(`=== Restaurando estado da tab ${tabId} ===`);
    console.log(`Estado a restaurar:`, state);
    
    // Restaurar valores do state nos inputs
    const urlInput = content.querySelector('.url-input');
    const typeSelect = content.querySelector('.type-select');
    const formatSelect = content.querySelector('.format-select');
    const resolutionSelect = content.querySelector('.resolution-select');
    const pathDisplay = content.querySelector('.path-display');
    const btnOpenFolder = content.querySelector('.btn-open-folder');
    const ignorePlaylistCheckbox = content.querySelector('.ignorePlaylist-input');
    
    if (urlInput) {
      const valorAnterior = urlInput.value;
      urlInput.value = state.url || '';
      console.log(`  URL: "${valorAnterior}" → "${urlInput.value}"`);
    }
    if (typeSelect) {
      typeSelect.value = state.type || 'video';
    }
    if (formatSelect) {
      // Repopular formatos baseado no tipo antes de definir o valor
      const currentType = state.type || 'video';
      const formats = {
        video: [
          { value: 'mp4', label: t('formatMp4') },
          { value: 'mkv', label: t('formatMkv') },
          { value: 'webm', label: t('formatWebm') },
          { value: 'avi', label: t('formatAvi') },
          { value: 'mov', label: t('formatMov') },
          { value: 'flv', label: t('formatFlv') }
        ],
        audio: [
          { value: 'mp3', label: t('formatMp3') },
          { value: 'm4a', label: t('formatM4a') },
          { value: 'opus', label: t('formatOpus') },
          { value: 'flac', label: t('formatFlac') },
          { value: 'wav', label: t('formatWav') },
          { value: 'aac', label: t('formatAac') },
          { value: 'ogg', label: t('formatOgg') }
        ]
      };
      
      formatSelect.innerHTML = '';
      formats[currentType].forEach(format => {
        const option = document.createElement('option');
        option.value = format.value;
        option.textContent = format.label;
        formatSelect.appendChild(option);
      });
      
      formatSelect.value = state.format || (currentType === 'audio' ? 'mp3' : 'mp4');
    }
    if (resolutionSelect) {
      resolutionSelect.value = state.resolution || 'best';
      resolutionSelect.disabled = (state.type === 'audio');
    }
    if (pathDisplay) {
      pathDisplay.textContent = state.downloadPath || 'Nenhuma pasta selecionada';
    }
    if (btnOpenFolder) {
      btnOpenFolder.disabled = !state.downloadPath;
    }
    if (ignorePlaylistCheckbox) {
      ignorePlaylistCheckbox.checked = state.ignorePlaylist || false;
    }
    
    // Restaurar aparência do botão allowLowerQuality
    const btnQualityWarning = content.querySelector('.btn-quality-warning');
    if (btnQualityWarning) {
      if (state.allowLowerQuality) {
        btnQualityWarning.style.color = '#4caf50';
        btnQualityWarning.style.borderColor = '#4caf50';
        btnQualityWarning.title = 'Permitir qualidade inferior: ATIVADO';
      } else {
        btnQualityWarning.style.color = '#999';
        btnQualityWarning.style.borderColor = '#3a3a3a';
        btnQualityWarning.title = 'Permitir qualidade inferior: DESATIVADO';
      }
    }
    
    console.log(`Restauração concluída para tab ${tabId}`);
  }
  
  async removeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    // Verificar se há download ativo
    const btnCancelDownload = tab.content.querySelector('.btn-cancel-download');
    const isDownloading = btnCancelDownload && btnCancelDownload.style.display !== 'none';
    
    if (isDownloading) {
      // Pedir confirmação com diálogo customizado
      const userConfirmed = await showConfirmDialog({
        type: 'warning',
        title: t('closeTabTitle'),
        message: t('closeTabMessage'),
        detail: t('closeTabDetail'),
        cancelLabel: t('cancel'),
        confirmLabel: t('closeTab')
      });
      
      if (!userConfirmed) {
        return; // Cancelar remoção
      }
      
      // Cancelar download
      window.api.cancelDownload(tabId);
    }
    
    // Remover elementos do DOM
    tab.element.remove();
    tab.content.remove();
    
    // Remover do Map
    this.tabs.delete(tabId);
    
    // Se era a tab ativa, ativar outra (se houver)
    if (this.activeTabId === tabId) {
      const firstTab = Array.from(this.tabs.keys())[0];
      if (firstTab) {
        this.switchTab(firstTab);
      } else {
        // Não há mais tabs
        this.activeTabId = null;
      }
    }
    
    // Salvar estado
    this.saveTabsState();
  }
  
  renameTab(tabId, newName) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    tab.name = newName;
    
    // Procurar por input (se estiver editando) ou label
    const input = tab.element.querySelector('.tab-rename-input');
    if (input) {
      // Substituir input por label
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = newName;
      input.replaceWith(label);
    } else {
      const label = tab.element.querySelector('.tab-label');
      if (label) {
        label.textContent = newName;
      }
    }
    
    // Salvar estado
    this.saveTabsState();
  }
  
  showContextMenu(event, tabId) {
    const menu = this.contextMenu;
    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    
    // Remover listeners antigos
    const menuRename = document.getElementById('contextMenuRename');
    const menuClose = document.getElementById('contextMenuClose');
    
    const newMenuRename = menuRename.cloneNode(true);
    const newMenuClose = menuClose.cloneNode(true);
    
    menuRename.parentNode.replaceChild(newMenuRename, menuRename);
    menuClose.parentNode.replaceChild(newMenuClose, menuClose);
    
    // Adicionar novos listeners
    newMenuRename.addEventListener('click', () => {
      this.enableTabRename(tabId);
      menu.style.display = 'none';
    });
    
    newMenuClose.addEventListener('click', async () => {
      await this.removeTab(tabId);
      menu.style.display = 'none';
    });
  }
  
  enableTabRename(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const label = tab.element.querySelector('.tab-label');
    const currentName = tab.name;
    
    // Criar input de edição
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'tab-rename-input';
    
    // Substituir label por input
    label.replaceWith(input);
    input.focus();
    input.select();
    
    // Função para finalizar edição
    const finishRename = () => {
      const newName = input.value.trim();
      if (newName) {
        this.renameTab(tabId, newName);
      } else {
        // Restaurar nome original se vazio
        const newLabel = document.createElement('span');
        newLabel.className = 'tab-label';
        newLabel.textContent = currentName;
        input.replaceWith(newLabel);
      }
    };
    
    // Enter para confirmar
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishRename();
      } else if (e.key === 'Escape') {
        // Cancelar edição
        const newLabel = document.createElement('span');
        newLabel.className = 'tab-label';
        newLabel.textContent = currentName;
        input.replaceWith(newLabel);
      }
    });
    
    // Perder foco para confirmar
    input.addEventListener('blur', finishRename);
  }
  
  saveTabsState() {
    const tabsArray = Array.from(this.tabs.values());
    const activeIndex = tabsArray.findIndex(tab => tab.id === this.activeTabId);
    
    const tabsState = {
      tabs: tabsArray.map(tab => ({
        name: tab.name,
        state: {
          url: tab.state.url || '',
          type: tab.state.type || 'video',
          format: tab.state.format || 'mp4',
          resolution: tab.state.resolution || 'best',
          downloadPath: tab.state.downloadPath || '',
          ignorePlaylist: tab.state.ignorePlaylist || false,
          allowLowerQuality: tab.state.allowLowerQuality === true ? true : false
        }
      })),
      activeIndex: activeIndex >= 0 ? activeIndex : 0
    };
    
    localStorage.setItem('dlwave_tabs', JSON.stringify(tabsState));
  }
  
  async loadTabsState() {
    try {
      const saved = localStorage.getItem('dlwave_tabs');
      if (saved) {
        const tabsState = JSON.parse(saved);
        
        // Compatibilidade com formato antigo (array simples)
        if (Array.isArray(tabsState) && tabsState.length > 0) {
          for (let index = 0; index < tabsState.length; index++) {
            const tabData = tabsState[index];
            const tabId = await this.createTab(tabData.name, false);
            if (index === tabsState.length - 1) {
              this.switchTab(tabId);
            }
          }
          return;
        }
        
        // Formato novo (objeto com tabs e activeIndex)
        if (tabsState.tabs && tabsState.tabs.length > 0) {
          const createdTabs = [];
          
          for (const tabData of tabsState.tabs) {
            const tabId = await this.createTab(tabData.name, false);
            createdTabs.push(tabId);
            
            // Restaurar estado salvo se existir
            if (tabData.state) {
              const tab = this.tabs.get(tabId);
              if (tab) {
                tab.state.url = tabData.state.url || '';
                tab.state.type = tabData.state.type || 'video';
                tab.state.format = tabData.state.format || 'mp4';
                tab.state.resolution = tabData.state.resolution || 'best';
                tab.state.downloadPath = tabData.state.downloadPath || '';
                tab.state.ignorePlaylist = tabData.state.ignorePlaylist || false;
                // Restaurar estado salvo da Wave OU usar false como padrão
                tab.state.allowLowerQuality = tabData.state.allowLowerQuality === true ? true : false;
                
                console.log(`Tab ${tabId} restaurada com allowLowerQuality:`, tab.state.allowLowerQuality);
                
                // Atualizar elementos visuais com o estado carregado
                this.restoreTabInputState(tabId);
              }
            }
          }
          
          // Ativar a tab que estava ativa
          const activeIndex = tabsState.activeIndex || 0;
          const tabToActivate = createdTabs[activeIndex] || createdTabs[0];
          if (tabToActivate) {
            this.switchTab(tabToActivate);
          }
          
          return;
        }
        
        // Se há dados salvos mas nenhuma tab (array vazio), não criar tab padrão
        if (tabsState.tabs && tabsState.tabs.length === 0) {
          return;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tabs:', error);
    }
    
    // Não criar tab padrão automaticamente - usuário pode usar o botão "+"
  }
  
  async startDownload(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const { state, content } = tab;
    const logArea = content.querySelector('.log-area');
    const btnDownload = content.querySelector('.btn-download');
    const btnCancelDownload = content.querySelector('.btn-cancel-download');
    
    // Carregar preferências para obter caminho padrão
    const prefs = await window.api.loadPreferences();
    
    // Validações
    if (!state.url) {
      this.logToTab(tabId, '⚠️ Digite uma URL válida', 'error');
      return;
    }
    
    // Usar caminho padrão se não houver caminho configurado
    let downloadPath = state.downloadPath;
    if (!downloadPath && prefs?.defaultDownloadPath) {
      downloadPath = prefs.defaultDownloadPath;
      this.logToTab(tabId, `ℹ️ Usando pasta padrão: ${downloadPath}`, 'info');
    }
    
    if (!downloadPath) {
      this.logToTab(tabId, '⚠️ Selecione uma pasta de download ou configure uma pasta padrão nas configurações', 'error');
      return;
    }
    
    // Atualizar UI e resetar flag de cancelamento
    btnDownload.style.display = 'none';
    btnCancelDownload.style.display = 'inline-block';
    logArea.innerHTML = '';
    state.cancelRequested = false;
    
    try {
      // Verificar se é playlist
      const isPlaylist = !state.ignorePlaylist && this.checkIfPlaylist(state.url);
      
      if (isPlaylist) {
        this.logToTab(tabId, 'ℹ️ Detectado link de playlist/mix', 'info');
        this.logToTab(tabId, '🔍 Extraindo informações da playlist...', 'info');
        
        state.playlistItems = await window.api.getPlaylistInfo(state.url);
        
        // Verificar se foi cancelado durante a extração
        if (state.cancelRequested) {
          this.logToTab(tabId, '❌ Download cancelado', 'error');
          btnDownload.style.display = 'inline-block';
          btnCancelDownload.style.display = 'none';
          return;
        }
        
        state.isPlaylistDownload = true;
        state.currentItem = 0;
        
        this.logToTab(tabId, `✓ Playlist com ${state.playlistItems.length} itens detectada!`, 'success');
        
        // Mostrar barra de fila
        this.updateQueueDisplay(tabId);
        
        // Verificar se deve criar pasta para playlist
        let folderName = null;
        if (!prefs?.noPlaylistFolder) {
          // Pedir nome da pasta
          folderName = await window.api.requestPlaylistFolderName(downloadPath);
          
          // Verificar se foi cancelado durante a solicitação do nome
          if (state.cancelRequested) {
            this.logToTab(tabId, '❌ Download cancelado', 'error');
            btnDownload.style.display = 'inline-block';
            btnCancelDownload.style.display = 'none';
            return;
          }
          
          if (!folderName) {
            this.logToTab(tabId, '❌ Download cancelado', 'error');
            btnDownload.style.display = 'inline-block';
            btnCancelDownload.style.display = 'none';
            return;
          }
        } else {
          this.logToTab(tabId, 'ℹ️ Baixando playlist sem criar subpasta', 'info');
        }
        
        // Se allowLowerQuality === false, o main process vai verificar cada vídeo individualmente
        // Se allowLowerQuality === true, vai usar fallback automático para todos
        
        // Iniciar download da playlist
        await window.api.startDownload(tabId, {
          url: state.url,
          type: state.type,
          format: state.format,
          resolution: state.resolution,
          downloadPath: downloadPath,
          playlistFolderName: folderName,
          allowLowerQuality: state.allowLowerQuality,
          playlistItems: state.playlistItems,
          isPlaylist: true,
          ignorePlaylist: state.ignorePlaylist,
          cookiesFilePath: prefs?.cookiesFilePath || ''
        });
      } else {
        if (state.ignorePlaylist && this.checkIfPlaylist(state.url)) {
          this.logToTab(tabId, 'ℹ️ Ignorando playlist - baixando apenas o item individual', 'info');
        }
        
        // VERIFICAR RESOLUÇÃO (padrão: sempre perguntar)
        // Só pula se allowLowerQuality === true OU for áudio OU resolução 'best'
        const shouldCheckResolution = (
          state.type === 'video' && 
          state.resolution !== 'best' && 
          state.allowLowerQuality !== true
        );
        
        console.log('🔍 Decisão de verificação:', {
          type: state.type,
          resolution: state.resolution,
          allowLowerQuality: state.allowLowerQuality,
          shouldCheck: shouldCheckResolution
        });
        
        if (shouldCheckResolution) {
          this.logToTab(tabId, '🔍 Verificando disponibilidade da resolução escolhida...', 'info');
          const resolutionOk = await window.api.checkResolution(state.url, state.resolution, state.allowLowerQuality);
          console.log('🔍 Resultado checkResolution:', resolutionOk);
          if (!resolutionOk) {
            this.logToTab(tabId, '❌ Download cancelado - resolução não disponível', 'error');
            btnDownload.style.display = 'inline-block';
            btnCancelDownload.style.display = 'none';
            return;
          }
          this.logToTab(tabId, '✅ Resolução verificada - continuando...', 'success');
        } else {
          console.log('⏭️ Pulando verificação de resolução');
        }
        
        // Download único
        console.log('📦 Enviando para download:', {
          url: state.url.substring(0, 50),
          resolution: state.resolution,
          allowLowerQuality: state.allowLowerQuality
        });
        await window.api.startDownload(tabId, {
          url: state.url,
          type: state.type,
          format: state.format,
          resolution: state.resolution,
          downloadPath: downloadPath,
          playlistFolderName: null,
          allowLowerQuality: state.allowLowerQuality,
          isPlaylist: false,
          ignorePlaylist: state.ignorePlaylist,
          cookiesFilePath: prefs?.cookiesFilePath || ''
        });
      }
      
      this.logToTab(tabId, '✓ Download concluído!', 'success');
      
      // Esconder barra de fila
      this.hideQueueDisplay(tabId);
      
      // Resetar botões após sucesso
      btnDownload.style.display = 'inline-block';
      btnCancelDownload.style.display = 'none';
      state.downloadProcess = null;
    } catch (error) {
      // Verificar se foi erro de cancelamento
      const wasCancelled = error.message && error.message.toLowerCase().includes('cancelado');
      
      this.logToTab(tabId, `❌ Erro: ${error.message}`, 'error');
      this.hideQueueDisplay(tabId);
      
      // Só resetar botões se NÃO foi cancelamento
      // (o cancelamento já gerencia os botões)
      if (!wasCancelled && !state.cancelRequested) {
        btnDownload.style.display = 'inline-block';
        btnCancelDownload.style.display = 'none';
        state.downloadProcess = null;
      }
    }
  }
  
  async cancelDownload(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    // Marcar que foi solicitado cancelamento
    tab.state.cancelRequested = true;
    
    this.logToTab(tabId, '🛑 Cancelando download...', 'info');
    
    const btnDownload = tab.content.querySelector('.btn-download');
    const btnCancelDownload = tab.content.querySelector('.btn-cancel-download');
    btnCancelDownload.disabled = true;
    btnCancelDownload.textContent = 'Cancelando...';
    
    try {
      await window.api.cancelDownload(tabId);
      
      // Após cancelamento confirmado, resetar UI
      this.logToTab(tabId, '✅ Download cancelado com sucesso', 'info');
      btnDownload.style.display = 'inline-block';
      btnCancelDownload.style.display = 'none';
      btnCancelDownload.disabled = false;
      btnCancelDownload.textContent = 'Cancelar Download';
      tab.state.downloadProcess = null;
      this.hideQueueDisplay(tabId);
    } catch (error) {
      this.logToTab(tabId, `⚠️ Erro ao cancelar: ${error.message}`, 'error');
      btnCancelDownload.disabled = false;
      btnCancelDownload.textContent = 'Cancelar Download';
    }
  }
  
  checkIfPlaylist(url) {
    return url.includes('playlist') || url.includes('&list=') || url.includes('?list=');
  }
  
  updateQueueDisplay(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const queueContent = tab.content.querySelector('.queue-content');
    const queueCount = tab.content.querySelector('.queue-count');
    
    if (tab.state.isPlaylistDownload && tab.state.playlistItems.length > 0) {
      const current = tab.state.currentItem;
      const total = tab.state.playlistItems.length;
      const currentTitle = tab.state.playlistItems[current]?.title || 'Carregando...';
      
      queueContent.textContent = currentTitle;
      queueCount.textContent = `${current + 1}/${total}`;
    } else {
      queueContent.textContent = 'Nenhum item na fila';
      queueCount.textContent = '0/0';
    }
  }
  
  hideQueueDisplay(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const queueContent = tab.content.querySelector('.queue-content');
    const queueCount = tab.content.querySelector('.queue-count');
    
    // Resetar para estado padrão mas manter visível
    queueContent.textContent = 'Nenhum item na fila';
    queueCount.textContent = '0/0';
    
    tab.state.isPlaylistDownload = false;
    tab.state.playlistItems = [];
    tab.state.currentItem = 0;
  }
  
  checkActiveDownloads() {
    const activeDownloads = [];
    
    for (const [tabId, tab] of this.tabs) {
      const btnCancelDownload = tab.content.querySelector('.btn-cancel-download');
      const isDownloading = btnCancelDownload && btnCancelDownload.style.display !== 'none';
      
      if (isDownloading) {
        activeDownloads.push(tab.name);
      }
    }
    
    return activeDownloads;
  }
  
  logToTab(tabId, message, type = 'info') {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const logArea = tab.content.querySelector('.log-area');
    const timestamp = new Date().toLocaleTimeString();
    const className = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info';
    
    logArea.innerHTML += `<span class="${className}">[${timestamp}] ${message}</span>\n`;
    logArea.scrollTop = logArea.scrollHeight;
    
    // Atualizar contador de fila quando baixar item da playlist
    if (tab.state.isPlaylistDownload) {
      const match = message.match(/\[(\d+)\/(\d+)\]/);
      if (match) {
        tab.state.currentItem = parseInt(match[1]) - 1;
        this.updateQueueDisplay(tabId);
      }
    }
  }
}

// ============================================
// SISTEMA DE PERFIS DE DOWNLOAD
// ============================================

class ProfileManager {
  constructor() {
    this.profiles = new Map(); // Map<profileName, profileConfig>
    this.profilesList = document.getElementById('profilesList');
    this.btnSaveProfile = document.getElementById('btnSaveProfile');
    this.profileContextMenu = document.getElementById('profileContextMenu');
    this.currentContextProfile = null;
    
    this.init();
  }
  
  init() {
    // Carregar perfis salvos
    this.loadProfiles();
    
    // Event listeners
    this.btnSaveProfile.addEventListener('click', () => this.saveCurrentTabAsProfile());
    
    // Fechar menu de contexto ao clicar fora
    document.addEventListener('click', () => {
      this.profileContextMenu.style.display = 'none';
    });
    
    // Opções do menu de contexto
    document.getElementById('profileMenuRename').addEventListener('click', () => {
      if (this.currentContextProfile) {
        this.renameProfile(this.currentContextProfile);
      }
      this.profileContextMenu.style.display = 'none';
    });
    
    document.getElementById('profileMenuDelete').addEventListener('click', () => {
      if (this.currentContextProfile) {
        this.deleteProfile(this.currentContextProfile);
      }
      this.profileContextMenu.style.display = 'none';
    });
  }
  
  async saveCurrentTabAsProfile() {
    if (!tabManager || !tabManager.activeTabId) {
      alert(t('noActiveTab'));
      return;
    }
    
    const profileName = await showInputDialog({
      title: t('newProfileTitle'),
      message: t('newProfileMessage'),
      placeholder: t('newProfilePlaceholder'),
      okLabel: t('save'),
      cancelLabel: t('cancel')
    });
    
    if (!profileName) return;
    
    // Capturar configurações da tab ativa
    const tabData = tabManager.tabs.get(tabManager.activeTabId);
    const state = tabData.state;
    
    const profileConfig = {
      type: state.type,
      format: state.format,
      resolution: state.resolution,
      ignorePlaylist: state.ignorePlaylist,
      downloadPath: state.downloadPath || null
    };
    
    this.profiles.set(profileName, profileConfig);
    this.saveProfiles();
    this.renderProfiles();
  }
  
  loadProfile(profileName) {
    if (!tabManager || !tabManager.activeTabId) {
      alert(t('noActiveTabApply'));
      return;
    }
    
    const profile = this.profiles.get(profileName);
    if (!profile) return;
    
    const tabData = tabManager.tabs.get(tabManager.activeTabId);
    const content = tabData.content;
    
    // Aplicar configurações do perfil
    const typeSelect = content.querySelector('.type-select');
    const formatSelect = content.querySelector('.format-select');
    const resolutionSelect = content.querySelector('.resolution-select');
    const ignorePlaylistCheckbox = content.querySelector('.ignorePlaylist-input');
    const pathDisplay = content.querySelector('.path-display');
    const btnOpenFolder = content.querySelector('.btn-open-folder');
    
    if (typeSelect) typeSelect.value = profile.type;
    if (resolutionSelect) resolutionSelect.value = profile.resolution;
    if (ignorePlaylistCheckbox) ignorePlaylistCheckbox.checked = profile.ignorePlaylist;
    
    // Aplicar pasta de download se existir no perfil
    if (profile.downloadPath && pathDisplay) {
      pathDisplay.textContent = profile.downloadPath;
      if (btnOpenFolder) btnOpenFolder.disabled = false;
    }
    
    // Atualizar estado da tab
    tabData.state.type = profile.type;
    tabData.state.format = profile.format;
    tabData.state.resolution = profile.resolution;
    tabData.state.ignorePlaylist = profile.ignorePlaylist;
    if (profile.downloadPath) {
      tabData.state.downloadPath = profile.downloadPath;
    }
    
    // Trigger change no type-select para atualizar formatos
    if (typeSelect) {
      const event = new Event('change');
      typeSelect.dispatchEvent(event);
      
      // Aguardar um frame para garantir que formatos foram populados
      setTimeout(() => {
        if (formatSelect) formatSelect.value = profile.format;
        tabData.state.format = profile.format;
      }, 10);
    }
    
    tabManager.saveTabsState();
  }
  
  async renameProfile(oldName) {
    const newName = await showInputDialog({
      title: t('renameProfileTitle'),
      message: t('renameProfileMessage'),
      defaultValue: oldName,
      okLabel: t('renameProfile'),
      cancelLabel: t('cancel')
    });
    
    if (!newName || newName === oldName) return;
    
    if (this.profiles.has(newName)) {
      alert(t('profileExists'));
      return;
    }
    
    const profile = this.profiles.get(oldName);
    this.profiles.delete(oldName);
    this.profiles.set(newName, profile);
    
    this.saveProfiles();
    this.renderProfiles();
  }
  
  async deleteProfile(profileName) {
    const confirmed = await showConfirmDialog({
      type: 'warning',
      title: t('deleteProfileTitle'),
      message: `${t('deleteProfileMessage')} "${profileName}"?`,
      detail: t('deleteProfileDetail'),
      cancelLabel: t('cancel'),
      confirmLabel: t('deleteProfile')
    });
    
    if (!confirmed) return;
    
    this.profiles.delete(profileName);
    this.saveProfiles();
    this.renderProfiles();
  }
  
  renderProfiles() {
    this.profilesList.innerHTML = '';
    
    for (const [name, config] of this.profiles.entries()) {
      const profileItem = document.createElement('div');
      profileItem.className = 'profile-item';
      profileItem.textContent = name;
      
      // Tooltip com informações do perfil
      let tooltipText = `${config.type} - ${config.format} - ${config.resolution}`;
      if (config.downloadPath) {
        tooltipText += `\nPasta: ${config.downloadPath}`;
      }
      profileItem.title = tooltipText;
      
      // Botão esquerdo: carregar perfil
      profileItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadProfile(name);
      });
      
      // Botão direito: menu de contexto
      profileItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.currentContextProfile = name;
        
        this.profileContextMenu.style.display = 'block';
        this.profileContextMenu.style.left = `${e.pageX}px`;
        this.profileContextMenu.style.top = `${e.pageY}px`;
      });
      
      this.profilesList.appendChild(profileItem);
    }
  }
  
  saveProfiles() {
    const profilesObj = {};
    for (const [name, config] of this.profiles.entries()) {
      profilesObj[name] = config;
    }
    localStorage.setItem('downloadProfiles', JSON.stringify(profilesObj));
  }
  
  loadProfiles() {
    try {
      const saved = localStorage.getItem('downloadProfiles');
      if (saved) {
        const profilesObj = JSON.parse(saved);
        this.profiles.clear();
        for (const [name, config] of Object.entries(profilesObj)) {
          this.profiles.set(name, config);
        }
        this.renderProfiles();
      }
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
    }
  }
}

// ============================================
// ATUALIZAÇÃO DE INTERFACE COM TRADUÇÕES
// ============================================

function updateInterfaceLanguage() {
  // Top bar
  document.querySelector('.app-title span').textContent = t('appTitle');
  document.querySelector('#btnSettings').title = t('settings');
  
  // Tabs
  document.querySelector('#btnNewTab').title = t('newTab');
  document.querySelector('#contextMenuRename').textContent = t('renameTab');
  document.querySelector('#contextMenuClose').textContent = t('closeTab');
  
  // Profile context menu
  document.querySelector('#profileMenuRename').textContent = t('renameProfile');
  document.querySelector('#profileMenuDelete').textContent = t('deleteProfile');
  
  // Profiles sidebar
  document.querySelector('.profiles-title').textContent = t('profilesTitle');
  document.querySelector('#btnSaveProfile').textContent = t('saveProfile');
  document.querySelector('#btnSaveProfile').title = t('saveProfile');
  
  // Atualizar template das tabs (será usado para novas tabs)
  const template = document.querySelector('#tabTemplate');
  if (template) {
    const content = template.content;
    
    // Title
    const h1 = content.querySelector('h1');
    if (h1) h1.textContent = t('pageTitle');
    
    const subtitle = content.querySelector('.subtitle');
    if (subtitle) subtitle.textContent = t('pageSubtitle');
    
    // Labels
    const labels = content.querySelectorAll('label');
    if (labels[0]) labels[0].textContent = t('urlLabel');
    if (labels[1]) labels[1].querySelector('span').textContent = t('ignorePlaylist');
    if (labels[2]) labels[2].textContent = t('downloadType');
    if (labels[3]) labels[3].textContent = t('format');
    if (labels[4]) labels[4].textContent = t('resolution');
    if (labels[5]) labels[5].textContent = t('downloadPath');
    
    // Input placeholder
    const urlInput = content.querySelector('.url-input');
    if (urlInput) urlInput.placeholder = t('urlPlaceholder');
    
    // Ignore playlist label
    const ignoreLabel = content.querySelector('.ignore-playlist-label');
    if (ignoreLabel) ignoreLabel.title = t('ignorePlaylistTooltip');
    
    // No folder selected
    const pathDisplay = content.querySelector('.path-display');
    if (pathDisplay) pathDisplay.textContent = t('noFolderSelected');
    
    // Buttons
    const btnBrowse = content.querySelector('.btn-browse');
    if (btnBrowse) btnBrowse.textContent = t('chooseFolder');
    
    const btnOpenFolder = content.querySelector('.btn-open-folder');
    if (btnOpenFolder) btnOpenFolder.title = t('openFolder');
    
    const btnDownload = content.querySelector('.btn-download');
    if (btnDownload) btnDownload.textContent = t('startDownload');
    
    const btnCancel = content.querySelector('.btn-cancel-download');
    if (btnCancel) btnCancel.textContent = t('cancelDownload');
  }
  
  // Atualizar tabs existentes
  if (tabManager) {
    tabManager.tabs.forEach((tabData, tabId) => {
      const content = tabData.content;
      if (!content) return;
      
      // Labels
      const labels = content.querySelectorAll('label');
      if (labels[0]) labels[0].childNodes[0].textContent = t('urlLabel');
      if (labels[1]) {
        const span = labels[1].querySelector('span');
        if (span) span.textContent = t('ignorePlaylist');
      }
      if (labels[2]) labels[2].childNodes[0].textContent = t('downloadType');
      if (labels[3]) labels[3].childNodes[0].textContent = t('format');
      if (labels[4]) labels[4].childNodes[0].textContent = t('resolution');
      if (labels[5]) labels[5].childNodes[0].textContent = t('downloadPath');
      
      // Input placeholder
      const urlInput = content.querySelector('.url-input');
      if (urlInput && !urlInput.value) {
        urlInput.placeholder = t('urlPlaceholder');
      }
      
      // Buttons
      const btnBrowse = content.querySelector('.btn-browse');
      if (btnBrowse) btnBrowse.textContent = t('chooseFolder');
      
      const btnDownload = content.querySelector('.btn-download');
      if (btnDownload && btnDownload.style.display !== 'none') {
        btnDownload.textContent = t('startDownload');
      }
      
      const btnCancel = content.querySelector('.btn-cancel-download');
      if (btnCancel && btnCancel.style.display !== 'none') {
        btnCancel.textContent = t('cancelDownload');
      }
    });
  }
}

// Inicializar gerenciador de tabs
let tabManager;
let profileManager;
window.addEventListener('DOMContentLoaded', () => {
  // IMPORTANTE: Atualizar idioma ANTES de criar tabs
  // para que o template já esteja traduzido
  updateInterfaceLanguage();
  
  tabManager = new TabManager();
  profileManager = new ProfileManager();
});

// ============================================
// SISTEMA DE DIÁLOGOS CUSTOMIZADOS
// ============================================

function showConfirmDialog(options) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.style.zIndex = '10000';
    
    const iconMap = {
      warning: '❗',
      error: '❌',
      info: 'ℹ️',
      question: '❓'
    };
    
    const icon = iconMap[options.type] || '❓';
    
    modal.innerHTML = `
      <div class="settings-modal" style="max-width: 500px;">
        <div class="settings-header" style="background: ${options.type === 'warning' ? '#ff9800' : options.type === 'error' ? '#f44336' : '#2196f3'};">
          <h2 style="color: #ffffff !important; background: none !important; -webkit-background-clip: initial !important; -webkit-text-fill-color: #ffffff !important; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">${icon} ${options.title}</h2>
        </div>
        <div class="settings-content" style="padding: 25px;">
          <p style="font-size: 16px; margin: 0 0 10px 0; color: #fff;">${options.message}</p>
          ${options.detail ? `<p style="font-size: 14px; color: #bbb; margin: 10px 0 0 0; line-height: 1.6;">${options.detail.replace(/\n/g, '<br>')}</p>` : ''}
          <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
            <button class="dialog-btn dialog-btn-cancel" style="padding: 10px 24px; background: #444; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px; transition: background 0.2s;">
              ${options.cancelLabel || 'Cancelar'}
            </button>
            <button class="dialog-btn dialog-btn-confirm" style="padding: 10px 24px; background: #f44336; border: none; color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; transition: background 0.2s;">
              ${options.confirmLabel || 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const btnCancel = modal.querySelector('.dialog-btn-cancel');
    const btnConfirm = modal.querySelector('.dialog-btn-confirm');
    
    // Hover effects
    btnCancel.addEventListener('mouseenter', () => btnCancel.style.background = '#555');
    btnCancel.addEventListener('mouseleave', () => btnCancel.style.background = '#444');
    btnConfirm.addEventListener('mouseenter', () => btnConfirm.style.background = '#d32f2f');
    btnConfirm.addEventListener('mouseleave', () => btnConfirm.style.background = '#f44336');
    
    btnCancel.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
    
    btnConfirm.addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });
    
    // ESC para cancelar
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        resolve(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}

// Modal de input customizado
function showInputDialog(options) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.style.zIndex = '10000';
    
    modal.innerHTML = `
      <div class="settings-modal" style="max-width: 450px;">
        <div class="settings-header" style="background: linear-gradient(135deg, #0078d4, #0098ff);">
          <h2 style="color: #ffffff !important; background: none !important; -webkit-background-clip: initial !important; -webkit-text-fill-color: #ffffff !important; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">${options.title || 'Digite o valor'}</h2>
        </div>
        <div class="settings-content" style="padding: 25px;">
          ${options.message ? `<p style="font-size: 14px; margin: 0 0 15px 0; color: #ddd;">${options.message}</p>` : ''}
          <input type="text" id="inputDialogValue" value="${options.defaultValue || ''}" 
                 placeholder="${options.placeholder || ''}"
                 style="width: 100%; padding: 12px; background: #252525; border: 1px solid #3a3a3a; 
                        border-radius: 6px; color: #fff; font-size: 14px; box-sizing: border-box;">
          <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
            <button class="dialog-btn dialog-btn-cancel" style="padding: 10px 24px; background: #444; border: none; 
                    color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px; transition: background 0.2s;">
              ${options.cancelLabel || 'Cancelar'}
            </button>
            <button class="dialog-btn dialog-btn-ok" style="padding: 10px 24px; background: #0078d4; border: none; 
                    color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; transition: background 0.2s;">
              ${options.okLabel || 'OK'}
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const inputField = modal.querySelector('#inputDialogValue');
    const btnCancel = modal.querySelector('.dialog-btn-cancel');
    const btnOk = modal.querySelector('.dialog-btn-ok');
    
    // Focar no input ao abrir
    setTimeout(() => {
      inputField.focus();
      inputField.select();
    }, 100);
    
    // Hover effects
    btnCancel.addEventListener('mouseenter', () => btnCancel.style.background = '#555');
    btnCancel.addEventListener('mouseleave', () => btnCancel.style.background = '#444');
    btnOk.addEventListener('mouseenter', () => btnOk.style.background = '#0098ff');
    btnOk.addEventListener('mouseleave', () => btnOk.style.background = '#0078d4');
    
    const submitValue = () => {
      const value = inputField.value.trim();
      modal.remove();
      resolve(value || null);
    };
    
    btnCancel.addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });
    
    btnOk.addEventListener('click', submitValue);
    
    // Enter para confirmar
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitValue();
      } else if (e.key === 'Escape') {
        modal.remove();
        resolve(null);
      }
    });
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    });
  });
}

// Modal de aviso de arquivo em uso
function showFileInUseWarning(fileName) {
  const modal = document.createElement('div');
  modal.className = 'confirm-modal-overlay';
  modal.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-header" style="background: linear-gradient(135deg, #f44336, #e91e63);">
        <span class="confirm-icon">🔒</span>
        <h3 style="color: #ffffff !important; background: none !important; -webkit-background-clip: initial !important; -webkit-text-fill-color: #ffffff !important; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">${t('fileInUseTitle')}</h3>
      </div>
      <div class="confirm-body">
        <p style="margin-bottom: 15px;">${t('fileInUseMessage')}</p>
        <p style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px; word-break: break-all;">
          <strong>${t('fileInUseFile')}</strong><br>${fileName}
        </p>
        <p style="margin-top: 15px; font-size: 13px; opacity: 0.8;">
          ${t('fileInUseDetail')}
        </p>
      </div>
      <div class="confirm-buttons">
        <button class="confirm-btn confirm-btn-ok" style="background: #4CAF50; flex: 1;">${t('understood')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const btnOk = modal.querySelector('.confirm-btn-ok');
  
  // Efeito hover no botão OK
  btnOk.addEventListener('mouseenter', () => btnOk.style.background = '#45a049');
  btnOk.addEventListener('mouseleave', () => btnOk.style.background = '#4CAF50');
  
  btnOk.addEventListener('click', () => {
    modal.remove();
  });

  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // ESC para fechar
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ============================================
// CONFIGURAÇÕES (mantido do código original)
// ============================================

const btnSettings = document.getElementById('btnSettings');

btnSettings.addEventListener('click', () => {
  showSettingsModal();
});

async function showSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = `
    <style>
      #playlistLimit::-webkit-inner-spin-button,
      #playlistLimit::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      #playlistLimit {
        -moz-appearance: textfield;
      }
    </style>
    <div class="settings-modal">
      <div class="settings-header">
        <div style="text-align: left; flex: 1;">
          <h2 style="margin: 0;">⚙️ Configurações</h2>
          <span style="font-size: 12px; color: #999; margin-top: 5px; display: block;">DLWave v<span id="appVersion">...</span></span>
        </div>
        <button class="btn-close-modal" onclick="this.closest('.settings-modal-overlay').remove()">×</button>
      </div>
      <div class="settings-content">
        <div class="settings-section">
          <h3>Preferências Globais</h3>
          <p class="settings-description">Configurações aplicadas a todas as tabs</p>
          
          <div class="settings-info">
            <div class="info-item">
              <span class="info-label">Pasta Bin (yt-dlp + FFmpeg):</span>
              <span class="info-value" id="binPath">-</span>
            </div>
            <button class="btn-open-bin" id="btnOpenBin" style="margin-top: 10px;">📁 Abrir Pasta Bin</button>
          </div>
          
          <div class="settings-section" style="margin-top: 20px;">
            <h4>Limite de Playlist</h4>
            <p class="settings-description">Número máximo de vídeos a processar em playlists (máximo: 10000)</p>
            <input type="number" id="playlistLimit" min="1" max="10000" placeholder="1000" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #fff; border-radius: 4px; font-size: 14px; margin-top: 10px;">
          </div>
          
          <div class="settings-checkbox">
            <label>
              <input type="checkbox" id="ignorePlaylistGlobal" />
              <span>Ignorar playlists por padrão</span>
            </label>
            <p class="checkbox-description">Novas Waves iniciarão com "Ignorar Playlist" já marcado</p>
          </div>
          
          <div class="settings-checkbox">
            <label>
              <input type="checkbox" id="minimizeToTray" />
              <span>Minimizar para bandeja</span>
            </label>
            <p class="checkbox-description">Ao minimizar, o app fica na bandeja do sistema</p>
          </div>
          
          <div class="settings-checkbox">
            <label>
              <input type="checkbox" id="noPlaylistFolder" />
              <span>Não criar pastas para playlists</span>
            </label>
            <p class="checkbox-description">Baixar todos os itens da playlist diretamente na pasta escolhida, sem criar subpasta</p>
          </div>
          
          <div class="settings-section" style="margin-top: 20px;">
            <h4>Pasta Padrão de Downloads</h4>
            <p class="settings-description">Waves sem pasta configurada usarão este local</p>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <input type="text" id="defaultDownloadPath" readonly placeholder="Nenhuma pasta padrão configurada" style="flex: 1; padding: 8px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #fff; border-radius: 4px;" />
              <button class="btn-browse" id="btnSelectDefaultPath" style="padding: 8px 16px;">📁 Selecionar</button>
              <button class="btn-browse" id="btnClearDefaultPath" style="padding: 8px 16px; display: none;">🗑️ Limpar</button>
            </div>
          </div>
          
          <div class="settings-section" style="margin-top: 20px;">
            <h4>Arquivo de Cookies (opcional)</h4>
            <p class="settings-description">Para downloads que requerem autenticação (vídeos privados, age-restricted, etc.)</p>
            <div style="display: flex; gap: 15px; margin-top: 10px;">
              <input type="text" id="cookiesFilePath" readonly placeholder="Nenhum arquivo selecionado" style="flex: 1; padding: 8px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #fff; border-radius: 4px;" title="Use extensões como 'Get cookies.txt LOCALLY' ou 'cookies.txt' no Chrome/Firefox para exportar seus cookies" />
              <button class="btn-browse" id="btnSelectCookies" style="padding: 8px 16px;" title="Use extensões como 'Get cookies.txt LOCALLY' (Chrome/Firefox) ou 'cookies.txt' para exportar os cookies do seu navegador em formato Netscape">📁 Selecionar .txt</button>
              <button class="btn-browse" id="btnClearCookies" style="padding: 8px 16px; display: none;" title="Remover arquivo de cookies configurado">🗑️ Remover</button>
            </div>
          </div>
          
          <div class="settings-section" style="margin-top: 20px;">
            <h4>Navegador para Cookies (Anti-Bot)</h4>
            <p class="settings-description">Importa cookies automaticamente do navegador selecionado para evitar detecção de bot. Você precisa estar logado no YouTube neste navegador.</p>
            <div style="margin-top: 10px;">
              <input type="text" id="browserPath" readonly placeholder="Selecione o executável do navegador (chrome.exe, brave.exe, firefox.exe, etc.)" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #fff; border-radius: 4px; font-size: 13px; cursor: pointer; margin-bottom: 10px;">
              <div style="display: flex; gap: 10px;">
                <button class="btn-browse" id="btnSelectBrowser" style="padding: 8px 16px;" title="Selecione o executável do navegador">🌐 Selecionar Navegador</button>
                <button class="btn-browse" id="btnClearBrowser" style="padding: 8px 16px; display: none;" title="Remover navegador configurado">🗑️ Remover</button>
              </div>
              <p style="font-size: 12px; color: #999; margin-top: 8px;">Selecione o executável do seu navegador (ex: chrome.exe, brave.exe, msedge.exe, firefox.exe). Funciona com qualquer navegador.</p>
              <div style="background: #ffeb3b20; border-left: 3px solid #ffeb3b; padding: 10px; margin-top: 10px; border-radius: 4px;">
                <p style="font-size: 12px; color: #ffeb3b; margin: 0;">⚠️ <strong>IMPORTANTE:</strong> O navegador precisa estar <strong>FECHADO</strong> para que os cookies possam ser extraídos. Feche todas as janelas do navegador antes de baixar.</p>
              </div>
            </div>
          </div>
          
          <div class="settings-section" style="margin-top: 20px;">
            <h4>Idioma / Language</h4>
            <p class="settings-description">Interface language / Idioma da interface</p>
            <div style="margin-top: 10px;">
              <select id="languageSelect" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #fff; border-radius: 4px; font-size: 14px;">
                <option value="pt-BR">Portugu\u00eas (Brasil)</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          
          <button class="btn-save-prefs" id="btnSavePrefs" style="margin-top: 20px;" title="Salva as preferências globais e o estado atual de todas as Waves (nome, URL, pasta, configurações)">Salvar Preferências</button>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #3a3a3a;">
            <h4 style="color: #f44336; margin-bottom: 10px;">⚠️ Zona de Perigo</h4>
            <button class="btn-save-prefs" id="btnResetAll" style="background: #f44336; margin-top: 10px;" title="Remove TODAS as configurações e tabs salvas. Use se algo estiver com comportamento estranho.">Resetar Tudo (Limpar Cache)</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Preencher valores
  const binPathEl = modal.querySelector('#binPath');
  const btnOpenBin = modal.querySelector('#btnOpenBin');
  const appVersionEl = modal.querySelector('#appVersion');
  
  // Obter e exibir versão do app
  const appVersion = await window.api.getAppVersion();
  appVersionEl.textContent = appVersion;
  
  // Obter e exibir pasta bin
  const binPath = await window.api.getBinPath();
  binPathEl.textContent = binPath;
  
  // Botão para abrir pasta bin
  btnOpenBin.addEventListener('click', async () => {
    await window.api.openBinFolder();
  });
  
  // Carregar preferências salvas
  const savedPrefs = await window.api.loadPreferences();
  console.log('🔧 Preferências carregadas no modal:', savedPrefs);
  
  const playlistLimitInput = modal.querySelector('#playlistLimit');
  const ignorePlaylistGlobalCheckbox = modal.querySelector('#ignorePlaylistGlobal');
  const minimizeToTrayCheckbox = modal.querySelector('#minimizeToTray');
  const noPlaylistFolderCheckbox = modal.querySelector('#noPlaylistFolder');
  const defaultDownloadPathInput = modal.querySelector('#defaultDownloadPath');
  const btnSelectDefaultPath = modal.querySelector('#btnSelectDefaultPath');
  const btnClearDefaultPath = modal.querySelector('#btnClearDefaultPath');
  const cookiesFilePathInput = modal.querySelector('#cookiesFilePath');
  const btnSelectCookies = modal.querySelector('#btnSelectCookies');
  const btnClearCookies = modal.querySelector('#btnClearCookies');
  const browserPathInput = modal.querySelector('#browserPath');
  const btnSelectBrowser = modal.querySelector('#btnSelectBrowser');
  const btnClearBrowser = modal.querySelector('#btnClearBrowser');
  const languageSelect = modal.querySelector('#languageSelect');
  
  // Definir idioma atual no select
  languageSelect.value = currentLanguage;
  
  // Definir navegador salvo
  if (savedPrefs?.browserPath) {
    browserPathInput.value = savedPrefs.browserPath;
    btnClearBrowser.style.display = 'inline-block';
  }
  
  // Definir valor do limite de playlist
  playlistLimitInput.value = savedPrefs?.playlistLimit ?? 1000;
  
  // Sempre definir o estado dos checkboxes explicitamente
  ignorePlaylistGlobalCheckbox.checked = savedPrefs?.ignorePlaylistGlobal ?? false;
  minimizeToTrayCheckbox.checked = savedPrefs?.minimizeToTray ?? false;
  noPlaylistFolderCheckbox.checked = savedPrefs?.noPlaylistFolder ?? false;
  
  console.log('🎛️ Checkboxes configurados:', {
    ignorePlaylistGlobal: ignorePlaylistGlobalCheckbox.checked,
    minimizeToTray: minimizeToTrayCheckbox.checked,
    noPlaylistFolder: noPlaylistFolderCheckbox.checked
  });
  
  if (savedPrefs?.defaultDownloadPath) {
    defaultDownloadPathInput.value = savedPrefs.defaultDownloadPath;
    btnClearDefaultPath.style.display = 'inline-block';
  }
  if (savedPrefs?.cookiesFilePath) {
    cookiesFilePathInput.value = savedPrefs.cookiesFilePath;
    btnClearCookies.style.display = 'inline-block';
  }
  
  // Botão para selecionar pasta padrão
  btnSelectDefaultPath.addEventListener('click', async () => {
    const folderPath = await window.api.selectFolder();
    if (folderPath) {
      defaultDownloadPathInput.value = folderPath;
      btnClearDefaultPath.style.display = 'inline-block';
    }
  });
  
  // Botão para limpar pasta padrão
  btnClearDefaultPath.addEventListener('click', () => {
    defaultDownloadPathInput.value = '';
    btnClearDefaultPath.style.display = 'none';
  });
  
  // Botão para selecionar arquivo de cookies
  btnSelectCookies.addEventListener('click', async () => {
    const filePath = await window.api.selectCookiesFile();
    if (filePath) {
      cookiesFilePathInput.value = filePath;
      btnClearCookies.style.display = 'inline-block';
    }
  });
  
  // Botão para limpar arquivo de cookies
  btnClearCookies.addEventListener('click', () => {
    cookiesFilePathInput.value = '';
    btnClearCookies.style.display = 'none';
  });
  
  // Botão para selecionar navegador
  btnSelectBrowser.addEventListener('click', async () => {
    const filePath = await window.api.selectBrowserFile();
    if (filePath) {
      browserPathInput.value = filePath;
      btnClearBrowser.style.display = 'inline-block';
    }
  });
  
  // Botão para limpar navegador
  btnClearBrowser.addEventListener('click', () => {
    browserPathInput.value = '';
    btnClearBrowser.style.display = 'none';
  });
  
  // Listener para mudança de idioma
  languageSelect.addEventListener('change', () => {
    const newLang = languageSelect.value;
    setLanguage(newLang);
    updateInterfaceLanguage();
  });
  
  // Botão salvar
  modal.querySelector('#btnSavePrefs').addEventListener('click', async () => {
    // Validar limite de playlist
    let playlistLimit = parseInt(playlistLimitInput.value) || 1000;
    if (playlistLimit > 10000) {
      alert('⚠️ O limite máximo de playlist é 10000 vídeos!\n\nValor ajustado para 10000.');
      playlistLimit = 10000;
      playlistLimitInput.value = 10000;
    }
    if (playlistLimit < 1) {
      playlistLimit = 1;
      playlistLimitInput.value = 1;
    }
    
    const prefs = {
      playlistLimit: playlistLimit,
      ignorePlaylistGlobal: ignorePlaylistGlobalCheckbox.checked,
      minimizeToTray: minimizeToTrayCheckbox.checked,
      noPlaylistFolder: noPlaylistFolderCheckbox.checked,
      defaultDownloadPath: defaultDownloadPathInput.value || '',
      cookiesFilePath: cookiesFilePathInput.value || '',
      browserPath: browserPathInput.value || ''
    };
    
    console.log('🔧 Salvando preferências (renderer):', prefs);
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
  
  // Botão resetar tudo
  modal.querySelector('#btnResetAll').addEventListener('click', async () => {
    const confirmed = await showConfirmDialog({
      type: 'warning',
      title: '⚠️ Resetar Tudo',
      message: 'Isso vai DELETAR todas as configurações, preferências e tabs salvas!',
      detail: 'O app será recarregado com configurações padrão. Esta ação não pode ser desfeita.',
      cancelLabel: 'Cancelar',
      confirmLabel: 'Sim, Resetar Tudo'
    });
    
    if (confirmed) {
      // Cancelar todos os downloads ativos primeiro
      const activeDownloads = [];
      for (const [tabId, tab] of tabManager.tabs) {
        const btnCancelDownload = tab.content.querySelector('.btn-cancel-download');
        const isDownloading = btnCancelDownload && btnCancelDownload.style.display !== 'none';
        if (isDownloading) {
          activeDownloads.push(tabId);
        }
      }
      
      if (activeDownloads.length > 0) {
        console.log(`🛑 Cancelando ${activeDownloads.length} download(s) ativo(s)...`);
        for (const tabId of activeDownloads) {
          await tabManager.cancelDownload(tabId);
        }
        // Aguardar um pouco para garantir que foram cancelados
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Limpar localStorage
      localStorage.clear();
      console.log('🗑️ localStorage limpo');
      
      // Resetar preferências via IPC
      await window.api.savePreferences({
        ignorePlaylistGlobal: false,
        minimizeToTray: false,
        noPlaylistFolder: false,
        defaultDownloadPath: '',
        cookiesFilePath: ''
      });
      console.log('🗑️ Preferências resetadas');
      
      // Recarregar app
      alert('✅ Tudo resetado! O app será recarregado agora.');
      location.reload();
    }
  });
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}