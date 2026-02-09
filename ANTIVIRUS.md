# 🛡️ DLWave e Antivírus

## Por que o antivírus está bloqueando o DLWave?

O DLWave é **100% seguro**, mas antivírus como Avast, Windows Defender e outros podem marcar como suspeito porque:

1. **Executável não assinado digitalmente** - Aplicativos sem assinatura digital são considerados "não verificados"
2. **Comportamento de download** - O app baixa arquivos da internet (yt-dlp, ffmpeg, vídeos)
3. **Acesso ao sistema de arquivos** - Precisa criar pastas, salvar arquivos
4. **Aplicativo novo** - Sem reputação estabelecida

## ✅ Soluções

### Opção 1: Adicionar exceção no antivírus (Recomendado)

#### Avast:
1. Abra o Avast
2. Menu → **Configurações** → **Proteção**
3. **Principais Escudos de Proteção**
4. **Exceções** → **Adicionar exceção**
5. Adicione a pasta: `C:\Users\[SeuUsuário]\AppData\Local\dlwave\`

#### Windows Defender:
1. Configurações do Windows → **Privacidade e Segurança**
2. **Segurança do Windows** → **Proteção contra vírus e ameaças**
3. **Gerenciar configurações**
4. Role até **Exclusões** → **Adicionar ou remover exclusões**
5. **Adicionar uma exclusão** → **Pasta**
6. Selecione: `C:\Users\[SeuUsuário]\AppData\Local\dlwave\`

### Opção 2: Assinatura Digital (Para distribuição pública)

Para remover completamente os avisos do antivírus, o ideal é assinar digitalmente o aplicativo.

**Requisitos:**
- Certificado de Code Signing (EV ou OV)
- Custo: ~R$ 500-1500/ano
- Fornecedores: DigiCert, Sectigo, GlobalSign

**Configuração já preparada em `forge.config.js`** - basta descomentar e adicionar o certificado.

## 🔒 Como verificar que o DLWave é seguro?

1. **Código-fonte 100% aberto** - Todo o código está disponível publicamente no [GitHub](https://github.com/caioa/DLWave)
2. **Licença MIT** - Software livre e open source
3. **Sem telemetria** - Não envia dados para servidores externos
4. **Sem ads ou malware** - Completamente gratuito e limpo
5. **Dependências conhecidas:**
   - Electron (framework oficial para apps desktop)
   - yt-dlp (downloader oficial do YouTube, usado por milhões)
   - ffmpeg (conversor multimídia padrão da indústria)
6. **Compile você mesmo** - Baixe o código e compile localmente se quiser

**Repositório oficial:** https://github.com/caioa/DLWave

## 🔗 Links Úteis

- [yt-dlp (oficial)](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg (oficial)](https://ffmpeg.org/)
- [Electron](https://www.electronjs.org/)
