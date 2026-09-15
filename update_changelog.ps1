# ==============================================================================
# Script de Automatizacion de Registro de Cambios (Changelog) y Control de Versiones
# Proyecto: QA Form Field Validator
# Estandares: Keep a Changelog 1.1.0 y Semantic Versioning 2.0.0 (SemVer)
# Politica de estilo: Tono corporativo, idioma espanol y cero emojis
# ==============================================================================

[CmdletBinding(DefaultParameterSetName = 'Update')]
param(
    [Parameter(ParameterSetName = 'Update')]
    [switch]$UpdateUnreleased,

    [Parameter(ParameterSetName = 'Release', Mandatory = $true)]
    [string]$ReleaseVersion,

    [Parameter(ParameterSetName = 'Bump', Mandatory = $true)]
    [ValidateSet('major', 'minor', 'patch')]
    [string]$Bump,

    [Parameter(ParameterSetName = 'GenerateHistory')]
    [switch]$GenerateFromHistory,

    [Parameter(ParameterSetName = 'Verify')]
    [switch]$Verify,

    [Parameter()]
    [string]$TargetVersion = '1.0.0',

    [Parameter()]
    [string]$FromCommit,

    [Parameter()]
    [string]$ToCommit = 'HEAD',

    [Parameter()]
    [string]$RepoUrl,

    [Parameter()]
    [string]$ChangelogFile = 'CHANGELOG.md',

    [Parameter()]
    [string]$ManifestFile = 'manifest.json',

    [Parameter()]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Directorio raiz del repositorio
$repoRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$changelogPath = Join-Path $repoRoot $ChangelogFile
$manifestPath  = Join-Path $repoRoot $ManifestFile

# ------------------------------------------------------------------------------
# 1. Constantes y Expresiones Regulares
# ------------------------------------------------------------------------------

# Patron Unicode exhaustivo para deteccion de emojis y pictogramas
$EmojiPattern = '[\uD83C-\uD83F][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50\u2B55\u2934\u2935\u25AA\u25AB\u25FE\u25FD\u25FB\u25FC]|[\u3030\u303D]|[\u3297\u3299]|\uFE0F'

# Patron de validacion para Semantic Versioning 2.0.0
$SemVerPattern = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$'

# Cadenas con acentos y caracteres especiales espanoles mediante codigos de caracter
$script:CatAnadido      = 'A' + [char]0x00F1 + 'adido'
$script:CatDocumentacion = 'Documentaci' + [char]0x00F3 + 'n'
$CategoryOrder = @($script:CatAnadido, 'Cambiado', 'Corregido', 'Seguridad', $script:CatDocumentacion)

# ------------------------------------------------------------------------------
# 2. Funciones de Deteccion y Sanitizacion de Emojis
# ------------------------------------------------------------------------------

function Test-HasEmoji {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $false }
    return ($Text -match $EmojiPattern)
}

function Remove-Emojis {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $Text }
    return [regex]::Replace($Text, $EmojiPattern, '')
}

function Assert-NoEmojisInContent {
    param(
        [string]$Content,
        [string]$ContextName
    )
    if (Test-HasEmoji $Content) {
        throw "Violacion de estilo: Se detectaron emojis no autorizados en: $ContextName"
    }
}

# ------------------------------------------------------------------------------
# 3. Funciones de Versionado Semantico (SemVer 2.0.0)
# ------------------------------------------------------------------------------

function Test-SemVerFormat {
    param([string]$Version)
    return ($Version -match $SemVerPattern)
}

function Get-NextSemVer {
    param(
        [string]$CurrentVersion,
        [string]$Type
    )
    if ($CurrentVersion -match '^(\d+)\.(\d+)\.(\d+)') {
        [int]$major = [int]$matches[1]
        [int]$minor = [int]$matches[2]
        [int]$patch = [int]$matches[3]

        switch ($Type.ToLower()) {
            'major' { return "$($major + 1).0.0" }
            'minor' { return "$major.$($minor + 1).0" }
            'patch' { return "$major.$minor.$($patch + 1)" }
            default { throw "Tipo de incremento no reconocido: $Type" }
        }
    } else {
        throw "La version actual '$CurrentVersion' no posee una estructura basica X.Y.Z valida"
    }
}

