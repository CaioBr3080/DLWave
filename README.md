# 🌊 DLWave

<div align="center">

![DLWave](https://img.shields.io/badge/DLWave-1.2.1.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-28+-purple)

**Uma interface moderna e intuitiva para baixar vídeos e áudios usando yt-dlp e ffmpeg.**

DLWave combina o poder do `yt-dlp` com uma interface gráfica simples, feita para quem quer baixar vídeos, músicas, playlists e trechos específicos sem precisar usar terminal.

[Download](#-download) • [Recursos](#-recursos) • [Instalação](#-instalação) • [Uso](#-uso) • [Desenvolvimento](#-desenvolvimento)

<img width="1919" height="1055" alt="image" src="https://github.com/user-attachments/assets/3acb61a2-b004-4c22-aecf-b2a728471f89" />

</div>

---

## ✨ Recursos

### 🎯 Interface intuitiva

* **Sistema de abas — Waves**: gerencie múltiplos downloads em paralelo.
* **Tema escuro moderno**: interface confortável e direta.
* **Suporte multilíngue**: Português do Brasil e English.
* **Fluxo simples**: cole o link, escolha o formato, selecione a pasta e baixe.

### 📥 Downloads poderosos

* **Vídeos em múltiplos formatos**: MP4, MKV, WEBM, AVI, MOV e FLV.
* **Áudios em alta qualidade**: MP3, M4A, OPUS, FLAC, WAV, AAC e OGG.
* **Várias resoluções**: 4K, 2K, Full HD, HD, SD e outras opções disponíveis.
* **Download de playlists**: suporte para playlists, mixes e listas compatíveis.
* **Downloads simultâneos**: baixe mais de um conteúdo ao mesmo tempo.
* **Corte durante o download**: escolha um trecho específico do vídeo ou áudio para baixar.

### 🎵 Recursos avançados

* **Suporte a cookies**: útil para vídeos privados, restritos por idade ou sessões autenticadas.
* **Perfis salvos**: salve configurações de download para reutilizar depois.
* **Pasta padrão**: defina um local automático para novos downloads.
* **Ignorar playlists**: baixe apenas o vídeo individual mesmo quando o link estiver dentro de uma playlist.
* **Controle de pasta de playlist**: escolha se os itens da playlist serão salvos em uma subpasta ou direto na pasta escolhida.
* **Atualização automática do yt-dlp**: o app pode verificar e baixar versões mais recentes da engine de download.

### 🛠️ Tecnologia

* **yt-dlp**: engine principal de download.
* **ffmpeg**: conversão, corte e processamento de mídia.
* **Electron**: aplicação desktop multiplataforma.
* **Instalação automática de dependências**: yt-dlp e ffmpeg são baixados automaticamente na primeira execução.
* **Proteção contra múltiplas instâncias**: evita abrir várias janelas do app ao mesmo tempo.

---

## 📦 Download

Baixe a versão mais recente na página de releases:

[➡️ DLWave Releases](https://github.com/CaioBr3080/DLWave/releases)

### Windows

1. Baixe o instalador `.exe` mais recente.
2. Execute o arquivo.
3. O DLWave será instalado automaticamente.
4. Um atalho será criado no Menu Iniciar.

---

## ⚠️ Aviso de antivírus

Alguns antivírus podem marcar o DLWave como suspeito. Isso pode acontecer porque:

* O executável ainda não possui assinatura digital.
* O app baixa arquivos da internet, como `yt-dlp`, `ffmpeg` e os conteúdos solicitados pelo usuário.
* Aplicativos novos podem não ter reputação suficiente em bancos de dados de antivírus.
* Downloaders costumam ser analisados com mais cautela por ferramentas de segurança.

O DLWave é **open-source**. Você pode verificar o código neste repositório, compilar o app manualmente ou adicionar uma exceção no antivírus caso confie na origem do download.

Veja também: [ANTIVIRUS.md](ANTIVIRUS.md)

---

## 📖 Uso

### Download básico

1. Clique no botão `+` para criar uma nova **Wave**.
2. Cole a URL do vídeo, áudio ou playlist.
3. Escolha o tipo de download: vídeo ou áudio.
4. Selecione formato, qualidade e resolução.
5. Escolha a pasta de destino.
6. Clique em **Download** 🚀

### Corte de vídeo ou áudio

1. Cole a URL normalmente.
2. Ative a opção de corte.
3. Informe o tempo inicial e final do trecho desejado.
4. Inicie o download.

O DLWave baixa apenas o trecho selecionado sempre que possível, usando os recursos do `yt-dlp` e do `ffmpeg`.

### Perfis de download

Você pode salvar configurações recorrentes como perfil:

* Formato preferido.
* Qualidade/resolução.
* Pasta de destino.
* Preferências de playlist.
* Opções de áudio ou vídeo.

Depois, basta carregar o perfil para reutilizar as mesmas configurações.

### Configurações globais

O app permite configurar:

* Pasta padrão de downloads.
* Idioma da interface.
* Cookies do navegador.
* Comportamento com playlists.
* Qualidade inferior quando a escolhida não estiver disponível.
* Atualizações do yt-dlp.

---

## 🔧 Requisitos

### Para usar o app

* Windows 10/11 64-bit.
* Conexão com a internet.
* Espaço livre para os downloads e dependências.

Na primeira execução, o DLWave baixa automaticamente o `yt-dlp` e o `ffmpeg`.

### Para desenvolvimento

* Node.js v18 ou superior.
* npm ou yarn.
* Git.

---

## 🛠️ Desenvolvimento

### Clonar o repositório

```bash
git clone https://github.com/CaioBr3080/DLWave.git
cd DLWave
npm install
```

### Executar em modo desenvolvimento

```bash
npm start
```

### Gerar instalador

```bash
npm run make
```

Os artefatos serão gerados em `out/make/`, variando conforme a plataforma.

No Windows, o instalador geralmente será gerado em:

```bash
out/make/squirrel.windows/x64/
```

---

## 🔧 Tecnologias utilizadas

* [Electron](https://www.electronjs.org/) — framework desktop.
* [yt-dlp](https://github.com/yt-dlp/yt-dlp) — engine de download.
* [ffmpeg](https://ffmpeg.org/) — processamento multimídia.
* [Vite](https://vitejs.dev/) — build tool.
* [Electron Forge](https://www.electronforge.io/) — empacotamento e distribuição.

---

## 🤝 Contribuindo

Contribuições são bem-vindas.

Você pode ajudar com:

* Correções de bugs.
* Melhorias na interface.
* Traduções.
* Testes em diferentes plataformas.
* Sugestões de recursos.
* Melhorias na documentação.

### Como contribuir

1. Faça um fork do projeto.
2. Crie uma branch para sua alteração:

```bash
git checkout -b feature/NovaFeature
```

3. Faça commit das mudanças:

```bash
git commit -m "Adiciona NovaFeature"
```

4. Envie para o seu fork:

```bash
git push origin feature/NovaFeature
```

5. Abra um Pull Request.

---

## 📝 Changelog

### v1.2.1.1

* Adição de corte para vídeos e áudios.
* Melhorias na tradução em inglês.
* Atualização automática do yt-dlp.
* Melhor suporte a Twitter/X.
* Correção da opção “Permitir qualidade inferior”.
* Melhorias gerais de estabilidade.

---

## 📄 Licença

Este projeto está sob a licença MIT.

Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## ⚠️ Disclaimer

Este software é fornecido para uso pessoal e educacional.

Respeite os direitos autorais, as leis aplicáveis e os Termos de Serviço das plataformas utilizadas. O desenvolvedor não se responsabiliza pelo uso indevido da ferramenta.

---

## 🙏 Agradecimentos

* [yt-dlp](https://github.com/yt-dlp/yt-dlp), pela excelente engine de download.
* [ffmpeg](https://ffmpeg.org/), pelo processamento de mídia.
* Comunidade Electron.
* Comunidade open-source.

---

<div align="center">

**Feito com ❤️ por [CaioBr3080](https://github.com/CaioBr3080)**

Se este projeto foi útil, considere deixar uma ⭐ no repositório.

</div>
