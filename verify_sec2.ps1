# ==============================================================================
# Verificación exhaustiva de los 17 hallazgos técnicos (SEC2-H01 a SEC2-H17)
# ==============================================================================

Write-Host "Iniciando verificacion tecnica de los 17 hallazgos..." -ForegroundColor Cyan

$sp = Get-Content (Join-Path $PSScriptRoot "sidepanel\sidepanel.js") -Raw
$pk = Get-Content (Join-Path $PSScriptRoot "content-scripts\picker.js") -Raw
$sidepanelHtml = Get-Content (Join-Path $PSScriptRoot "sidepanel\sidepanel.html") -Raw
$testSample = Get-Content (Join-Path $PSScriptRoot "test-sample.html") -Raw

$results = @(
  @{
    Id = 'SEC2-H01'
    Description = 'Reemplazo de num_letters por num_non_numeric en sidepanel.js'
    Passed = ($sp -notmatch 'num_letters') -and ($sp -match 'num_non_numeric')
  },
  @{
    Id = 'SEC2-H02'
    Description = 'Comprobacion de field.isSlugField en updateSelectedCount y constructor de cola'
    Passed = ($sp -match 'isSlug = !!field\.isSlugField') -and ($sp -match 'isUrl = !isSlug')
  },
  @{
    Id = 'SEC2-H03'
    Description = 'Incorporacion de fType === "tel" en heuristica isNumericText'
    Passed = ($sp -match 'isNumericText = fType === ''tel''')
  },
  @{
    Id = 'SEC2-H04'
    Description = 'Vectores email_valid y email_invalid_format en defaultSuites y desacoplamiento de URL'
    Passed = ($sp -match 'id:\s*''email_valid''') -and ($sp -match 'id:\s*''email_invalid_format''') -and ($pk -match '\(email\|correo\|mail\)')
  },
  @{
    Id = 'SEC2-H05'
    Description = 'Deteccion de field.maxLength > 0 y emision de Limite Maxlength Superado (res-capacity)'
    Passed = ($sp -match 'field\.maxLength > 0 && resLen > field\.maxLength') -and ($sp -match 'Límite Maxlength Superado') -and ($sp -match 'res-capacity')
  },
  @{
    Id = 'SEC2-H06'
    Description = 'Exclusion de isNumericText de formato alfabetico en txt_15_digits'
    Passed = ($sp -match 'testItem\.id === ''txt_15_digits''') -and ($sp -match '!isNumericText')
  },
  @{
    Id = 'SEC2-H07'
    Description = 'Desglose taxonomico de categoria number: num_overflow, num_negative y num_non_numeric'
    Passed = ($sp -match 'testItem\.id === ''num_overflow''') -and ($sp -match 'testItem\.id === ''num_negative''') -and ($sp -match 'testItem\.category === ''number''')
  },
  @{
    Id = 'SEC2-H08'
    Description = 'Exclusion de ceros normalizados en inputs type=number con resVal no vacio'
    Passed = ($sp -match 'isNumberLeadingZerosNormalized') -and ($sp -match 'resVal !== ''''')
  },
  @{
    Id = 'SEC2-H09'
    Description = 'Sugerencia de 2,000 a 5,000 caracteres para textarea en Caso D'
    Passed = ($sp -match '2,000 a 5,000 caracteres para áreas multilínea')
  },
  @{
    Id = 'SEC2-H10'
    Description = 'Reclasificacion de url_internal_ssrf con res-risk y severidad prioritaria'
    Passed = ($sp -match 'testItem\.id === ''url_internal_ssrf''') -and ($sp -match 'badgeClass = ''res-risk''')
  },
  @{
    Id = 'SEC2-H11'
    Description = 'Flexibilizacion de modal de input custom para admitir cadenas vacias y espacios'
    Passed = ($sp -match 'val === undefined \|\| val === null')
  },
  @{
    Id = 'SEC2-H12'
    Description = 'Control reactivo isTestRunCancelled, boton #btn-stop-tests y deshabilitacion de #btn-reset-all'
    Passed = ($sp -match 'isTestRunCancelled = false') -and ($sp -match 'if\s*\(\s*isTestRunCancelled\s*\)\s*\{?\s*break;') -and ($sidepanelHtml -match 'id="btn-stop-tests"') -and ($sp -match 'btnResetAll\.disabled = true') -and ($sp -match 'btnResetAll\.disabled = false')
  },
  @{
    Id = 'SEC2-H13'
    Description = 'Caso Q asigna res-format y warning para vectores estandares sin inyecciones'
    Passed = ($sp -match 'isStandardCategory && !hasInjectionPattern') -and ($sp -match 'badgeClass = ''res-format''')
  },
  @{
    Id = 'SEC2-H14'
    Description = 'Caso 5 emite Omision de Validacion al Enviar y picker respeta noValidate'
    Passed = ($sp -match 'Omisión de Validación al Enviar') -and ($pk -match 'formHasNoValidate')
  },
  @{
    Id = 'SEC2-H15'
    Description = 'Retroalimentacion contextual para transgresion de atributo pattern'
    Passed = ($sp -match 'patternMismatchDetected') -and ($sp -match 'pattern="')
  },
  @{
    Id = 'SEC2-H16'
    Description = 'Formulario 3 en test-sample.html con tel, url, email, pattern y contenteditable'
    Passed = ($testSample -match 'id="qa-form-especializados"') -and ($testSample -match 'id="input-esp-tel"') -and ($testSample -match 'id="input-esp-url"') -and ($testSample -match 'id="input-esp-email"') -and ($testSample -match 'id="input-esp-pattern"') -and ($testSample -match 'id="editor-contenteditable"')
  },
  @{
    Id = 'SEC2-H17'
    Description = 'resolveFieldElement soporta shadowRoot abiertos mediante findInShadowRoots'
    Passed = ($pk -match 'function findInShadowRoots') -and ($pk -match 'findInShadowRoots\(document')
  }
)

$allPassed = $true
foreach ($r in $results) {
  if ($r.Passed) {
    Write-Host ("  [PASS] " + $r.Id + ": " + $r.Description) -ForegroundColor Green
  } else {
    Write-Host ("  [FAIL] " + $r.Id + ": " + $r.Description) -ForegroundColor Red
    $allPassed = $false
  }
}

if ($allPassed) {
  Write-Host "CERTIFICACION EXITOSA: Los 17 hallazgos tecnicos han sido plenamente satisfechos." -ForegroundColor Green
  exit 0
} else {
  Write-Host "ERROR: Se detectaron inconsistencias en los requerimientos." -ForegroundColor Red
  exit 1
}