# ------------------------------------------------------------------------------
# 4. Funciones de Lectura y Modificacion de manifest.json
# ------------------------------------------------------------------------------

function Get-ManifestData {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Archivo de manifiesto no localizado en: $Path"
    }
    $rawText = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)

    # Validacion estricta: prohibicion de comentarios en Chromium Manifest V3
    if ($rawText -match '//' -or $rawText -match '/\*') {
        throw "manifest.json contiene comentarios de codigo (no admitidos en Chromium)"
    }

    $jsonObject = ConvertFrom-Json -InputObject $rawText -ErrorAction Stop
    if (-not $jsonObject.version) {
        throw "manifest.json no contiene la propiedad requerida 'version'"
    }

    return @{
        Raw     = $rawText
        Json    = $jsonObject
        Version = [string]$jsonObject.version
    }
}

function Update-ManifestVersionSafe {
    param(
        [string]$Path,
        [string]$NewVersion,
        [switch]$IsDryRun
    )
    if (-not (Test-SemVerFormat $NewVersion)) {
        throw "La version especificada '$NewVersion' no cumple con la norma SemVer 2.0.0"
    }
    Assert-NoEmojisInContent -Content $NewVersion -ContextName "Nueva version de manifest.json"

    $manifest = Get-ManifestData -Path $Path
    $rawText  = $manifest.Raw

    # Sustitucion segura de la clave version preservando espaciado y estructura
    $regexPattern = '("version"\s*:\s*)"[^"]+"'
    if (-not ($rawText -match $regexPattern)) {
        throw "No se localizo la propiedad 'version' en manifest.json para su actualizacion"
    }

    $updatedText = [regex]::Replace($rawText, $regexPattern, ('$1"' + $NewVersion + '"'))

    # Auditoria sintactica de salida
    try {
        $verifiedJson = ConvertFrom-Json -InputObject $updatedText -ErrorAction Stop
        if ($verifiedJson.version -ne $NewVersion) {
            throw "Discrepancia interna tras reemplazo de version"
        }
    } catch {
        throw "Error critico al validar sintaxis de manifest.json modificado: $_"
    }

    if (-not $IsDryRun) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($Path, $updatedText, $utf8NoBom)
        Write-Host "  [OK] Version en manifest.json sincronizada a: $NewVersion" -ForegroundColor Green
    } else {
        Write-Host "  [DRY-RUN] Se sincronizaria manifest.json a: $NewVersion" -ForegroundColor Yellow
    }

    return $NewVersion
}

# ------------------------------------------------------------------------------
# 5. Funciones de Analisis de Git e Historial de Commits
# ------------------------------------------------------------------------------

function Get-GitRepoUrl {
    param([string]$Dir)
    try {
        $remoteOutput = git -C $Dir remote get-url origin 2>$null
        if ($remoteOutput) {
            $cleaned = $remoteOutput.Trim()
            if ($cleaned -match '^git@([^:]+):(.+)\.git$') {
                return "https://$($matches[1])/$($matches[2])"
            }
            if ($cleaned.EndsWith('.git')) {
                $cleaned = $cleaned.Substring(0, $cleaned.Length - 4)
            }
            return $cleaned
        }
    } catch {}
    return "https://github.com/ElHawky09/qa-validador-de-campos"
}

function Get-GitCommitList {
    param(
        [string]$Dir,
        [string]$From,
        [string]$To
    )
    $gitArgs = @('log', '--reverse', '--format=%H|%as|%s')
    if ($From) {
        $gitArgs += "$From..$To"
    } else {
        $gitArgs += $To
    }

    $rawLines = git -C $Dir @gitArgs 2>$null
    $commits = @()

    foreach ($line in $rawLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $parts = $line -split '\|', 3
        if ($parts.Count -lt 3) { continue }

        $hash    = $parts[0].Trim()
        $date    = $parts[1].Trim()
        $subject = $parts[2].Trim()

        $parsed = Convert-CommitToChangelogItem -Hash $hash -Date $date -Subject $subject
        if ($parsed) {
            $commits += $parsed
        }
    }

    return ,$commits
}

