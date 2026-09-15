# ==============================================================================
# Script de Verificacion Estructural de Delimitadores en Archivos JavaScript
# Proyecto: QA Form Field Validator
# ==============================================================================

$repoRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$jsFiles = Get-ChildItem -Path $repoRoot -Recurse -Filter *.js | Where-Object { $_.FullName -notmatch '\\\.git\\' }
$hasError = $false

Write-Host "`nIniciando auditoria de delimitadores en archivos JavaScript..." -ForegroundColor Cyan

foreach ($file in $jsFiles) {
    $relativePath = $file.FullName.Substring($repoRoot.Length).TrimStart('\', '/')
    $text = [System.IO.File]::ReadAllText($file.FullName)
    
    $openCurly   = ($text -split '\{').Count - 1
    $closeCurly  = ($text -split '\}').Count - 1
    $openParen   = ($text -split '\(').Count - 1
    $closeParen  = ($text -split '\)').Count - 1
    $openSquare  = ($text -split '\[').Count - 1
    $closeSquare = ($text -split '\]').Count - 1

    Write-Host "`nArchivo: $relativePath"
    Write-Host "  Llaves     {}: abiertas = $openCurly, cerradas = $closeCurly"
    Write-Host "  Parentesis (): abiertos = $openParen, cerrados = $closeParen"
    Write-Host "  Corchetes  []: abiertos = $openSquare, cerrados = $closeSquare"

    if ($openCurly -ne $closeCurly -or $openParen -ne $closeParen -or $openSquare -ne $closeSquare) {
        Write-Host "  ==> ERROR: Desbalance de delimitadores detectado en $relativePath" -ForegroundColor Red
        $hasError = $true
    } else {
        Write-Host "  ==> BALANCE PERFECTO OK" -ForegroundColor Green
    }
}

# Verificacion estricta de manifest.json (Chromium Manifest V3)
$manifestPath = Join-Path $repoRoot "manifest.json"
if (Test-Path $manifestPath) {
    Write-Host "`nArchivo: manifest.json"
    $manifestText = [System.IO.File]::ReadAllText($manifestPath)
    if ($manifestText -match '(?m)^\s*//' -or $manifestText -match '(?m)^\s*/\*' -or $manifestText -match '(?<!https?:)//') {
        Write-Host "  ==> ERROR: Comentarios detectados en manifest.json (prohibidos en Chromium)" -ForegroundColor Red
        $hasError = $true
    } else {
        try {
            $null = ConvertFrom-Json -InputObject $manifestText -ErrorAction Stop
            Write-Host "  ==> JSON ESTRICTO SIN COMENTARIOS OK" -ForegroundColor Green
        } catch {
            Write-Host "  ==> ERROR: manifest.json no es un JSON valido: $_" -ForegroundColor Red
            $hasError = $true
        }
    }
}

if ($hasError) {
    Write-Host "`nFallo de verificacion: Existen componentes con errores sintacticos o desbalance.`n" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nVerificacion exitosa: Todos los archivos verificados mantienen balance perfecto y sintaxis integra.`n" -ForegroundColor Green
    exit 0
}
