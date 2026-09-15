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
    [ValidateSet('major', 'minor', 'patch', 'auto')]
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
    [switch]$CreateTag,

    [Parameter()]
    [switch]$Force,

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

# Cadenas normativas con caracteres especiales espanoles mediante codigos de escape
$script:CatAnadido       = 'A' + [char]0x00F1 + 'adido'
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

function Compare-SemVer {
    param(
        [string]$VersionA,
        [string]$VersionB
    )
    if (-not ($VersionA -match '^(\d+)\.(\d+)\.(\d+)')) {
        throw "Version A invalida para comparacion SemVer: $VersionA"
    }
    [int]$majA = [int]$matches[1]
    [int]$minA = [int]$matches[2]
    [int]$patA = [int]$matches[3]

    if (-not ($VersionB -match '^(\d+)\.(\d+)\.(\d+)')) {
        throw "Version B invalida para comparacion SemVer: $VersionB"
    }
    [int]$majB = [int]$matches[1]
    [int]$minB = [int]$matches[2]
    [int]$patB = [int]$matches[3]

    if ($majA -ne $majB) { return ($majA - $majB) }
    if ($minA -ne $minB) { return ($minA - $minB) }
    return ($patA - $patB)
}

function Get-NextSemVer {
    param(
        [string]$CurrentVersion,
        [string]$Type,
        [array]$PendingCommits = @()
    )
    if ($CurrentVersion -match '^(\d+)\.(\d+)\.(\d+)') {
        [int]$major = [int]$matches[1]
        [int]$minor = [int]$matches[2]
        [int]$patch = [int]$matches[3]

        $resolvedType = $Type.ToLower()
        if ($resolvedType -eq 'auto') {
            $hasBreaking = $false
            $hasFeat = $false
            foreach ($c in $PendingCommits) {
                if ($c.IsBreaking) { $hasBreaking = $true }
                if ($c.Type -in @('feat', 'feature')) { $hasFeat = $true }
            }
            if ($hasBreaking) {
                $resolvedType = 'major'
            } elseif ($hasFeat) {
                $resolvedType = 'minor'
            } else {
                $resolvedType = 'patch'
            }
            Write-Host "  [AUTO] Tipo de incremento detectado automaticamente: $resolvedType" -ForegroundColor Cyan
        }

        switch ($resolvedType) {
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

    # Prohibicion de comentarios en Chromium Manifest V3 (sin falsos positivos en URLs http/https)
    if ($rawText -match '(?m)^\s*//' -or $rawText -match '(?m)^\s*/\*' -or $rawText -match '(?<!https?:)//') {
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

    # Sustitucion segura de la clave version como propiedad JSON exacta
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
            if ($cleaned -match '^git@([^:]+):(.+?)(?:\.git)?$') {
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
    # Emplea delimitadores ASCII seguros: Record Separator (0x1e) y Unit Separator (0x1f)
    $formatArg = '--format=%H%x1f%as%x1f%s%x1f%b%x1e'
    $gitArgs = @('log', '--reverse', $formatArg)
    if ($From) {
        $gitArgs += "$From..$To"
    } else {
        $gitArgs += $To
    }

    $rawOutput = git -C $Dir @gitArgs 2>$null
    if (-not $rawOutput) { return @() }

    $allText = ($rawOutput -join "`n")
    $records = $allText -split [char]0x1e
    $commits = @()

    foreach ($record in $records) {
        if ([string]::IsNullOrWhiteSpace($record)) { continue }
        $fields = $record -split [char]0x1f
        if ($fields.Count -lt 3) { continue }

        $hash    = $fields[0].Trim()
        $date    = $fields[1].Trim()
        $subject = $fields[2].Trim()
        $body    = if ($fields.Count -ge 4) { $fields[3].Trim() } else { '' }

        $parsed = Convert-CommitToChangelogItem -Hash $hash -Date $date -Subject $subject -Body $body
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
        [string]$Subject,
        [string]$Body = ''
    )
    $cleanSubject = Remove-Emojis $Subject
    $cleanBody    = Remove-Emojis $Body

    # Omitir confirmaciones de fusion, ramas, meta-confirmaciones de release o del propio changelog
    if ($cleanSubject -match '^(?:merge|checkout|branch)\b' -or
        $cleanSubject -match '^(?:chore\(release\)|release(?:\([^)]*\))?|bump(?:\([^)]*\))?)\b' -or
        $cleanSubject -match '^(?:docs|chore|style|ci)\(changelog\):' -or
        $cleanSubject -match '\[skip changelog\]' -or $cleanBody -match '\[skip changelog\]') {
        return $null
    }

    $type       = ''
    $scope      = ''
    $desc       = ''
    $isBreaking = $false

    # Deteccion de cambios disruptivos en cuerpo
    if ($cleanBody -match '(?m)^BREAKING[\s-]CHANGE:\s*(.+)$') {
        $isBreaking = $true
    }

    # Patron Conventional Commits: tipo(alcance)!: descripcion
    if ($cleanSubject -match '^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<desc>.+)$') {
        $type  = $matches['type'].ToLower()
        $scope = if ($matches['scope']) { $matches['scope'].Trim().ToLower() } else { '' }
        $desc  = $matches['desc'].Trim()
        if ($matches['breaking']) {
            $isBreaking = $true
        }
    } else {
        $desc = $cleanSubject.Trim()
        if ($desc -match '^Initial commit') {
            $type = 'feat'
            $desc = 'Version inicial de la plataforma QA Form Field Validator'
        } else {
            $type = 'chore'
        }
    }

    # Normalizacion tipografica: mayuscula inicial y punto final
    if ($desc.Length -gt 0) {
        $firstChar = $desc.Substring(0, 1).ToUpper()
        $tail = if ($desc.Length -gt 1) { $desc.Substring(1) } else { '' }
        $desc = "$firstChar$tail"
        if (-not ($desc.EndsWith('.') -or $desc.EndsWith('!') -or $desc.EndsWith('?'))) {
            $desc = "$desc."
        }
    }

    # Mapeo normativo a categorias Keep a Changelog 1.1.0
    $category = 'Cambiado'
    if ($type -in @('sec', 'security') -or $cleanSubject -match '\b(?:csp|seguridad|security|vulnerab|cve)\b') {
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
        IsBreaking  = $isBreaking
        RawSubject  = $cleanSubject
    }
}

function Format-MarkdownBullet {
    param($Item)
    $breakingPrefix = if ($Item.IsBreaking) { '**[CAMBIO DISRUPTIVO]** ' } else { '' }
    if ($Item.Scope) {
        return "- **$($Item.Scope):** $breakingPrefix$($Item.Description)"
    } else {
        return "- $breakingPrefix$($Item.Description)"
    }
}

# ------------------------------------------------------------------------------
# 6. Funciones de Estructuracion y Parseo de CHANGELOG.md
# ------------------------------------------------------------------------------

function Get-ChangelogReleases {
    param([string]$Content)
    $lines = $Content -split "`r?`n"
    $releases = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '^##\s*\[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?') {
            $ver = $matches[1].Trim()
            $dt  = if ($matches[2]) { $matches[2].Trim() } else { '' }
            if ($ver -ne 'Sin publicar' -and $ver -ne 'Unreleased') {
                $releases += [PSCustomObject]@{
                    Version   = $ver
                    Date      = $dt
                    LineIndex = $i
                }
            }
        }
    }
    return ,$releases
}

function Parse-SectionCategoryMap {
    param([string[]]$SectionLines)
    $catMap = [ordered]@{}
    foreach ($c in $CategoryOrder) {
        $catMap[$c] = [System.Collections.Generic.List[string]]::new()
    }

    $currentCategory = $null
    foreach ($line in $SectionLines) {
        $trimmed = $line.Trim()
        if ($trimmed -match '^###\s+(.+)$') {
            $matchedHeader = $matches[1].Trim()
            $canonical = $CategoryOrder | Where-Object { $_ -ieq $matchedHeader }
            if ($canonical) {
                $currentCategory = $canonical
            } else {
                $currentCategory = $matchedHeader
                if (-not $catMap.Contains($currentCategory)) {
                    $catMap[$currentCategory] = [System.Collections.Generic.List[string]]::new()
                }
            }
            continue
        }

        if ($trimmed -match '^-\s+(.+)$') {
            $bulletText = $trimmed
            if ($currentCategory) {
                $catMap[$currentCategory].Add($bulletText)
            } else {
                $catMap['Cambiado'].Add($bulletText)
            }
        }
    }

    return $catMap
}

function Format-CategoryMapToBlock {
    param(
        [string]$Heading,
        $CategoryMap
    )
    $blockLines = @($Heading, "")
    $hasEntries = $false

    foreach ($cat in $CategoryOrder) {
        if ($CategoryMap.Contains($cat) -and $CategoryMap[$cat].Count -gt 0) {
            $hasEntries = $true
            $blockLines += "### $cat"
            foreach ($bullet in $CategoryMap[$cat]) {
                $blockLines += $bullet
            }
            $blockLines += ""
        }
    }

    foreach ($key in $CategoryMap.Keys) {
        if ($key -notin $CategoryOrder -and $CategoryMap[$key].Count -gt 0) {
            $hasEntries = $true
            $blockLines += "### $key"
            foreach ($bullet in $CategoryMap[$key]) {
                $blockLines += $bullet
            }
            $blockLines += ""
        }
    }

    if (-not $hasEntries) {
        return @($Heading, "")
    }

    return $blockLines
}

function Get-ReleasedDescriptions {
    param([string]$Content)
    $lines = $Content -split "`r?`n"
    $firstRelIndex = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s*\[(?!Sin publicar|Unreleased)[^\]]+\]') {
            $firstRelIndex = $i
            break
        }
    }

    if ($firstRelIndex -lt 0) { return @() }

    $releasedLines = $lines[$firstRelIndex..($lines.Count - 1)]
    $descriptions = @()
    foreach ($line in $releasedLines) {
        if ($line -match '^\s*-\s+(?:\*\*[^*]+\*\*:\s*)?(.+)$') {
            $descText = $matches[1].Trim().TrimEnd('.').ToLower()
            $descriptions += $descText
        }
    }
    return ,$descriptions
}