function Convert-CommitToChangelogItem {
    param(
        [string]$Hash,
        [string]$Date,
        [string]$Subject
    )
    # Limpieza rigurosa de emojis en el mensaje de confirmacion
    $cleanSubject = Remove-Emojis $Subject

    $type  = ''
    $scope = ''
    $desc  = ''

    # Patron Conventional Commits: tipo(alcance): descripcion
    if ($cleanSubject -match '^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<desc>.+)$') {
        $type  = $matches['type'].ToLower()
        $scope = if ($matches['scope']) { $matches['scope'].Trim().ToLower() } else { '' }
        $desc  = $matches['desc'].Trim()
    } else {
        # Commits sin prefijo convencional estructurado
        $desc = $cleanSubject.Trim()
        if ($desc -match '^Initial commit') {
            $type = 'feat'
            $desc = 'Version inicial de la plataforma QA Form Field Validator'
        } elseif ($desc -match '^(?:merge|checkout|branch)') {
            return $null
        } else {
            $type = 'chore'
        }
    }

    # Normalizacion tipografica: primera letra en mayuscula y puntuacion final
    if ($desc.Length -gt 0) {
        $firstChar = $desc.Substring(0, 1).ToUpper()
        $tail = if ($desc.Length -gt 1) { $desc.Substring(1) } else { '' }
        $desc = "$firstChar$tail"
        if (-not ($desc.EndsWith('.') -or $desc.EndsWith('!') -or $desc.EndsWith('?'))) {
            $desc = "$desc."
        }
    }

    # Mapeo normativo a categorias de Keep a Changelog 1.1.0
    $category = 'Cambiado'
    if ($cleanSubject -match '\b(?:csp|seguridad|security|vulnerab|cve)\b') {
        $category = 'Seguridad'
    } elseif ($type -in @('feat', 'feature')) {
        $category = $script:CatAnadido
    } elseif ($type -in @('fix', 'bugfix', 'hotfix')) {
        $category = 'Corregido'
    } elseif ($type -in @('docs', 'doc')) {
        $category = $script:CatDocumentacion
    } elseif ($type -in @('style', 'refactor', 'perf', 'chore', 'test', 'ci', 'build')) {
        $category = 'Cambiado'
    }

    return [PSCustomObject]@{
        Hash        = $Hash
        ShortHash   = $Hash.Substring(0, [Math]::Min(7, $Hash.Length))
        Date        = $Date
        Type        = $type
        Scope       = $scope
        Description = $desc
        Category    = $category
        RawSubject  = $cleanSubject
    }
}

function Format-MarkdownBullet {
    param($Item)
    if ($Item.Scope) {
        return "- **$($Item.Scope):** $($Item.Description)"
    } else {
        return "- $($Item.Description)"
    }
}

# ------------------------------------------------------------------------------
# 6. Funciones de Estructuracion de CHANGELOG.md
# ------------------------------------------------------------------------------

function Get-ChangelogExistingDescriptions {
    param([string]$Content)
    $lines = $Content -split "`r?`n"
    $descriptions = @()
    foreach ($line in $lines) {
        if ($line -match '^\s*-\s+(?:\*\*[^*]+\*\*:\s*)?(.+)$') {
            $descriptions += $matches[1].Trim()
        }
    }
    return ,$descriptions
}

function Get-ChangelogReleases {
    param([string]$Content)
    $lines = $Content -split "`r?`n"
    $releases = @()
    foreach ($line in $lines) {
        if ($line -match '^##\s*\[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?') {
            $ver = $matches[1].Trim()
            $dt  = if ($matches[2]) { $matches[2].Trim() } else { '' }
            if ($ver -ne 'Sin publicar' -and $ver -ne 'Unreleased') {
                $releases += [PSCustomObject]@{
                    Version = $ver
                    Date    = $dt
                }
            }
        }
    }
    return ,$releases
}

function Test-CommitIsRecordedInChangelog {
    param(
        [string]$ChangelogContent,
        $Commit
    )
    # Comprobar coincidencia por hash corto
    if ($ChangelogContent -match [regex]::Escape($Commit.ShortHash)) {
        return $true
    }
    # Comprobar coincidencia por descripcion
    if ($ChangelogContent -match [regex]::Escape($Commit.Description)) {
        return $true
    }
    # Comprobar coincidencia por palabras clave del asunto
    $subj = $Commit.RawSubject.Trim().ToLower()
    if ($subj.Length -gt 18) {
        $sample = $subj.Substring(0, [Math]::Min(28, $subj.Length))
        if ($ChangelogContent.ToLower().Contains($sample)) {
            return $true
        }
    }
    return $false
}

