# 🌊 DLWave

<div align="center">

![DLWave](https://img.shields.io/badge/DLWave-1.1.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-28+-purple)

**Downloader de vídeos e áudios do YouTube com interface moderna e intuitiva**

Construído com Electron, yt-dlp e ffmpeg

[Download](#-download) • [Recursos](#-recursos) • [Instalação](#-instalação) • [Uso](#-uso) • [Desenvolvimento](#-desenvolvimento)


<img width="2102" height="1429" alt="image" src="https://github.com/user-attachments/assets/92eff8a3-a9a8-4e0d-81d8-f5206b72de5b" />

---

## ✨ Recursos

### 🎯 Interface Intuitiva
- **Sistema de Tabs (Waves)** - Gerencie múltiplos downloads simultaneamente
- **Tema escuro moderno** - Interface elegante e confortável para os olhos
- **Suporte a múltiplos idiomas** - Português (Brasil) e English

### 📥 Downloads Poderosos
- **Vídeos em múltiplos formatos** - MP4, MKV, WEBM, AVI, MOV, FLV
- **Áudio em alta qualidade** - MP3, M4A, OPUS, FLAC, WAV, AAC, OGG
- **Resoluções variadas** - 4K, 2K, Full HD, HD, SD e mais
- **Download de playlists** - Suporte completo para playlists e mixes do YouTube
- **Download simultâneo** - Múltiplos downloads ao mesmo tempo

### 🎵 Recursos Avançados
- **Cookies para vídeos privados** - Suporte para vídeos age-restricted e privados
- **Perfis salvos** - Salve suas configurações favoritas
- **Pasta padrão** - Configure um local padrão para downloads
- **Ignorar playlists** - Opção para baixar apenas um vídeo de uma playlist
- **Sem pastas de playlist** - Baixe todos os itens direto na pasta escolhida

### 🛠️ Tecnologia
- **yt-dlp** - Download automático da versão mais recente
- **ffmpeg** - Conversão e processamento de mídia
- **Instalador automático** - Baixa dependências na primeira execução
- **Proteção contra múltiplas instâncias** - Apenas uma janela por vez

## 📦 Download

### Instalador Windows (Recomendado)

Baixe a versão mais recente em [Releases](https://github.com/CaioBr3080/DLWave/releases)

**Arquivo:** `DLWave-1.1.1 Setup.exe`

### ⚠️ Aviso de Antivírus

Antivírus como Windows Defender e Avast podem marcar o aplicativo como suspeito. **Isso é normal** porque:

- O executável não está assinado digitalmente (certificados custam ~R$ 500-1500/ano)
- O app baixa arquivos da internet (yt-dlp, ffmpeg, vídeos)
- É um aplicativo novo sem "reputação estabelecida"

**O DLWave é 100% seguro e open source.** Você pode:
1. Adicionar exceção no seu antivírus (veja [ANTIVIRUS.md](ANTIVIRUS.md))
2. Verificar todo o código-fonte neste repositório
3. Compilar você mesmo a partir do código

## 🚀 Instalação

1. **Baixe** o instalador `DLWave-1.1.1 Setup.exe`
2. **Execute** o instalador
3. **Aguarde** a instalação (cria atalho no Menu Iniciar)
4. **Abra** o DLWave
5. **Instale dependências** (yt-dlp + ffmpeg) quando solicitado

**Local de instalação:**
```
C:\Users\[SeuUsuário]\AppData\Local\dlwave\
```

## 📖 Uso

### Download Básico

1. **Crie uma Wave** (tab) clicando no botão `+`
2. **Cole a URL** do vídeo/playlist do YouTube
3. **Selecione o formato** (vídeo ou áudio)
4. **Escolha a resolução** (para vídeos)
5. **Selecione a pasta** de destino
6. **Clique em Download** 🚀

### Recursos Extras

#### 🎨 Perfis de Download
- Clique em **Salvar** na barra lateral direita
- Nomeie seu perfil
- Carregue perfis salvos quando precisar

#### ⚙️ Configurações Globais
- **Pasta padrão** - Local automático para novos downloads
- **Cookies** - Para vídeos privados ou age-restricted
- **Idioma** - Português ou English
- **Preferências de download** - Ignorar playlists, permitir qualidade inferior, etc.

#### 🎵 Download de Playlists
- Cole a URL da playlist
- Desmarque "Ignorar Playlist" se necessário
- Escolha se quer criar pasta para a playlist
- Baixe todos os itens de uma vez

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js v18+ 
- npm ou yarn
- Git

### Clonar e Instalar

```bash
git clone https://github.com/caioa/DLWave.git
cd DLWave
npm install
```

### Executar em Desenvolvimento

```bash
npm start
```

### Compilar Instalador

```bash
npm run make
```

O instalador será gerado em: `out/make/squirrel.windows/x64/`

### Estrutura do Projeto

```
DLWave/
├── src/
│   ├── main.js           # Processo principal Electron
│   ├── preload.js        # Bridge IPC
│   ├── renderer.js       # Interface e lógica frontend
│   └── translations.js   # Sistema de traduções
├── core/
│   └── dependencyManager.js  # Gerenciador yt-dlp/ffmpeg
├── index.html           # Interface principal
├── index.css            # Estilos
├── forge.config.js      # Configuração Electron Forge
└── package.json
```

## 🔧 Tecnologias Utilizadas

- **[Electron](https://www.electronjs.org/)** - Framework desktop
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - Engine de download
- **[ffmpeg](https://ffmpeg.org/)** - Processamento de mídia
- **[Vite](https://vitejs.dev/)** - Build tool
- **[Electron Forge](https://www.electronforge.io/)** - Empacotamento

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se livre para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abrir um Pull Request

## 📝 Changelog

### v1.1.1 (2026-02-09)
- ✨ Correções no gerenciamento de resolução
- 🌐 Melhorias na extração de cookies
- 💾 Limitador no donwload de playlists
- 📂 Correções no cancelamento de donwload
- 🎵 Suporte a plataforma além do YouTube 
- ⏬ Instalação do YT-DLP via Winget e
     atualização periódica do mesmo

## 📄 Licença

Este projeto está sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## ⚠️ Disclaimer

Este software é fornecido apenas para uso educacional e pessoal. Respeite os direitos autorais e os Termos de Serviço do YouTube. O desenvolvedor não se responsabiliza pelo uso indevido desta ferramenta.

## 🙏 Agradecimentos

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Excelente ferramenta de download
- [ffmpeg](https://ffmpeg.org/) - Processamento multimídia
- Comunidade Electron

---

<div align="center">

**Feito com ❤️ por [CaioBr3080](https://github.com/CaioBr3080)**

Se este projeto foi útil, considere dar uma ⭐!

</div>
