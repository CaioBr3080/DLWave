// fix-encoding.js - Script Node.js para corrigir encoding
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'main.js');

// Ler arquivo como buffer
const buffer = fs.readFileSync(filePath);

// Converter para string UTF-8
let content = buffer.toString('utf-8');

// Mapeamento de substituições (caracteres corretos em UTF-8)
const fixes = {
  // HTML templates - janela de confirmação
  'Depend?ncias n?o encontradas': 'Dependências não encontradas',
  's?o necess?rios': 'são necessários',
  'n?o funcionar?': 'não funcionará',  
  'depend?ncias': 'dependências',
  'N?o': 'Não',
  
  // HTML templates - janela de progresso
  'Baixando depend?ncias': 'Baixando dependências',
  'Conclu?do': 'Concluído',
  'Conclu�do': 'Concluído',
  
  // HTML templates - janela de resolução
  'Resolu??o': 'Resolução',
  'dispon�vel': 'disponível',
  'v�deo': 'vídeo',
  'n?o est?': 'não está',
  
  // Comentários
  't�tulo': 'título',
  'c�digo': 'código',
  'usu�rio': 'usuário',
  'refer�ncia': 'referência',
  'aplic�vel': 'aplicável',
  'atualiza��o': 'atualização',
  'sa�da': 'saída',
  'for�ar': 'forçar',
  'prefer�ncias': 'preferências',
  '�cone': 'Ícone',
  '�udio': 'áudio',
  
  // Ícones
  '<div class="icon-download">?</div>': '<div class="icon-download">↓</div>',
  "'? Conclu": "'✓ Conclu"
};

// Aplicar substituições
for (const [wrong, correct] of Object.entries(fixes)) {
  const regex = new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, correct);
}

// Salvar como UTF-8 sem BOM
fs.writeFileSync(filePath, content, { encoding: 'utf-8' });

console.log('✓ Encoding corrigido com sucesso!');