function Build-VersionMarkdownBlock {
    param(
        [string]$VersionHeading,
        [array]$Items
    )
    $blockLines = @($VersionHeading, "")
    $grouped = @{}
    foreach ($cat in $CategoryOrder) {
        $grouped[$cat] = @()
    }

    foreach ($item in $Items) {
        $cat = $item.Category
        if (-not $grouped.ContainsKey($cat)) {
            $grouped[$cat] = @()
        }
        $grouped[$cat] += $item
    }

    $hasContent = $false
    foreach ($cat in $CategoryOrder) {
        $catItems = $grouped[$cat]
        if ($catItems -and $catItems.Count -gt 0) {
            $hasContent = $true
            $blockLines += "### $cat"
            foreach ($item in $catItems) {
                $blockLines += (Format-MarkdownBullet -Item $item)
            }
            $blockLines += ""
        }
    }

    if (-not $hasContent) {
        return @($VersionHeading, "")
    }

    return $blockLines
}

function Build-ComparisonLinks {
    param(
        [string]$BaseUrl,
        [array]$Releases
    )
    $linkLines = @()
    if ($Releases.Count -gt 0) {
        $latest = $Releases[0].Version
        $linkLines += "[Sin publicar]: $BaseUrl/compare/v$latest...HEAD"

        for ($i = 0; $i -lt $Releases.Count; $i++) {
            $currentVer = $Releases[$i].Version
            if ($i + 1 -lt $Releases.Count) {
                $previousVer = $Releases[$i + 1].Version
                $linkLines += "[$currentVer]: $BaseUrl/compare/v$previousVer...v$currentVer"
            } else {
                $linkLines += "[$currentVer]: $BaseUrl/releases/tag/v$currentVer"
            }
        }
    } else {
        $linkLines += "[Sin publicar]: $BaseUrl/commits/HEAD"
    }
    return $linkLines
}

# ------------------------------------------------------------------------------
# 7. Operaciones Principales: Update, Release, History, Verify
# ------------------------------------------------------------------------------

function Invoke-ChangelogUpdate {
    param(
        [string]$Path,
        [string]$Root,
        [string]$Url,
        [switch]$IsDryRun
    )
    Write-Host "`nAnalizando confirmaciones de Git para actualizar [Sin publicar]..." -ForegroundColor Cyan

    if (-not (Test-Path $Path)) {
        throw "CHANGELOG.md no existe en $Path. Ejecute con -GenerateFromHistory para inicializarlo."
    }

    $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $releases = Get-ChangelogReleases -Content $content
    $latestTag = if ($releases.Count -gt 0) { "v$($releases[0].Version)" } else { '' }

    # Verificar si existe etiqueta Git para la ultima version registrada
    $tagExists = $false
    if ($latestTag) {
        $checkTag = git -C $Root tag -l $latestTag 2>$null
        if ($checkTag -and $checkTag.Trim() -eq $latestTag) {
            $tagExists = $true
        }
    }

    $allCommits = @()
    if ($tagExists) {
        $allCommits = Get-GitCommitList -Dir $Root -From $latestTag -To 'HEAD'
    } else {
        $candidates = Get-GitCommitList -Dir $Root -From '' -To 'HEAD'
        foreach ($cand in $candidates) {
            if (-not (Test-CommitIsRecordedInChangelog -ChangelogContent $content -Commit $cand)) {
                $allCommits += $cand
            }
        }
    }

    if ($allCommits.Count -eq 0) {
        Write-Host "  [INFO] No se detectaron confirmaciones pendientes por registrar." -ForegroundColor Green
        Write-Host "  La seccion [Sin publicar] se encuentra al dia con el historial de Git.`n" -ForegroundColor Green
        return
    }

    Write-Host "  Se identificaron $($allCommits.Count) confirmaciones pendientes." -ForegroundColor Yellow

    # Extraer secciones del changelog existente
    $lines = $content -split "`r?`n"
    $unreleasedIndex = -1
    $firstReleaseIndex = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s*\[Sin publicar\]') {
            $unreleasedIndex = $i
        } elseif ($unreleasedIndex -ge 0 -and $lines[$i] -match '^##\s*\[[^\]]+\]' -and $firstReleaseIndex -lt 0) {
            $firstReleaseIndex = $i
        }
    }

    if ($unreleasedIndex -lt 0) {
        throw "No se localizo la seccion '## [Sin publicar]' en $Path"
    }

    # Contenido restante desde la primera version
    $tailLines = if ($firstReleaseIndex -gt 0) { $lines[$firstReleaseIndex..($lines.Count - 1)] } else { @() }

    # Generar bloque de cambios no publicados
    $unreleasedBlock = Build-VersionMarkdownBlock -VersionHeading "## [Sin publicar]" -Items $allCommits

    $newLines = @()
    $newLines += $lines[0..($unreleasedIndex - 1)]
    $newLines += $unreleasedBlock
    $newLines += $tailLines

    $finalContent = ($newLines -join "`r`n").TrimEnd() + "`r`n"
    Assert-NoEmojisInContent -Content $finalContent -ContextName "CHANGELOG.md actualizado"

    if (-not $IsDryRun) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($Path, $finalContent, $utf8NoBom)
        Write-Host "  [EXITO] CHANGELOG.md actualizado satisfactoriamente con cambios en [Sin publicar].`n" -ForegroundColor Green
    } else {
        Write-Host "  [DRY-RUN] Modificacion proyectada lista para su aplicacion.`n" -ForegroundColor Yellow
    }
}

