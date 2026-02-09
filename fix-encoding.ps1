# Script para corrigir encoding UTF-8 do main.js
$file = "c:\Desenvolvimento em Js\Interface YT-DL\my-app\src\main.js"

# Ler o arquivo como bytes originais
$bytes = [System.IO.File]::ReadAllBytes($file)
$text = [System.Text.Encoding]::Default.GetString($bytes)

# Substituir caracteres corrompidos pelos corretos
$text = $text -replace 'Conclu.do', 'Conclu

ído'
$text = $text -replace '\? Conclu.do', '✓ Concluído'
$text = $text -replace '<div class="icon-download">\?</div>', '<div class="icon-download">↓</div>'
$text = $text -replace 'depend.ncias', 'dependências'
$text = $text -replace 'Resolu..o', 'Resolução'
$text = $text -replace 'dispon.vel', 'disponível'
$text = $text -replace 'v.deo', 'vídeo'
$text = $text -replace '.udio', 'áudio'
$text = $text -replace 't.tulo', 'título'
$text = $text -replace 'c.digo', 'código'
$text = $text -replace 'usu.rio', 'usuário'
$text = $text -replace 'refer.ncia', 'referência'
$text = $text -replace 'aplicavel', 'aplicável'
$text = $text -replace 'at.', 'até'
$text = $text -replace 'atualiza..o', 'atualização'
$text = $text -replace '.cone', 'Ícone'

# Salvar como UTF-8 sem BOM
[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Arquivo corrigido com sucesso!" -ForegroundColor Green