function Test-ItemMatchesCommit {
    param(
        [string]$BulletText,
        $Commit
    )
    if ([string]::IsNullOrWhiteSpace($BulletText)) { return $false }
    $normBullet = $BulletText.ToLower()
    $normDesc   = $Commit.Description.TrimEnd('.').ToLower()

    if ($normBullet.Contains($normDesc)) {
        return $true
    }
    if ($Commit.Scope -and $normBullet.Contains("**$($Commit.Scope.ToLower()):**")) {
        $sample = if ($normDesc.Length -gt 15) { $normDesc.Substring(0, 15) } else { $normDesc }
        if ($normBullet.Contains($sample)) {
            return $true
        }
    }
    return $false
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

    $content  = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $releases = Get-ChangelogReleases -Content $content
    $lines    = $content -split "`r?`n"

    $unreleasedIndex   = -1
    $firstReleaseIndex = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s*\[Sin publicar\]') {
            $unreleasedIndex = $i
        } elseif ($unreleasedIndex -ge 0 -and $lines[$i] -match '^##\s*\[(?!Sin publicar|Unreleased)[^\]]+\]' -and $firstReleaseIndex -lt 0) {
            $firstReleaseIndex = $i
        }
    }

    if ($unreleasedIndex -lt 0) {
        throw "No se localizo la seccion '## [Sin publicar]' en $Path"
    }

    # 1. Parsear elementos existentes en [Sin publicar]
    $unreleasedEndIndex = if ($firstReleaseIndex -gt 0) { $firstReleaseIndex - 1 } else { $lines.Count - 1 }
    $existingUnreleasedLines = if ($unreleasedEndIndex -ge ($unreleasedIndex + 1)) {
        $lines[($unreleasedIndex + 1)..$unreleasedEndIndex]
    } else {
        @()
    }
    $unreleasedCatMap = Parse-SectionCategoryMap -SectionLines $existingUnreleasedLines

    # 2. Obtener confirmaciones candidatas de Git
    $latestTag = if ($releases.Count -gt 0) { "v$($releases[0].Version)" } else { '' }
    $tagExists = $false
    if ($latestTag) {
        $checkTag = git -C $Root tag -l $latestTag 2>$null
        if ($checkTag -and $checkTag.Trim() -eq $latestTag) {
            $tagExists = $true
        }
    }

    $gitCommits = @()
    if ($tagExists) {
        $gitCommits = Get-GitCommitList -Dir $Root -From $latestTag -To 'HEAD'
    } else {
        $releasedDescs = Get-ReleasedDescriptions -Content $content
        $allCandidates = Get-GitCommitList -Dir $Root -From '' -To 'HEAD'
        foreach ($cand in $allCandidates) {
            $candDesc = $cand.Description.TrimEnd('.').ToLower()
            $isAlreadyReleased = $false
            foreach ($rd in $releasedDescs) {
                if ($rd -eq $candDesc -or ($cand.Scope -and $rd.Contains($candDesc))) {
                    $isAlreadyReleased = $true
                    break
                }
            }
            if (-not $isAlreadyReleased) {
                $gitCommits += $cand
            }
        }
    }

    # 3. Incorporar confirmaciones no registradas en el mapa preservando lo existente
    $newCommitsCount = 0
    foreach ($commit in $gitCommits) {
        $alreadyPresent = $false
        foreach ($catKey in $unreleasedCatMap.Keys) {
            foreach ($bullet in $unreleasedCatMap[$catKey]) {
                if (Test-ItemMatchesCommit -BulletText $bullet -Commit $commit) {
                    $alreadyPresent = $true
                    break
                }
            }
            if ($alreadyPresent) { break }
        }

        if (-not $alreadyPresent) {
            $targetCat = $commit.Category
            $bulletText = Format-MarkdownBullet -Item $commit
            if (-not $unreleasedCatMap.Contains($targetCat)) {
                $unreleasedCatMap[$targetCat] = [System.Collections.Generic.List[string]]::new()
            }
            $unreleasedCatMap[$targetCat].Add($bulletText)
            $newCommitsCount++
        }
    }

    if ($newCommitsCount -eq 0) {
        Write-Host "  [INFO] No se detectaron confirmaciones pendientes por registrar." -ForegroundColor Green
        Write-Host "  La seccion [Sin publicar] se encuentra al dia con el historial de Git.`n" -ForegroundColor Green
        return
    }

    Write-Host "  Se integraron $newCommitsCount confirmaciones nuevas a [Sin publicar] preservando entradas previas." -ForegroundColor Yellow

    # 4. Reconstruir CHANGELOG.md
    $unreleasedBlock = Format-CategoryMapToBlock -Heading "## [Sin publicar]" -CategoryMap $unreleasedCatMap
    $tailLines = if ($firstReleaseIndex -gt 0) { $lines[$firstReleaseIndex..($lines.Count - 1)] } else { @() }

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
        [switch]$ShouldCreateTag,
        [switch]$IsForce,
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

    $manifest = Get-ManifestData -Path $MPath
    $currentVer = $manifest.Version

    # Validacion estricta SemVer: la nueva version debe ser estrictamente superior a la actual
    $compResult = Compare-SemVer -VersionA $NewVer -VersionB $currentVer
    if ($compResult -le 0) {
        throw "La version de lanzamiento '$NewVer' debe ser estrictamente mayor que la version actual '$currentVer' segun SemVer 2.0.0"
    }

    $content  = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $releases = Get-ChangelogReleases -Content $content

    foreach ($rel in $releases) {
        if ($rel.Version -eq $NewVer) {
            throw "La version '$NewVer' ya se encuentra formalmente registrada en CHANGELOG.md"
        }
    }

    $lines = $content -split "`r?`n"
    $unreleasedIndex   = -1
    $firstReleaseIndex = -1
    $linksStartIndex   = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s*\[Sin publicar\]') {
            $unreleasedIndex = $i
        } elseif ($unreleasedIndex -ge 0 -and $lines[$i] -match '^##\s*\[(?!Sin publicar|Unreleased)[^\]]+\]' -and $firstReleaseIndex -lt 0) {
            $firstReleaseIndex = $i
        }
        if ($lines[$i] -match '^\[[^\]]+\]:\s*http') {
            if ($linksStartIndex -lt 0) { $linksStartIndex = $i }
        }
    }

    if ($unreleasedIndex -lt 0) {
        throw "No se localizo la seccion '## [Sin publicar]' en $Path"
    }

    # 1. Extraer elementos de [Sin publicar]
    $unreleasedEndIndex = if ($firstReleaseIndex -gt 0) { $firstReleaseIndex - 1 } else { $lines.Count - 1 }
    $existingUnreleasedLines = if ($unreleasedEndIndex -ge ($unreleasedIndex + 1)) {
        $lines[($unreleasedIndex + 1)..$unreleasedEndIndex]
    } else {
        @()
    }
    $releaseCatMap = Parse-SectionCategoryMap -SectionLines $existingUnreleasedLines

    # 2. Integrar tambien cualquier commit pendiente en Git antes de cerrar la release
    $latestTag = if ($releases.Count -gt 0) { "v$($releases[0].Version)" } else { '' }
    $tagExists = $false
    if ($latestTag) {
        $checkTag = git -C $Root tag -l $latestTag 2>$null
        if ($checkTag -and $checkTag.Trim() -eq $latestTag) {
            $tagExists = $true
        }
    }

    $pendingGitCommits = @()
    if ($tagExists) {
        $pendingGitCommits = Get-GitCommitList -Dir $Root -From $latestTag -To 'HEAD'
    } else {
        $releasedDescs = Get-ReleasedDescriptions -Content $content
        $allCandidates = Get-GitCommitList -Dir $Root -From '' -To 'HEAD'
        foreach ($cand in $allCandidates) {
            $candDesc = $cand.Description.TrimEnd('.').ToLower()
            $isAlreadyReleased = $false
            foreach ($rd in $releasedDescs) {
                if ($rd -eq $candDesc -or ($cand.Scope -and $rd.Contains($candDesc))) {
                    $isAlreadyReleased = $true
                    break
                }
            }
            if (-not $isAlreadyReleased) {
                $pendingGitCommits += $cand
            }
        }
    }

    foreach ($commit in $pendingGitCommits) {
        $alreadyPresent = $false
        foreach ($catKey in $releaseCatMap.Keys) {
            foreach ($bullet in $releaseCatMap[$catKey]) {
                if (Test-ItemMatchesCommit -BulletText $bullet -Commit $commit) {
                    $alreadyPresent = $true
                    break
                }
            }
            if ($alreadyPresent) { break }
        }

        if (-not $alreadyPresent) {
            $targetCat = $commit.Category
            $bulletText = Format-MarkdownBullet -Item $commit
            if (-not $releaseCatMap.Contains($targetCat)) {
                $releaseCatMap[$targetCat] = [System.Collections.Generic.List[string]]::new()
            }
            $releaseCatMap[$targetCat].Add($bulletText)
        }
    }

    # Verificar que existan cambios para formalizar
    $totalReleaseItems = 0
    foreach ($catKey in $releaseCatMap.Keys) {
        $totalReleaseItems += $releaseCatMap[$catKey].Count
    }

    if ($totalReleaseItems -eq 0 -and -not $IsForce) {
        throw "No hay cambios pendientes en [Sin publicar] ni en Git para formalizar en la version $NewVer. Especifique -Force si desea emitir una version sin modificaciones."
    }

    # Paso 1: Sincronizar manifest.json
    Write-Host "Paso 1: Sincronizacion de manifest.json a version $NewVer..." -ForegroundColor Gray
    $null = Update-ManifestVersionSafe -Path $MPath -NewVersion $NewVer -IsDryRun:$IsDryRun

    # Paso 2: Construir bloque de nueva version
    Write-Host "Paso 2: Formalizacion de cambios bajo version [$NewVer]..." -ForegroundColor Gray
    $today = (Get-Date).ToString('yyyy-MM-dd')
    $newVersionBlock = Format-CategoryMapToBlock -Heading "## [$NewVer] - $today" -CategoryMap $releaseCatMap

    # Paso 3: Reconstruir enlaces y ensamblar
    $updatedReleases = @([PSCustomObject]@{ Version = $NewVer; Date = $today }) + $releases
    $newLinks = Build-ComparisonLinks -BaseUrl $Url -Releases $updatedReleases

    $headerLines = $lines[0..($unreleasedIndex - 1)]

    $bodyFromFirstRelease = @()
    $contentLimit = if ($linksStartIndex -gt 0) { $linksStartIndex - 1 } else { $lines.Count - 1 }
    if ($firstReleaseIndex -gt 0 -and $firstReleaseIndex -le $contentLimit) {
        $bodyFromFirstRelease = $lines[$firstReleaseIndex..$contentLimit]
    }

    $assembledLines = @()
    $assembledLines += $headerLines
    $assembledLines += "## [Sin publicar]"
    $assembledLines += ""
    $assembledLines += $newVersionBlock
    $assembledLines += $bodyFromFirstRelease
    $assembledLines += ""
    $assembledLines += $newLinks

    $finalText = ($assembledLines -join "`r`n").TrimEnd() + "`r`n"
    Assert-NoEmojisInContent -Content $finalText -ContextName "CHANGELOG.md tras release"

    if (-not $IsDryRun) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($Path, $finalText, $utf8NoBom)
        Write-Host "  [EXITO] Version $NewVer registrada y CHANGELOG.md estructurado correctamente." -ForegroundColor Green

        if ($ShouldCreateTag) {
            try {
                $tagName = "v$NewVer"
                git -C $Root tag -a $tagName -m "Release $tagName" 2>$null
                Write-Host "  [OK] Etiqueta Git $tagName creada localmente con exito." -ForegroundColor Green
            } catch {
                Write-Host "  [AVISO] No se pudo crear la etiqueta Git automaticamente: $_" -ForegroundColor Yellow
            }
        }
        Write-Host "`nPara completar el ciclo de distribucion ejecute:" -ForegroundColor Cyan
        Write-Host "  git add manifest.json CHANGELOG.md" -ForegroundColor Gray
        Write-Host "  git commit -m `"chore(release): formalizar version $NewVer`"" -ForegroundColor Gray
        Write-Host "  git tag -a v$NewVer -m `"Release v$NewVer`"" -ForegroundColor Gray
        Write-Host "  git push origin main --tags`n" -ForegroundColor Gray
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

    $catMap = [ordered]@{}
    foreach ($c in $CategoryOrder) {
        $catMap[$c] = [System.Collections.Generic.List[string]]::new()
    }

    foreach ($commit in $commits) {
        $cat = $commit.Category
        if (-not $catMap.Contains($cat)) {
            $catMap[$cat] = [System.Collections.Generic.List[string]]::new()
        }
        $bullet = Format-MarkdownBullet -Item $commit
        $catMap[$cat].Add($bullet)
    }

    $versionBlock = Format-CategoryMapToBlock -Heading "## [$Ver] - $today" -CategoryMap $catMap
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
            $seenVersions = [System.Collections.Generic.HashSet[string]]::new()
            $previousVersion = $null

            foreach ($rel in $releases) {
                if (-not (Test-SemVerFormat $rel.Version)) {
                    $failures += "La version '[$($rel.Version)]' no cumple con la especificacion SemVer 2.0.0"
                }
                if ($rel.Date -and -not ($rel.Date -match '^\d{4}-\d{2}-\d{2}$')) {
                    $failures += "La fecha '$($rel.Date)' para la version $($rel.Version) no cumple formato ISO YYYY-MM-DD"
                }
                if ($seenVersions.Contains($rel.Version)) {
                    $failures += "Version duplicada detectada en CHANGELOG.md: [$($rel.Version)]"
                } else {
                    $seenVersions.Add($rel.Version) | Out-Null
                }

                # Validar orden cronologico inverso (descendente)
                if ($previousVersion) {
                    $diff = Compare-SemVer -VersionA $previousVersion -VersionB $rel.Version
                    if ($diff -le 0) {
                        $failures += "Orden cronologico incorrecto: version [$previousVersion] no es mayor que [$($rel.Version)]"
                    }
                }
                $previousVersion = $rel.Version
            }
            Write-Host "  [OK] $($releases.Count) versiones formalizadas bajo estandar SemVer 2.0.0 en orden cronologico" -ForegroundColor Green
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
            Write-Host "  [OK] Enlace de comparacion para [Sin publicar] validado" -ForegroundColor Green
        }

        foreach ($rel in $releases) {
            $escapedVer = [regex]::Escape($rel.Version)
            if (-not ($content -match "\[$escapedVer\]:\s*https?://")) {
                $failures += "CHANGELOG.md no define el enlace de referencia al pie para la version [$($rel.Version)]"
            }
        }
        Write-Host "  [OK] Todos los enlaces de referencia de versiones verificados al pie" -ForegroundColor Green
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

        if ($rawM -match '(?m)^\s*//' -or $rawM -match '(?m)^\s*/\*' -or $rawM -match '(?<!https?:)//') {
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
        $pendingCommitsForBump = @()
        if ($Bump -eq 'auto') {
            $contentForBump = if (Test-Path $changelogPath) { [System.IO.File]::ReadAllText($changelogPath, [System.Text.Encoding]::UTF8) } else { '' }
            $pendingCommitsForBump = Get-GitCommitList -Dir $repoRoot -From '' -To 'HEAD'
        }
        $calculatedVersion = Get-NextSemVer -CurrentVersion $currentManifest.Version -Type $Bump -PendingCommits $pendingCommitsForBump
        Write-Host "Calculado incremento de version tipo '$Bump': $($currentManifest.Version) ==> $calculatedVersion" -ForegroundColor Yellow
        Invoke-ChangelogRelease -Path $changelogPath -MPath $manifestPath -Root $repoRoot -Url $effectiveRepoUrl -NewVer $calculatedVersion -ShouldCreateTag:$CreateTag -IsForce:$Force -IsDryRun:$DryRun
    }
    'Release' {
        Invoke-ChangelogRelease -Path $changelogPath -MPath $manifestPath -Root $repoRoot -Url $effectiveRepoUrl -NewVer $ReleaseVersion -ShouldCreateTag:$CreateTag -IsForce:$Force -IsDryRun:$DryRun
    }
    'GenerateHistory' {
        Invoke-ChangelogGenerateFromHistory -Path $changelogPath -Root $repoRoot -Url $effectiveRepoUrl -Ver $TargetVersion -IsDryRun:$DryRun
    }
    default {
        Invoke-ChangelogUpdate -Path $changelogPath -Root $repoRoot -Url $effectiveRepoUrl -IsDryRun:$DryRun
    }
}