function Invoke-ChangelogRelease {
    param(
        [string]$Path,
        [string]$MPath,
        [string]$Root,
        [string]$Url,
        [string]$NewVer,
        [switch]$IsDryRun
    )
    Write-Host "`nEjecutando procedimiento de lanzamiento para la version $NewVer..." -ForegroundColor Cyan

    if (-not (Test-SemVerFormat $NewVer)) {
        throw "La version especificada '$NewVer' no cumple con Semantic Versioning (SemVer 2.0.0)"
    }
    Assert-NoEmojisInContent -Content $NewVer -ContextName "Parametro de version"

    if (-not (Test-Path $Path)) {
        throw "CHANGELOG.md no existe en $Path"
    }

    # Paso 1: Sincronizar manifest.json
    Write-Host "Paso 1: Sincronizacion de manifest.json..." -ForegroundColor Gray
    $null = Update-ManifestVersionSafe -Path $MPath -NewVersion $NewVer -IsDryRun:$IsDryRun

    # Paso 2: Actualizar CHANGELOG.md
    Write-Host "Paso 2: Promocion de cambios bajo version [$NewVer]..." -ForegroundColor Gray
    $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $lines   = $content -split "`r?`n"

    $unreleasedIndex = -1
    $firstReleaseIndex = -1
    $linksStartIndex = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s*\[Sin publicar\]') {
            $unreleasedIndex = $i
        } elseif ($unreleasedIndex -ge 0 -and $lines[$i] -match '^##\s*\[[^\]]+\]' -and $firstReleaseIndex -lt 0) {
            $firstReleaseIndex = $i
        }
        if ($lines[$i] -match '^\[[^\]]+\]:\s*http') {
            if ($linksStartIndex -lt 0) { $linksStartIndex = $i }
        }
    }

    if ($unreleasedIndex -lt 0) {
        throw "No se localizo la seccion '## [Sin publicar]' en $Path"
    }

    $existingReleases = Get-ChangelogReleases -Content $content
    $today = (Get-Date).ToString('yyyy-MM-dd')

    # Extraer contenido no publicado existente
    $unreleasedBodyLines = @()
    $endUnreleased = if ($firstReleaseIndex -gt 0) { $firstReleaseIndex - 1 } else { $lines.Count - 1 }
    if ($endUnreleased -gt $unreleasedIndex) {
        $unreleasedBodyLines = $lines[($unreleasedIndex + 1)..$endUnreleased]
    }

    $hasUnreleasedContent = $false
    foreach ($ubl in $unreleasedBodyLines) {
        if ($ubl -match '^\s*-\s+') {
            $hasUnreleasedContent = $true
            break
        }
    }

    # Si la seccion [Sin publicar] estaba vacia, analizar commits pendientes de Git
    $releaseItemsBlock = @()
    if (-not $hasUnreleasedContent) {
        $allCommits = Get-GitCommitList -Dir $Root -From '' -To 'HEAD'
        $unreleasedCommits = @()
        foreach ($commit in $allCommits) {
            if (-not (Test-CommitIsRecordedInChangelog -ChangelogContent $content -Commit $commit)) {
                $unreleasedCommits += $commit
            }
        }
        $releaseItemsBlock = Build-VersionMarkdownBlock -VersionHeading "## [$NewVer] - $today" -Items $unreleasedCommits
    } else {
        # Promocionar lineas existentes bajo el nuevo encabezado
        $releaseItemsBlock = @("## [$NewVer] - $today", "") + $unreleasedBodyLines
    }

    # Construir nueva lista de versiones
    $updatedReleases = @([PSCustomObject]@{ Version = $NewVer; Date = $today }) + $existingReleases

    # Lineas del encabezado
    $newHeader = $lines[0..($unreleasedIndex - 1)]

    # Cuerpo de versiones existentes
    $bodyFromFirstRelease = @()
    $contentLimit = if ($linksStartIndex -gt 0) { $linksStartIndex - 1 } else { $lines.Count - 1 }
    if ($firstReleaseIndex -gt 0 -and $firstReleaseIndex -le $contentLimit) {
        $bodyFromFirstRelease = $lines[$firstReleaseIndex..$contentLimit]
    }

    # Nuevos enlaces de comparacion
    $newLinks = Build-ComparisonLinks -BaseUrl $Url -Releases $updatedReleases

    $assembledLines = @()
    $assembledLines += $newHeader
    $assembledLines += "## [Sin publicar]"
    $assembledLines += ""
    $assembledLines += $releaseItemsBlock
    $assembledLines += $bodyFromFirstRelease
    $assembledLines += ""
    $assembledLines += $newLinks

    $finalText = ($assembledLines -join "`r`n").TrimEnd() + "`r`n"
    Assert-NoEmojisInContent -Content $finalText -ContextName "CHANGELOG.md tras lanzamiento"

    if (-not $IsDryRun) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($Path, $finalText, $utf8NoBom)
        Write-Host "  [EXITO] Version $NewVer registrada y CHANGELOG.md estructurado correctamente.`n" -ForegroundColor Green
    } else {
        Write-Host "  [DRY-RUN] Registro de version simulado con exito.`n" -ForegroundColor Yellow
    }
}

