# 🤝 Contribuindo para o DLWave

Obrigado pelo interesse em contribuir! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Como Contribuir

### 🐛 Reportar Bugs

Se você encontrou um bug:

1. Verifique se o bug já foi reportado em [Issues](https://github.com/caioa/DLWave/issues)
2. Se não foi, abra uma nova issue incluindo:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs. comportamento atual
   - Screenshots (se aplicável)
   - Versão do Windows
   - Versão do DLWave

### ✨ Sugerir Features

Para sugerir novas funcionalidades:

1. Verifique se já não existe uma issue similar
2. Abra uma nova issue com tag `enhancement`
3. Descreva detalhadamente:
   - Qual problema a feature resolve
   - Como você imagina que funcionaria
   - Exemplos de uso

### 🔧 Pull Requests

1. **Fork** o repositório
2. **Clone** seu fork localmente:
   ```bash
   git clone https://github.com/seu-usuario/DLWave.git
   cd DLWave
   ```

3. **Crie uma branch** para sua feature:
   ```bash
   git checkout -b feature/minha-feature
   ```

4. **Instale dependências**:
   ```bash
   npm install
   ```

5. **Faça suas alterações** seguindo o estilo do código existente

6. **Teste suas mudanças**:
   ```bash
   npm start
   ```

7. **Commit** suas mudanças:
   ```bash
   git commit -m "feat: adiciona nova funcionalidade X"
   ```

8. **Push** para seu fork:
   ```bash
   git push origin feature/minha-feature
   ```

9. Abra um **Pull Request** no repositório original

## 📝 Padrões de Código

### Commits

Use mensagens de commit descritivas seguindo o padrão:

- `feat: adiciona nova funcionalidade`
- `fix: corrige bug X`
- `docs: atualiza documentação`
- `style: formatação de código`
- `refactor: refatora código Y`
- `test: adiciona testes`
- `chore: atualiza dependências`

### JavaScript

- Use indentação de 2 espaços
- Use ponto-e-vírgula
- Nomes de variáveis em camelCase
- Nomes de classes em PascalCase
- Use `const` e `let`, evite `var`
- Adicione comentários quando necessário

### Traduções

Ao adicionar novas strings de interface:

1. Adicione em **português** em `src/translations.js` (seção `pt-BR`)
2. Adicione em **inglês** em `src/translations.js` (seção `en-US`)
3. Use a função `t()` no código para carregar a tradução

Exemplo:
```javascript
// translations.js
'pt-BR': {
  novaFeature: 'Minha Nova Feature',
  // ...
}
'en-US': {
  novaFeature: 'My New Feature',
  // ...
}

// renderer.js
const texto = t('novaFeature');
```

## 🧪 Testando

Antes de fazer um PR:

1. Teste o app em modo desenvolvimento (`npm start`)
2. Teste build/instalador (`npm run make`)
3. Verifique se não quebrou funcionalidades existentes
4. Teste em Windows (versões diferentes se possível)

## 📁 Estrutura do Projeto

```
DLWave/
├── src/
│   ├── main.js           # Processo principal Electron
│   ├── preload.js        # Bridge IPC seguro
│   ├── renderer.js       # Lógica da interface
│   └── translations.js   # Sistema de i18n
├── core/
│   └── dependencyManager.js  # Gerencia yt-dlp/ffmpeg
├── index.html           # HTML da interface
├── index.css            # Estilos CSS
├── forge.config.js      # Config Electron Forge
└── package.json         # Dependências e scripts
```

## 🎯 Áreas que Precisam de Ajuda

- 🌐 **Traduções** - Adicionar mais idiomas (ES, ZH, etc)
- 🎨 **UI/UX** - Melhorias de interface e usabilidade
- 🐛 **Bug fixes** - Correção de problemas reportados
- 📝 **Documentação** - Melhorar docs e tutoriais
- ✨ **Features** - Implementar itens da roadmap

## ❓ Dúvidas

Se tiver dúvidas sobre como contribuir:

- Abra uma [Discussion](https://github.com/caioa/DLWave/discussions)
- Comente em uma issue existente
- Envie email para [seu-email]

## 📜 Código de Conduta

- Seja respeitoso com outros contribuidores
- Aceite críticas construtivas
- Foque no que é melhor para o projeto
- Seja paciente com iniciantes

## 🙏 Agradecimentos

Toda contribuição é valiosa, seja código, documentação, reports de bugs ou sugestões!

Obrigado por ajudar a tornar o DLWave melhor! 🌊
