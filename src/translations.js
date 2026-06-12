// Sistema de traduções
const translations = {
  'pt-BR': {
    // Top bar
    appTitle: 'DLWave',
    settings: 'Configurações',
    
    // Tabs
    newTab: 'Nova Wave',
    renameTab: 'Renomear',
    closeTab: 'Fechar',
    
    // Main content
    pageTitle: 'YT-DLP + FFmpeg',
    pageSubtitle: 'Downloader de vídeos e áudios do YouTube',
    
    // URL input
    urlLabel: 'URL do YouTube ou YouTube Music',
    urlPlaceholder: 'Cole aqui o link do YouTube ou YouTube Music...',
    ignorePlaylist: 'Ignorar Playlist',
    ignorePlaylistTooltip: 'Baixar apenas o vídeo ou áudio individual, ignorando a playlist ou mix',
    queueLabel: 'Fila',
    queueEmpty: 'Nenhum item na fila',
    qualitySettings: 'Configurar qualidade',
    timeTrim: 'Corte de Tempo (Opcional)',
    trimStartPlaceholder: 'Início (mm:ss)',
    trimEndPlaceholder: 'Fim (mm:ss)',
    
    // Options
    downloadType: 'Tipo de Download',
    typeVideo: 'Vídeo',
    typeAudio: 'Áudio',
    
    format: 'Formato',
    formatMp4: 'MP4',
    formatMkv: 'MKV',
    formatWebm: 'WEBM',
    formatAvi: 'AVI',
    formatMov: 'MOV',
    formatFlv: 'FLV',
    formatMp3: 'MP3',
    formatM4a: 'M4A',
    formatOpus: 'OPUS',
    formatFlac: 'FLAC',
    formatWav: 'WAV',
    formatAac: 'AAC',
    formatOgg: 'OGG',
    
    resolution: 'Resolução',
    resBest: 'Melhor Disponível',
    res4k: '4K (2160p)',
    res2k: '2K (1440p)',
    resFullHd: 'Full HD (1080p)',
    resHd: 'HD (720p)',
    resSd: 'SD (480p)',
    res360: '360p',
    res240: '240p',
    
    // Download path
    downloadPath: 'Local de Download',
    noFolderSelected: 'Nenhuma pasta selecionada',
    chooseFolder: 'Escolher Pasta',
    openFolder: 'Abrir pasta',
    
    // Buttons
    startDownload: 'Iniciar Download',
    cancelDownload: 'Cancelar Download',
    
    // Profiles
    profilesTitle: 'Perfil de Download',
    saveProfile: 'Salvar',
    renameProfile: 'Renomear',
    deleteProfile: 'Excluir',
    
    // Modals
    newProfileTitle: 'Novo Perfil',
    newProfileMessage: 'Digite o nome do perfil de download:',
    newProfilePlaceholder: 'Ex: Video 1080p, Audio MP3, etc.',
    renameProfileTitle: 'Renomear Perfil',
    renameProfileMessage: 'Digite o novo nome do perfil:',
    deleteProfileTitle: 'Excluir Perfil',
    deleteProfileMessage: 'Tem certeza que deseja excluir o perfil',
    deleteProfileDetail: 'Esta ação não pode ser desfeita.',
    
    // Confirmations
    downloadsActiveTitle: 'Downloads em andamento',
    downloadsActiveMessage: 'Há {count} Wave(s) com download ativo:',
    downloadsActiveDetail: 'Fechar o aplicativo irá cancelar todos os downloads. Deseja continuar?',
    closeTabTitle: 'Download em Andamento',
    closeTabMessage: 'Esta Wave tem um download ativo.',
    closeTabDetail: 'Fechar a Wave irá cancelar o download. Deseja continuar?',
    
    // File in use
    fileInUseTitle: 'Arquivo em Uso',
    fileInUseMessage: 'O arquivo não pôde ser salvo porque está sendo usado por outro aplicativo.',
    fileInUseFile: 'Arquivo:',
    fileInUseDetail: 'Feche o programa que está usando o arquivo e tente novamente.',
    understood: 'Entendi',
    
    // Settings modal
    settingsTitle: 'Configurações',
    globalPreferences: 'Preferências Globais',
    globalPreferencesDesc: 'Configurações aplicadas a todas as tabs',
    binFolderLabel: 'Pasta Bin (yt-dlp + FFmpeg):',
    openBinFolder: 'Abrir Pasta Bin',
    playlistLimit: 'Limite de Playlist',
    playlistLimitDesc: 'Número máximo de vídeos a processar em playlists (máximo: 10000)',
    ignorePlaylistDefault: 'Ignorar playlists por padrão',
    ignorePlaylistDefaultDesc: 'Novas Waves iniciarão com "Ignorar Playlist" já marcado',
    minimizeToTray: 'Minimizar para bandeja',
    minimizeToTrayDesc: 'Ao minimizar, o app fica na bandeja do sistema',
    allowLowerQuality: 'Permitir qualidade inferior',
    allowLowerQualityDesc: 'Não perguntar quando a resolução escolhida não estiver disponível',
    allowLowerQualityEnabled: 'Permitir qualidade inferior: ATIVADO',
    allowLowerQualityDisabled: 'Permitir qualidade inferior: DESATIVADO',
    allowLowerQualityModeEnabled: 'Modo "Permitir qualidade inferior" ativado',
    allowLowerQualityModeDisabled: 'Modo "Permitir qualidade inferior" desativado',
    allowLowerQualityRestartTitle: 'Download em andamento',
    allowLowerQualityRestartMessage: 'Deseja {action} "Permitir qualidade inferior" e reiniciar o download?',
    allowLowerQualityRestartDetail: 'O download será cancelado e reiniciado do zero com a nova configuração.',
    allowLowerQualityRestartLog: 'Reiniciando download com "Permitir qualidade inferior" {status}...',
    qualityActionEnable: 'ativar',
    qualityActionDisable: 'desativar',
    qualityStatusEnabled: 'ativado',
    qualityStatusDisabled: 'desativado',
    no: 'Não',
    yesRestart: 'Sim, reiniciar',
    cookiesFile: 'Arquivo de Cookies',
    cookiesFileOptional: 'Arquivo de Cookies (opcional)',
    cookiesFileDesc: 'Necessário para vídeos que exigem autenticação',
    cookiesFileFullDesc: 'Para downloads que requerem autenticação (vídeos privados, age-restricted, etc.)',
    noFileSelected: 'Nenhum arquivo selecionado',
    cookiesFileHelp: 'Use extensões como "Get cookies.txt LOCALLY" ou "cookies.txt" no Chrome/Firefox para exportar seus cookies',
    cookiesFileSelectHelp: 'Use extensões como "Get cookies.txt LOCALLY" (Chrome/Firefox) ou "cookies.txt" para exportar os cookies do seu navegador em formato Netscape',
    removeCookiesFile: 'Remover arquivo de cookies configurado',
    selectCookiesFile: 'Selecionar arquivo cookies.txt',
    selectTxt: 'Selecionar .txt',
    defaultDownloadPath: 'Pasta Padrão de Downloads',
    defaultDownloadPathDesc: 'Pasta usada quando nenhuma pasta foi selecionada na tab',
    defaultDownloadPathShortDesc: 'Waves sem pasta configurada usarão este local',
    noDefaultDownloadPath: 'Nenhuma pasta padrão configurada',
    select: 'Selecionar',
    clear: 'Limpar',
    remove: 'Remover',
    noPlaylistFolders: 'Não criar pastas para playlists',
    noPlaylistFoldersDesc: 'Salvar todos os arquivos diretamente na pasta escolhida',
    noPlaylistFoldersFullDesc: 'Baixar todos os itens da playlist diretamente na pasta escolhida, sem criar subpasta',
    browserCookies: 'Navegador para Cookies (Anti-Bot)',
    browserCookiesDesc: 'Importa cookies automaticamente do navegador selecionado para evitar detecção de bot. Você precisa estar logado no YouTube neste navegador.',
    browserPathPlaceholder: 'Selecione o executável do navegador (chrome.exe, brave.exe, firefox.exe, etc.)',
    selectBrowser: 'Selecionar Navegador',
    selectBrowserTitle: 'Selecione o executável do navegador',
    removeBrowserTitle: 'Remover navegador configurado',
    browserHelp: 'Selecione o executável do seu navegador (ex: chrome.exe, brave.exe, msedge.exe, firefox.exe). Funciona com qualquer navegador.',
    browserImportant: 'IMPORTANTE:',
    browserClosedWarning: 'O navegador precisa estar FECHADO para que os cookies possam ser extraídos. Feche todas as janelas do navegador antes de baixar.',
    language: 'Idioma',
    languageDesc: 'Idioma da interface do aplicativo',
    languageTitle: 'Idioma / Language',
    languageFullDesc: 'Interface language / Idioma da interface',
    savePreferences: 'Salvar Preferências',
    savePreferencesTitle: 'Salva as preferências globais e o estado atual de todas as Waves (nome, URL, pasta, configurações)',
    saved: '✓ Salvo!',
    playlistLimitMaxAlert: '⚠️ O limite máximo de playlist é 10000 vídeos!\n\nValor ajustado para 10000.',
    dangerZone: '⚠️ Zona de Perigo',
    resetAll: 'Resetar Tudo (Limpar Cache)',
    resetAllTitle: '⚠️ Resetar Tudo',
    resetAllTooltip: 'Remove TODAS as configurações e tabs salvas. Use se algo estiver com comportamento estranho.',
    resetAllMessage: 'Isso vai DELETAR todas as configurações, preferências e tabs salvas!',
    resetAllDetail: 'O app será recarregado com configurações padrão. Esta ação não pode ser desfeita.',
    resetAllConfirm: 'Sim, Resetar Tudo',
    resetAllDone: '✅ Tudo resetado! O app será recarregado agora.',
    close: 'Fechar',
    
    // Languages
    langPortuguese: 'Português (Brasil)',
    langEnglish: 'English',
    
    // Common buttons
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    ok: 'OK',
    save: 'Salvar',
    closeApp: 'Fechar Aplicativo',
    
    // Messages
    noActiveTab: 'Nenhuma tab ativa para salvar como perfil!',
    profileExists: 'Já existe um perfil com este nome!',
    noActiveTabApply: 'Nenhuma tab ativa para aplicar o perfil!'
  },
  
  'en': {
    // Top bar
    appTitle: 'DLWave',
    settings: 'Settings',
    
    // Tabs
    newTab: 'New Wave',
    renameTab: 'Rename',
    closeTab: 'Close',
    
    // Main content
    pageTitle: 'YT-DLP + FFmpeg',
    pageSubtitle: 'YouTube video and audio downloader',
    
    // URL input
    urlLabel: 'YouTube or YouTube Music URL',
    urlPlaceholder: 'Paste the YouTube or YouTube Music link here...',
    ignorePlaylist: 'Ignore Playlist',
    ignorePlaylistTooltip: 'Download only the individual video or audio, ignoring the playlist or mix',
    queueLabel: 'Queue',
    queueEmpty: 'No items in queue',
    qualitySettings: 'Quality settings',
    timeTrim: 'Time Trim (Optional)',
    trimStartPlaceholder: 'Start (mm:ss)',
    trimEndPlaceholder: 'End (mm:ss)',
    
    // Options
    downloadType: 'Download Type',
    typeVideo: 'Video',
    typeAudio: 'Audio',
    
    format: 'Format',
    formatMp4: 'MP4',
    formatMkv: 'MKV',
    formatWebm: 'WEBM',
    formatAvi: 'AVI',
    formatMov: 'MOV',
    formatFlv: 'FLV',
    formatMp3: 'MP3',
    formatM4a: 'M4A',
    formatOpus: 'OPUS',
    formatFlac: 'FLAC',
    formatWav: 'WAV',
    formatAac: 'AAC',
    formatOgg: 'OGG',
    
    resolution: 'Resolution',
    resBest: 'Best Available',
    res4k: '4K (2160p)',
    res2k: '2K (1440p)',
    resFullHd: 'Full HD (1080p)',
    resHd: 'HD (720p)',
    resSd: 'SD (480p)',
    res360: '360p',
    res240: '240p',
    
    // Download path
    downloadPath: 'Download Location',
    noFolderSelected: 'No folder selected',
    chooseFolder: 'Choose Folder',
    openFolder: 'Open folder',
    
    // Buttons
    startDownload: 'Start Download',
    cancelDownload: 'Cancel Download',
    
    // Profiles
    profilesTitle: 'Download Profile',
    saveProfile: 'Save',
    renameProfile: 'Rename',
    deleteProfile: 'Delete',
    
    // Modals
    newProfileTitle: 'New Profile',
    newProfileMessage: 'Enter the download profile name:',
    newProfilePlaceholder: 'Ex: Video 1080p, Audio MP3, etc.',
    renameProfileTitle: 'Rename Profile',
    renameProfileMessage: 'Enter the new profile name:',
    deleteProfileTitle: 'Delete Profile',
    deleteProfileMessage: 'Are you sure you want to delete the profile',
    deleteProfileDetail: 'This action cannot be undone.',
    
    // Confirmations
    downloadsActiveTitle: 'Downloads in Progress',
    downloadsActiveMessage: 'There are {count} Wave(s) with active downloads:',
    downloadsActiveDetail: 'Closing the application will cancel all downloads. Do you want to continue?',
    closeTabTitle: 'Download in Progress',
    closeTabMessage: 'This Wave has an active download.',
    closeTabDetail: 'Closing the Wave will cancel the download. Do you want to continue?',
    
    // File in use
    fileInUseTitle: 'File in Use',
    fileInUseMessage: 'The file could not be saved because it is being used by another application.',
    fileInUseFile: 'File:',
    fileInUseDetail: 'Close the program using the file and try again.',
    understood: 'Understood',
    
    // Settings modal
    settingsTitle: 'Settings',
    globalPreferences: 'Global Preferences',
    globalPreferencesDesc: 'Settings applied to all tabs',
    binFolderLabel: 'Bin Folder (yt-dlp + FFmpeg):',
    openBinFolder: 'Open Bin Folder',
    playlistLimit: 'Playlist Limit',
    playlistLimitDesc: 'Maximum number of videos to process in playlists (maximum: 10000)',
    ignorePlaylistDefault: 'Ignore playlists by default',
    ignorePlaylistDefaultDesc: 'New Waves will start with "Ignore Playlist" already checked',
    minimizeToTray: 'Minimize to tray',
    minimizeToTrayDesc: 'When minimized, the app stays in the system tray',
    allowLowerQuality: 'Allow lower quality',
    allowLowerQualityDesc: 'Don\'t ask when the chosen resolution is not available',
    allowLowerQualityEnabled: 'Allow lower quality: ON',
    allowLowerQualityDisabled: 'Allow lower quality: OFF',
    allowLowerQualityModeEnabled: 'Allow lower quality mode enabled',
    allowLowerQualityModeDisabled: 'Allow lower quality mode disabled',
    allowLowerQualityRestartTitle: 'Download in progress',
    allowLowerQualityRestartMessage: 'Do you want to {action} "Allow lower quality" and restart the download?',
    allowLowerQualityRestartDetail: 'The download will be canceled and restarted from scratch with the new setting.',
    allowLowerQualityRestartLog: 'Restarting download with "Allow lower quality" {status}...',
    qualityActionEnable: 'enable',
    qualityActionDisable: 'disable',
    qualityStatusEnabled: 'enabled',
    qualityStatusDisabled: 'disabled',
    no: 'No',
    yesRestart: 'Yes, restart',
    cookiesFile: 'Cookies File',
    cookiesFileOptional: 'Cookies File (optional)',
    cookiesFileDesc: 'Required for videos that require authentication',
    cookiesFileFullDesc: 'For downloads that require authentication (private videos, age-restricted videos, etc.)',
    noFileSelected: 'No file selected',
    cookiesFileHelp: 'Use extensions such as "Get cookies.txt LOCALLY" or "cookies.txt" in Chrome/Firefox to export your cookies',
    cookiesFileSelectHelp: 'Use extensions such as "Get cookies.txt LOCALLY" (Chrome/Firefox) or "cookies.txt" to export your browser cookies in Netscape format',
    removeCookiesFile: 'Remove configured cookies file',
    selectCookiesFile: 'Select cookies.txt file',
    selectTxt: 'Select .txt',
    defaultDownloadPath: 'Default Downloads Folder',
    defaultDownloadPathDesc: 'Folder used when no folder has been selected in the tab',
    defaultDownloadPathShortDesc: 'Waves without a configured folder will use this location',
    noDefaultDownloadPath: 'No default folder configured',
    select: 'Select',
    clear: 'Clear',
    remove: 'Remove',
    noPlaylistFolders: 'Don\'t create folders for playlists',
    noPlaylistFoldersDesc: 'Save all files directly to the chosen folder',
    noPlaylistFoldersFullDesc: 'Download all playlist items directly to the chosen folder, without creating a subfolder',
    browserCookies: 'Browser for Cookies (Anti-Bot)',
    browserCookiesDesc: 'Automatically imports cookies from the selected browser to avoid bot detection. You need to be logged into YouTube in this browser.',
    browserPathPlaceholder: 'Select the browser executable (chrome.exe, brave.exe, firefox.exe, etc.)',
    selectBrowser: 'Select Browser',
    selectBrowserTitle: 'Select the browser executable',
    removeBrowserTitle: 'Remove configured browser',
    browserHelp: 'Select your browser executable (ex: chrome.exe, brave.exe, msedge.exe, firefox.exe). Works with any browser.',
    browserImportant: 'IMPORTANT:',
    browserClosedWarning: 'The browser must be CLOSED so cookies can be extracted. Close all browser windows before downloading.',
    language: 'Language',
    languageDesc: 'Application interface language',
    languageTitle: 'Language',
    languageFullDesc: 'Application interface language',
    savePreferences: 'Save Preferences',
    savePreferencesTitle: 'Saves global preferences and the current state of all Waves (name, URL, folder, settings)',
    saved: '✓ Saved!',
    playlistLimitMaxAlert: '⚠️ The maximum playlist limit is 10000 videos!\n\nValue adjusted to 10000.',
    dangerZone: '⚠️ Danger Zone',
    resetAll: 'Reset Everything (Clear Cache)',
    resetAllTitle: '⚠️ Reset Everything',
    resetAllTooltip: 'Removes ALL saved settings and tabs. Use this if something is behaving strangely.',
    resetAllMessage: 'This will DELETE all saved settings, preferences, and tabs!',
    resetAllDetail: 'The app will reload with default settings. This action cannot be undone.',
    resetAllConfirm: 'Yes, Reset Everything',
    resetAllDone: '✅ Everything reset! The app will reload now.',
    close: 'Close',
    
    // Languages
    langPortuguese: 'Português (Brasil)',
    langEnglish: 'English',
    
    // Common buttons
    cancel: 'Cancel',
    confirm: 'Confirm',
    ok: 'OK',
    save: 'Save',
    closeApp: 'Close Application',
    
    // Messages
    noActiveTab: 'No active tab to save as profile!',
    profileExists: 'A profile with this name already exists!',
    noActiveTabApply: 'No active tab to apply the profile!'
  }
};

// Idioma padrão
let currentLanguage = 'pt-BR';

// Função para obter tradução
function t(key, replacements = {}) {
  let text = translations[currentLanguage][key] || translations['pt-BR'][key] || key;
  
  // Substituir variáveis {count}, {name}, etc
  Object.keys(replacements).forEach(placeholder => {
    text = text.replace(`{${placeholder}}`, replacements[placeholder]);
  });
  
  return text;
}

// Função para definir idioma
function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    return true;
  }
  return false;
}

// Carregar idioma salvo
function loadLanguage() {
  const saved = localStorage.getItem('appLanguage');
  if (saved && translations[saved]) {
    currentLanguage = saved;
  }
}

// Inicializar idioma ao carregar
loadLanguage();

export { t, setLanguage, currentLanguage, translations };