function Invoke-ChangelogGenerateFromHistory {
    param(
        [string]$Path,
        [string]$Root,
        [string]$Url,
        [string]$Ver,
        [switch]$IsDryRun
    )
    Write-Host "`nGenerando registro historico exhaustivo en CHANGELOG.md a partir de Git..." -ForegroundColor Cyan

    $commits = Get-GitCommitList -Dir $Root -From '' -To 'HEAD'
    Write-Host "  Se procesaron $($commits.Count) confirmaciones historicas." -ForegroundColor Gray

    $today = (Get-Date).ToString('yyyy-MM-dd')
    $headerLines = @(
        "# Registro de Cambios (Changelog)",
        "",
        "Todos los cambios notables en este proyecto serán documentados en este archivo.",
        "",
        "El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),",
        "y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/spec/v2.0.0.html).",
        "",
        "## [Sin publicar]",
        ""
    )

    $versionBlock = Build-VersionMarkdownBlock -VersionHeading "## [$Ver] - $today" -Items $commits
    $linksBlock   = Build-ComparisonLinks -BaseUrl $Url -Releases @([PSCustomObject]@{ Version = $Ver; Date = $today })

    $allLines = $headerLines + $versionBlock + @("") + $linksBlock
    $fullContent = ($allLines -join "`r`n").TrimEnd() + "`r`n"

    Assert-NoEmojisInContent -Content $fullContent -ContextName "Generacion inicial de CHANGELOG.md"

    if (-not $IsDryRun) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($Path, $fullContent, $utf8NoBom)
        Write-Host "  [EXITO] CHANGELOG.md generado con $($commits.Count) entradas clasificadas.`n" -ForegroundColor Green
    } else {
        Write-Host "  [DRY-RUN] Generacion de historial simulada con exito.`n" -ForegroundColor Yellow
    }
}

