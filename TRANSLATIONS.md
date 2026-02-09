# Sistema de Traduções - DLWave

## Idiomas Disponíveis
- 🇧🇷 Português (Brasil) - `pt-BR` (Padrão)
- 🇺🇸 English - `en`

## Como Adicionar Novos Idiomas

### 1. Editar `src/translations.js`

Adicione um novo objeto de idioma no objeto `translations`:

```javascript
const translations = {
  'pt-BR': { /* ... */ },
  'en': { /* ... */ },
  'es': {  // Novo idioma: Espanhol
    appTitle: 'DLWave',
    settings: 'Configuración',
    newTab: 'Nueva Wave',
    // ... adicione todas as chaves
  }
};
```

### 2. Adicionar no Seletor de Idiomas

Em `src/renderer.js` na função `showSettingsModal()`, adicione a nova opção:

```html
<select id="languageSelect" ...>
  <option value="pt-BR">Português (Brasil)</option>
  <option value="en">English</option>
  <option value="es">Español</option>  <!-- Novo -->
</select>
```

### 3. Atualizar Labels de Idiomas

Adicione as traduções para o próprio nome do idioma em cada idioma:

```javascript
// Em cada idioma em translations.js
langSpanish: 'Español',  // Nome do novo idioma
```

## Estrutura de Chaves

Todas as strings visíveis ao usuário devem ter uma chave correspondente:

- **Top bar**: appTitle, settings
- **Tabs**: newTab, renameTab, closeTab
- **Main content**: pageTitle, pageSubtitle, urlLabel, etc.
- **Options**: downloadType, format, resolution, etc.
- **Buttons**: startDownload, cancelDownload, save, etc.
- **Modals**: newProfileTitle, deleteProfileMessage, etc.
- **Messages**: noActiveTab, profileExists, etc.

## Uso no Código

### Tradução simples:
```javascript
t('appTitle')  // Retorna: "DLWave"
```

### Tradução com variáveis:
```javascript
t('downloadsActiveMessage', { count: 3 })
// Retorna: "Há 3 Wave(s) com download ativo:" (pt-BR)
// Retorna: "There are 3 Wave(s) with active downloads:" (en)
```

## Atualizar Interface

Sempre que o idioma mudar, a função `updateInterfaceLanguage()` é chamada automaticamente para atualizar todos os textos visíveis.

## Persistência

O idioma selecionado é salvo em `localStorage` com a chave `appLanguage` e carregado automaticamente quando o app inicia.
