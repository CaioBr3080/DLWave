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
    allowLowerQuality: 'Permitir qualidade inferior',
    allowLowerQualityDesc: 'Não perguntar quando a resolução escolhida não estiver disponível',
    cookiesFile: 'Arquivo de Cookies',
    cookiesFileDesc: 'Necessário para vídeos que exigem autenticação',
    selectCookiesFile: 'Selecionar arquivo cookies.txt',
    defaultDownloadPath: 'Pasta Padrão de Downloads',
    defaultDownloadPathDesc: 'Pasta usada quando nenhuma pasta foi selecionada na tab',
    noPlaylistFolders: 'Não criar pastas para playlists',
    noPlaylistFoldersDesc: 'Salvar todos os arquivos diretamente na pasta escolhida',
    language: 'Idioma',
    languageDesc: 'Idioma da interface do aplicativo',
    savePreferences: 'Salvar Preferências',
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
    allowLowerQuality: 'Allow lower quality',
    allowLowerQualityDesc: 'Don\'t ask when the chosen resolution is not available',
    cookiesFile: 'Cookies File',
    cookiesFileDesc: 'Required for videos that require authentication',
    selectCookiesFile: 'Select cookies.txt file',
    defaultDownloadPath: 'Default Downloads Folder',
    defaultDownloadPathDesc: 'Folder used when no folder has been selected in the tab',
    noPlaylistFolders: 'Don\'t create folders for playlists',
    noPlaylistFoldersDesc: 'Save all files directly to the chosen folder',
    language: 'Language',
    languageDesc: 'Application interface language',
    savePreferences: 'Save Preferences',
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