function Invoke-ChangelogVerify {
    param(
        [string]$Path,
        [string]$MPath,
        [string]$Root
    )
    Write-Host "`n==============================================================================" -ForegroundColor Cyan
    Write-Host "Auditoria de Integridad: CHANGELOG.md, Versionado SemVer y Ausencia de Emojis" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan

    $failures = @()

    # 1. Verificacion de existencia de CHANGELOG.md
    if (-not (Test-Path $Path)) {
        $failures += "El archivo CHANGELOG.md no existe en la ruta esperada: $Path"
    } else {
        Write-Host "`n1. Inspeccion de archivo CHANGELOG.md..." -ForegroundColor Gray
        $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)

        # 1.1 Ausencia de emojis
        if (Test-HasEmoji $content) {
            $failures += "Se detectaron caracteres emoji en CHANGELOG.md (infringe politica de estilo)"
        } else {
            Write-Host "  [OK] Cero emojis detectados en CHANGELOG.md" -ForegroundColor Green
        }

        # 1.2 Estructura Keep a Changelog 1.1.0
        if (-not ($content -match '^#\s*Registro de Cambios')) {
            $failures += "CHANGELOG.md no inicia con el titulo normativo '# Registro de Cambios'"
        }
        if (-not ($content -match 'keepachangelog\.com')) {
            $failures += "CHANGELOG.md no cita el enlace de especificacion Keep a Changelog"
        }
        if (-not ($content -match 'semver\.org')) {
            $failures += "CHANGELOG.md no cita el enlace de especificacion Semantic Versioning"
        }
        if (-not ($content -match '##\s*\[Sin publicar\]')) {
            $failures += "CHANGELOG.md carece de la seccion '## [Sin publicar]'"
        }

        # 1.3 Versiones y SemVer
        $releases = Get-ChangelogReleases -Content $content
        if ($releases.Count -eq 0) {
            $failures += "CHANGELOG.md no contiene ninguna version formal registrada"
        } else {
            foreach ($rel in $releases) {
                if (-not (Test-SemVerFormat $rel.Version)) {
                    $failures += "La version '[$($rel.Version)]' no cumple con la especificacion SemVer 2.0.0"
                }
                if ($rel.Date -and -not ($rel.Date -match '^\d{4}-\d{2}-\d{2}$')) {
                    $failures += "La fecha '$($rel.Date)' para la version $($rel.Version) no cumple formato ISO YYYY-MM-DD"
                }
            }
            Write-Host "  [OK] $($releases.Count) versiones formalizadas bajo estandar SemVer 2.0.0" -ForegroundColor Green
        }

        # 1.4 Categorias reconocidas
        $foundCategories = @()
        foreach ($cat in $CategoryOrder) {
            if ($content -match "###\s*$cat") {
                $foundCategories += $cat
            }
        }
        Write-Host "  [OK] Categorias documentadas identificadas: $($foundCategories -join ', ')" -ForegroundColor Green

        # 1.5 Enlaces de comparacion al pie
        if (-not ($content -match '\[Sin publicar\]:\s*https?://')) {
            $failures += "CHANGELOG.md no define el enlace de comparacion al pie para [Sin publicar]"
        } else {
            Write-Host "  [OK] Enlaces de comparacion Markdown validados al pie del documento" -ForegroundColor Green
        }
    }

    # 2. Verificacion de manifest.json
    Write-Host "`n2. Inspeccion de manifest.json..." -ForegroundColor Gray
    if (-not (Test-Path $MPath)) {
        $failures += "El archivo manifest.json no existe en: $MPath"
    } else {
        $rawM = [System.IO.File]::ReadAllText($MPath, [System.Text.Encoding]::UTF8)

        if (Test-HasEmoji $rawM) {
            $failures += "Se detectaron caracteres emoji en manifest.json"
        } else {
            Write-Host "  [OK] Cero emojis detectados en manifest.json" -ForegroundColor Green
        }

        if ($rawM -match '//' -or $rawM -match '/\*') {
            $failures += "manifest.json contiene comentarios no permitidos en Chromium Manifest V3"
        } else {
            Write-Host "  [OK] Ausencia total de comentarios en manifest.json" -ForegroundColor Green
        }

        try {
            $mJson = ConvertFrom-Json -InputObject $rawM -ErrorAction Stop
            $manifestVer = [string]$mJson.version
            if (-not (Test-SemVerFormat $manifestVer)) {
                $failures += "La propiedad 'version' en manifest.json ('$manifestVer') no cumple SemVer 2.0.0"
            } else {
                Write-Host "  [OK] Clave 'version' valida bajo SemVer: $manifestVer" -ForegroundColor Green
            }

            # Validar sincronizacion con la version mas reciente de CHANGELOG.md
            if ($releases -and $releases.Count -gt 0) {
                $latestChangelogVer = $releases[0].Version
                if ($manifestVer -ne $latestChangelogVer) {
                    $failures += "Discrepancia de sincronizacion: manifest.json indica '$manifestVer' pero CHANGELOG.md registra '$latestChangelogVer'"
                } else {
                    Write-Host "  [OK] Sincronizacion perfecta entre manifest.json y CHANGELOG.md: $manifestVer" -ForegroundColor Green
                }
            }
        } catch {
            $failures += "manifest.json no es un JSON sintacticamente valido: $_"
        }
    }

    # 3. Verificacion de scripts PowerShell y ausencia de emojis
    Write-Host "`n3. Inspeccion de scripts de automatizacion..." -ForegroundColor Gray
    $ps1Files = Get-ChildItem -Path $Root -Filter *.ps1 | Where-Object { $_.FullName -notmatch '\\\.git\\' }
    foreach ($psFile in $ps1Files) {
        $relName = $psFile.Name
        $psText = [System.IO.File]::ReadAllText($psFile.FullName, [System.Text.Encoding]::UTF8)
        if (Test-HasEmoji $psText) {
            $failures += "Se detectaron emojis en el script $relName"
        } else {
            Write-Host "  [OK] Script $relName libre de emojis" -ForegroundColor Green
        }
    }

    # 4. Evaluacion final
    Write-Host "`n------------------------------------------------------------------------------" -ForegroundColor Gray
    if ($failures.Count -gt 0) {
        Write-Host "RESULTADO: Se detectaron $($failures.Count) no conformidades:" -ForegroundColor Red
        foreach ($f in $failures) {
            Write-Host "  [-] $f" -ForegroundColor Red
        }
        Write-Host ""
        exit 1
    } else {
        Write-Host "RESULTADO: Todas las comprobaciones de integridad resultaron EXITOSAS (0 defectos)." -ForegroundColor Green
        Write-Host "Estandares Keep a Changelog 1.1.0 y SemVer 2.0.0 rigurosamente satisfechos.`n" -ForegroundColor Green
        exit 0
    }
}

# ------------------------------------------------------------------------------
# 8. Despachador de Modos de Ejecucion
# ------------------------------------------------------------------------------

$effectiveRepoUrl = if ($RepoUrl) { $RepoUrl } else { Get-GitRepoUrl -Dir $repoRoot }

switch ($PSCmdlet.ParameterSetName) {
    'Verify' {
        Invoke-ChangelogVerify -Path $changelogPath -MPath $manifestPath -Root $repoRoot
    }
    'Bump' {
        $currentManifest = Get-ManifestData -Path $manifestPath
        $calculatedVersion = Get-NextSemVer -CurrentVersion $currentManifest.Version -Type $Bump
        Write-Host "Calculado incremento de version tipo '$Bump': $($currentManifest.Version) ==> $calculatedVersion" -ForegroundColor Yellow
        Invoke-ChangelogRelease -Path $changelogPath -MPath $manifestPath -Root $repoRoot -Url $effectiveRepoUrl -NewVer $calculatedVersion -IsDryRun:$DryRun
    }
    'Release' {
        Invoke-ChangelogRelease -Path $changelogPath -MPath $manifestPath -Root $repoRoot -Url $effectiveRepoUrl -NewVer $ReleaseVersion -IsDryRun:$DryRun
    }
    'GenerateHistory' {
        Invoke-ChangelogGenerateFromHistory -Path $changelogPath -Root $repoRoot -Url $effectiveRepoUrl -Ver $TargetVersion -IsDryRun:$DryRun
    }
    default {
        Invoke-ChangelogUpdate -Path $changelogPath -Root $repoRoot -Url $effectiveRepoUrl -IsDryRun:$DryRun
    }
}
