# Guía de Contribución al Proyecto QA Form Field Validator

**Estándares de Ingeniería, Protocolos de Desarrollo y Lineamientos de Colaboración Corporativa**  
*Plataforma de Auditoría de Validación de Entradas Web y Pruebas Dinámicas de Resiliencia (Chromium Manifest V3)*

---

## Tabla de Contenidos

1. [Introducción y Filosofía del Proyecto](#1-introducción-y-filosofía-del-proyecto)
2. [Código de Conducta y Principios Éticos](#2-código-de-conducta-y-principios-éticos)
3. [Política de Estilo y Comunicación Técnica](#3-política-de-estilo-y-comunicación-técnica)
4. [Flujo de Trabajo Git y Ciclo de Vida de Ramas](#4-flujo-de-trabajo-git-y-ciclo-de-vida-de-ramas)
   - [Bifurcación y Configuración del Repositorio](#bifurcación-y-configuración-del-repositorio)
   - [Nomenclatura Estricta de Ramas](#nomenclatura-estricta-de-ramas)
   - [Estándar de Mensajes de Confirmación (Conventional Commits)](#estándar-de-mensajes-de-confirmación-conventional-commits)
   - [Automatización de Registro de Cambios y Versionado (update_changelog.ps1)](#automatización-de-registro-de-cambios-y-versionado-update_changelogps1)
   - [Preparación y Envío de Solicitudes de Extracción (Pull Requests)](#preparación-y-envío-de-solicitudes-de-extracción-pull-requests)
5. [Estándares Arquitectónicos y Directivas de Código](#5-estándares-arquitectónicos-y-directivas-de-código)
   - [Arquitectura Nativa Chromium Manifest V3](#arquitectura-nativa-chromium-manifest-v3)
   - [Desacoplamiento Estricto de Componentes](#desacoplamiento-estricto-de-componentes)
   - [Cero Dependencias Externas en Tiempo de Ejecución (Air-Gapped Readiness)](#cero-dependencias-externas-en-tiempo-de-ejecución-air-gapped-readiness)
   - [Documentación Didáctica Obligatoria del Código Fuente](#documentación-didáctica-obligatoria-del-código-fuente)
6. [Reglas Críticas de Sintaxis y Balance de Delimitadores](#6-reglas-críticas-de-sintaxis-y-balance-de-delimitadores)
   - [Balance Absoluto de Llaves, Paréntesis y Corchetes en JavaScript](#balance-absoluto-de-llaves-paréntesis-y-corchetes-en-javascript)
   - [Control de Paréntesis en Bloques de Comentarios](#control-de-paréntesis-en-bloques-de-comentarios)
   - [Verificación Obligatoria Mediante Script Automatizado (check_js.ps1)](#verificación-obligatoria-mediante-script-automatizado-check_jsps1)
   - [Prohibición Taxativa de Comentarios en manifest.json](#prohibición-taxativa-de-comentarios-en-manifestjson)
7. [Protocolo de Pruebas y Aseguramiento de Calidad](#7-protocolo-de-pruebas-y-aseguramiento-de-calidad)
   - [Validación en el Laboratorio Local (test-sample.html)](#validación-en-el-laboratorio-local-test-samplehtml)
   - [Verificación en Aplicaciones Web Reales y Frameworks Reactivos](#verificación-en-aplicaciones-web-reales-y-frameworks-reactivos)
   - [Supervisión de Interceptores y Diagnósticos de Consola](#supervisión-de-interceptores-y-diagnósticos-de-consola)
   - [Inspección de Salida Gráfica y Fidelidad de Impresión en Dashboard](#inspección-de-salida-gráfica-y-fidelidad-de-impresión-en-dashboard)
8. [Política de Divulgación Responsable de Seguridad (Responsible Disclosure)](#8-política-de-divulgación-responsable-de-seguridad-responsible-disclosure)
   - [Alcance y Enfoque Defensivo](#alcance-y-enfoque-defensivo)
   - [Canal de Comunicación Confidencial](#canal-de-comunicación-confidencial)
   - [Estructura del Informe de Seguridad](#estructura-del-informe-de-seguridad)
   - [Ventana de Remediación Coordinada y Reconocimiento](#ventana-de-remediación-coordinada-y-reconocimiento)
9. [Criterios de Aceptación y Definición de Terminado (Definition of Done)](#9-criterios-de-aceptación-y-definición-de-terminado-definition-of-done)
10. [Marco Legal, Cesión de Derechos y Licenciamiento](#10-marco-legal-cesión-de-derechos-y-licenciamiento)

---

## 1. Introducción y Filosofía del Proyecto

El proyecto **QA Form Field Validator** es una plataforma de software de nivel corporativo orientada a profesionales de Aseguramiento de Calidad (Quality Assurance - QA), ingenieros de Seguridad de Aplicaciones (AppSec), auditores de pruebas dinámicas (DAST) y desarrolladores front-end. Su propósito es diagnosticar de forma sistemática y reproducible la solidez, defensas y resiliencia de elementos de entrada y transacciones de envío en aplicaciones web.

La excelencia técnica, la seguridad operativa, la neutralidad del entorno de ejecución y la estabilidad sintáctica constituyen los pilares irrenunciables de este repositorio. Cada contribución incorporada debe satisfacer rigurosos criterios de calidad de código, legibilidad y blindaje arquitectónico.

Agradecemos sinceramente su interés en aportar al crecimiento y robustez de esta plataforma. Para garantizar una integración fluida y mantener los más altos estándares de ingeniería, toda colaboración debe seguir puntualmente las directrices expuestas en este documento.

---

## 2. Código de Conducta y Principios Éticos

Todos los contribuidores, colaboradores y mantenedores del proyecto se comprometen a interactuar bajo un estándar estricto de respeto profesional, rigor técnico, cortesía y colaboración constructiva.

### Principios Fundamentales
- **Rigor Profesional:** Todo comentario, revisión de código o propuesta debe fundamentarse en criterios técnicos objetivos, medibles y verificables.
- **Tolerancia Cero al Acoso:** Queda terminantemente prohibida cualquier conducta discriminatoria, denigrante, descalificatoria o de hostigamiento motivada por motivos de género, raza, nacionalidad, orientación sexual, religión, nivel socioeconómico o grado de experiencia técnica.
- **Uso Exclusivamente Ético y Autorizado:** Conforme a lo establecido en la Sección 11 de [README.md](README.md), las capacidades desarrolladas en este proyecto tienen una finalidad orientada exclusivamente a la auditoría autorizada, el análisis didáctico y el fortalecimiento defensivo de software. Queda prohibida la incorporación deliberada de vectores destructivos no controlados, puertas traseras (*backdoors*), rutinas de espionaje o componentes diseñados para vulnerar infraestructuras sin consentimiento expreso.

---

## 3. Política de Estilo y Comunicación Técnica

Para preservar la homogeneidad y sobriedad corporativa de la base de código y su documentación, se establecen las siguientes directivas obligatorias de comunicación:

1. **Idioma Oficial:** Toda la documentación, comentarios en código fuente, descripciones de Pull Requests, especificaciones técnicas y mensajes de confirmación (commits) deben redactarse en idioma español formal y técnico, empleando ortografía y sintaxis correctas (se admite terminología estándar de la industria en idioma inglés cuando no exista un equivalente técnico exacto o comúnmente aceptado).
2. **Prohibición Absoluta de Emojis:** Conforme a las normas de estilo del proyecto, queda estrictamente prohibido el uso de emojis, pictogramas o caracteres de adorno emocional en archivos Markdown (`.md`), comentarios de código fuente (`.js`, `.html`, `.css`), nombres de ramas o mensajes de confirmación Git. La presentación debe mantener un tono sobrio, estructurado y corporativo en todo momento.
3. **Claridad y Concisión:** Evite la ambigüedad y la retórica innecesaria. Toda descripción debe responder de forma directa a: qué problema se atiende, cuál es la solución técnica implementada y cómo se verificó su eficacia.

---

## 4. Flujo de Trabajo Git y Ciclo de Vida de Ramas

El repositorio utiliza un modelo de colaboración basado en bifurcaciones (*forking workflow*) con integración hacia la rama principal (`main`) mediante revisiones obligatorias de código.

### Bifurcación y Configuración del Repositorio

1. Realice una bifurcación (*Fork*) del repositorio oficial en GitHub:
   ```
   https://github.com/ElHawky09/qa-validador-de-campos.git
   ```
2. Clone localmente su bifurcación en su estación de trabajo:
   ```bash
   git clone https://github.com/<SU-USUARIO>/qa-validador-de-campos.git
   cd qa-validador-de-campos
   ```
3. Configure el repositorio upstream oficial para mantener sincronizada su copia local:
   ```bash
   git remote add upstream https://github.com/ElHawky09/qa-validador-de-campos.git
   git fetch upstream
   ```
4. Asegúrese de que su rama `main` local esté siempre actualizada respecto a `upstream/main` antes de ramificar:
   ```bash
   git checkout main
   git pull --rebase upstream main
   ```

### Nomenclatura Estricta de Ramas

Toda modificación debe realizarse en una rama dedicada creada a partir de la versión más reciente de `main`. Queda prohibido trabajar o enviar cambios directamente desde la rama `main` de su bifurcación.

El nombre de la rama debe emplear caracteres alfanuméricos en minúsculas separados por guiones medios (`-`), ajustándose a los siguientes prefijos normativos:

| Prefijo | Propósito Técnico | Ejemplo |
| :--- | :--- | :--- |
| `feature/` | Nuevas capacidades funcionales, módulos o vectores de auditoría. | `feature/deteccion-campos-shadow-dom` |
| `fix/` | Corrección de defectos, bugs de inyección o fallos de renderizado. | `fix/intercepcion-alertas-sincronicas` |
| `docs/` | Incorporación, corrección o ampliación de documentación técnica. | `docs/actualizacion-manual-operativo` |
| `refactor/` | Reestructuración interna de código sin alteración funcional visible. | `refactor/modularizacion-motor-svg-donut` |
| `test/` | Nuevos escenarios en el laboratorio de pruebas o suites sintéticas. | `test/escenario-modales-anidados` |
| `perf/` | Mejoras verificadas de rendimiento, velocidad o consumo de memoria. | `perf/optimizacion-rastreo-inputs-dom` |

Comando para la creación de rama:
```bash
git checkout -b feature/nombre-de-la-capacidad
```

### Estándar de Mensajes de Confirmación (Conventional Commits)

El historial de versiones debe permanecer impecable, legible y descriptivo. Los mensajes de confirmación (*commits*) deben cumplir estrictamente la convención de **Conventional Commits**:

```
<tipo>(<alcance-opcional>): <descripción-en-minúsculas-imperativo>

[Cuerpo explicativo opcional detallando el problema y la solución implementada]

[Referencias a issues o incidencias relacionadas, ej. Cierra #12]
```

#### Tipos Permitidos
- `feat`: Nueva funcionalidad para el usuario u operador.
- `fix`: Corrección de un fallo o defecto de funcionamiento.
- `docs`: Modificaciones exclusivas en documentación (Markdown, comentarios didácticos).
- `style`: Ajustes puramente visuales de formato, espaciado o alineación sin impacto lógico.
- `refactor`: Cambios de código que no corrigen bugs ni agregan nuevas funciones.
- `perf`: Modificaciones orientadas a optimizar el rendimiento y la eficiencia de ejecución.
- `test`: Incorporación o corrección de casos de prueba o laboratorios de validación.
- `chore`: Tareas de mantenimiento auxiliar, archivos de configuración o limpieza de repositorio.

#### Reglas para el Encabezado del Commit
- Utilice el modo imperativo en tiempo presente (ejemplo: `incorporar`, `corregir`, `actualizar`; no `incorporado` ni `corrige`).
- Inicie la descripción en minúsculas (a menos que comience con un nombre propio o acrónimo técnico formal).
- No coloque punto final al término del encabezado.
- Limite la primera línea a un máximo de 72 caracteres.
- Redacte preferentemente en español formal o inglés técnico estándar, manteniendo absoluta coherencia temática.

#### Ejemplos Válidos
```bash
feat(sidepanel): incorporar persistencia de selectores en almacenamiento local
fix(picker): resolver fuga de escuchadores de eventos al cancelar con tecla Escape
docs(contributing): documentar protocolo de balance de delimitadores y script check_js
refactor(dashboard): desacoplar renderizador trigonométrico de gráfico Donut
```

### Automatización de Registro de Cambios y Versionado (update_changelog.ps1)

El proyecto cuenta con un script nativo en PowerShell ([`update_changelog.ps1`](update_changelog.ps1)) para la gestión automatizada del historial de cambios y la sincronización de versiones, operando con total independencia de Node.js, npm o herramientas de empaquetado externas.

El archivo [`CHANGELOG.md`](CHANGELOG.md) se apega rigurosamente al estándar internacional **Keep a Changelog (v1.1.0)** y al modelo de **Semantic Versioning (SemVer 2.0.0)**.

#### Directivas Normativas del Registro de Cambios
- **Cero Emojis:** El archivo `CHANGELOG.md`, los scripts y las notas de versión tienen prohibición absoluta de emojis o pictogramas informales, manteniendo un tono técnico, formal y corporativo.
- **Categorías Estándar:** Las confirmaciones Git redactadas bajo Conventional Commits se clasifican automáticamente en las siguientes secciones formales en español:
  - `Añadido`: Nuevas características, capacidades o vectores de prueba (`feat`).
  - `Cambiado`: Modificaciones en comportamiento existente, optimizaciones o estilos (`refactor`, `style`, `perf`, `chore`, `test`).
  - `Corregido`: Correcciones de defectos, excepciones o desajustes de inyección (`fix`).
  - `Seguridad`: Mitigaciones de vulnerabilidades, cumplimiento CSP o blindaje de extensiones (`sec`, `security`, o alusiones a CSP).
  - `Documentación`: Adición o perfeccionamiento de manuales, guías y comentarios didácticos (`docs`).
- **Sincronización Estricta con manifest.json:** Toda versión liberada actualiza de forma atómica y segura la propiedad `"version"` en `manifest.json` preservando la sintaxis JSON estricta y la prohibición de comentarios.

#### Comandos de Operación en PowerShell

Abra una consola de PowerShell en la raíz del repositorio y utilice los siguientes comandos según corresponda:

```powershell
# 1. Actualizar la seccion [Sin publicar] a partir de los commits pendientes en Git (preservando entradas previas):
powershell -ExecutionPolicy Bypass -File .\update_changelog.ps1

# 2. Registrar y formalizar una nueva version especificando la version SemVer (opcionalmente creando etiqueta Git):
powershell -ExecutionPolicy Bypass -File .\update_changelog.ps1 -ReleaseVersion "1.1.0" -CreateTag

# 3. Incrementar version por tipo semantico (patch, minor, major) o deteccion automatica segun commits:
powershell -ExecutionPolicy Bypass -File .\update_changelog.ps1 -Bump minor
powershell -ExecutionPolicy Bypass -File .\update_changelog.ps1 -Bump auto -CreateTag

# 4. Simular cambios sin escribir en disco (Dry-Run):
powershell -ExecutionPolicy Bypass -File .\update_changelog.ps1 -Bump patch -DryRun

# 5. Auditar la conformidad de CHANGELOG.md, SemVer, manifest.json y ausencia de emojis:
powershell -ExecutionPolicy Bypass -File .\update_changelog.ps1 -Verify
```

### Preparación y Envío de Solicitudes de Extracción (Pull Requests)

Antes de emitir una solicitud de extracción (*Pull Request* o *PR*):

1. **Rebase Local Obligatorio:** Sincronice su rama de trabajo contra la versión más reciente de `upstream/main` para garantizar una integración lineal sin conflictos:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. **Revisión de Atomicidad:** Asegúrese de que cada commit represente una unidad lógica autocontenida de trabajo. Si generó confirmaciones intermedias de prueba o correcciones menores, unifíquelas mediante un rebase interactivo (`git rebase -i HEAD~N`).
3. **Formulario de Pull Request:** Proporcione un título claro alineado a Conventional Commits y complete la descripción estructurada respondiendo puntualmente:
   - **Resumen:** Descripción concisa de los cambios incluidos.
   - **Justificación Técnica:** Contexto operativo o problema resuelto.
   - **Estrategia de Prueba:** Detalle exacto de las validaciones ejecutadas (tanto en `test-sample.html` como en entornos reales).
   - **Lista de Verificación (Checklist):** Confirmación expresa del balance de delimitadores mediante `check_js.ps1`, ausencia de dependencias externas y conservación del estilo sin emojis.

---

## 5. Estándares Arquitectónicos y Directivas de Código

### Arquitectura Nativa Chromium Manifest V3

El proyecto se rige por las directivas de seguridad y aislamiento de **Chromium Manifest V3**. Todo código aportado debe respetar el modelo asincrónico del navegador, minimizando privilegios requeridos en `manifest.json` y operando dentro de los límites contextuales de la sandbox.

```
+-------------------------------------------------------------------------------+
|                       ARQUITECTURA CHROMIUM MANIFEST V3                       |
+-------------------------------------------------------------------------------+
|   SERVICE WORKER (service-worker.js)                                          |
|   - Ciclo de vida en segundo plano                                            |
|   - Gestión de menús contextuales nativos                                     |
|   - Orquestación de apertura programática de Side Panel                       |
+---------------------------------------+---------------------------------------+
                                        | (Chrome IPC / Messages)
                                        v
+---------------------------------------+---------------------------------------+
|   SIDE PANEL (sidepanel/)             |   CONTENT SCRIPTS (content-scripts/)  |
|   - Interfaz gráfica lateral          |   - Inyección aislada en página host  |
|   - Parametrización de auditoría      |   - Picker visual y contornos DOM     |
|   - Ejecución de matriz de vectores   |   - Simulación de eventos sintéticos  |
|   - Módulo de exportación analítica   |   - Intercepción de window.alert      |
+---------------------------------------+---------------------------------------+
                                        |
                                        v (Pestaña dedicada / localStorage)
+-------------------------------------------------------------------------------+
|   CONSOLA EJECUTIVA (dashboard/)                                              |
|   - Análisis visual a pantalla completa (Donut SVG trigonométrico)            |
|   - Búsqueda reactiva, filtros multidimensionales y directivas @media print   |
+-------------------------------------------------------------------------------+
```

### Desacoplamiento Estricto de Componentes

1. **Service Worker (`service-worker.js`):** Debe mantenerse liviano y reactivo. No debe almacenar estado en variables globales permanentes (dado que el Service Worker puede ser suspendido por el navegador en periodos de inactividad). Queda prohibido el acceso o intento de manipulación directa del DOM desde este contexto.
2. **Panel Lateral (`sidepanel/`):** Aloja la lógica de control, selección de vectores y cálculo de puntuación (*Score*). Toda interacción con la página examinada debe canalizarse exclusivamente a través de la API `chrome.tabs.sendMessage` hacia los Content Scripts correspondientes.
3. **Scripts de Contenido (`content-scripts/`):** Operan en un contexto aislado (*isolated world*). Tienen acceso exclusivo al árbol DOM de la página inspeccionada. No deben compartir referencias a objetos mutables globales con los scripts propios de la página, a excepción de las técnicas deliberadas de neutralización reactiva (tales como el reseteo de `_valueTracker` o la intercepción inocua de diálogos bloqueantes).
4. **Consola Ejecutiva (`dashboard/`):** Consume los resultados consolidados de auditoría persistidos en `chrome.storage.local` o transferidos mediante eventos estructurados, ejecutando el renderizado analítico en una pestaña independiente dedicada.

### Cero Dependencias Externas en Tiempo de Ejecución (Air-Gapped Readiness)

- **Ejecución 100% Local y Desconectada:** La extensión debe operar con total autonomía técnica en redes desconectadas de Internet (*Air-Gapped environments*), sin requerir resolución DNS externa ni consumo de recursos remotos.
- **Prohibición Taxativa de Redes de Entrega de Contenido (CDNs):** Queda estrictamente prohibido enlazar hojas de estilo externas, fuentes remotas (ej. Google Fonts) o bibliotecas JavaScript alojadas en servidores de terceros (ej. cdnjs, unpkg, jsdelivr). Todo recurso tipográfico, gráfico o de script debe residir físicamente dentro de la estructura local del proyecto.
- **Sin Herramientas de Empaquetado o Transpilación en Runtime:** El código fuente debe ser ejecutable de forma nativa e inmediata por el motor Chromium mediante la acción de **Cargar descomprimida** (*Load unpacked*). No se admiten configuraciones complejas que demanden `webpack`, `vite`, `rollup` o instalaciones de `node_modules` para la ejecución básica de la herramienta.

### Documentación Didáctica Obligatoria del Código Fuente

El código de este proyecto persigue tanto una finalidad operativa como formativa y didáctica para la comunidad técnica:
- **Comentarios en Bloques y Funciones:** Toda función, clase o módulo relevante debe contar con un encabezado descriptivo en formato JSDoc en idioma español, precisando:
  - Propósito general de la rutina.
  - Parámetros recibidos (tipo y significado funcional).
  - Valor de retorno y estructura de datos devuelta.
  - Posibles excepciones o fallos controlados.
- **Documentación de Heurísticas Complejas:** En procedimientos no evidentes (tales como el recorrido recursivo del árbol DOM, sincronización de componentes reactivos en frameworks modernos o intercepción de métodos globales del objeto `window`), debe incluirse una justificación comentada paso a paso explicando el porqué de la solución implementada.

---

## 6. Reglas Críticas de Sintaxis y Balance de Delimitadores

### Balance Absoluto de Llaves, Paréntesis y Corchetes en JavaScript

Al operar sobre JavaScript nativo puro sin capas intermedias de transpilación o bundlers que aíslen errores de sintaxis antes del despliegue, la integridad estructural del código es de vital importancia.

Un desbalance en la apertura y cierre de llaves `{ }`, paréntesis `( )` o corchetes `[ ]` dentro de cualquiera de los archivos JavaScript (`service-worker.js`, `picker.js`, `sidepanel.js`, `dashboard.js`) ocasiona un error sintáctico irrecuperable (`SyntaxError: Unexpected end of input` o `Unexpected token`) que impide la inicialización completa de la extensión en Chromium.

Todo cambio, adición o refactorización debe garantizar un **balance matemático exacto** entre caracteres de apertura y cierre en cada archivo intervenido:
- Total de llaves `{` == Total de llaves `}`
- Total de paréntesis `(` == Total de paréntesis `)`
- Total de corchetes `[` == Total de corchetes `]`

### Control de Paréntesis en Bloques de Comentarios

Una causa habitual de desbalance aparente en analizadores automáticos o inspectores léxicos proviene de delimitadores no emparejados en comentarios de código (`//` o `/* */`).

Para prevenir ambigüedades y garantizar análisis automatizados limpios:
- **PROHIBIDO:** Emplear listas con paréntesis de cierre huérfanos en comentarios.
  ```javascript
  // INCORRECTO: Delimitadores huérfanos que rompen el balance léxico
  // A) Primer paso del algoritmo
  // B) Segundo paso del algoritmo
  // 1) Validar elemento
  // 2) Disparar evento
  ```
- **OBLIGATORIO:** Emplear pares de delimitadores debidamente balanceados o sustituirlos por identificadores textuales formales.
  ```javascript
  // CORRECTO: Formato con delimitadores balanceados
  // (A) Primer paso del algoritmo
  // (B) Segundo paso del algoritmo

  // CORRECTO: Formato alternativo con etiquetas textuales
  // Caso A: Primer paso del algoritmo
  // Caso B: Segundo paso del algoritmo
  // Paso 1: Validar elemento
  // Paso 2: Disparar evento
  ```

### Verificación Obligatoria Mediante Script Automatizado (check_js.ps1)

Antes de efectuar cualquier confirmación (`git commit`) o solicitar la integración de código, es **mandatorio** ejecutar la verificación automatizada de balance de delimitadores en todos los archivos `.js` del repositorio y la integridad estricta de `manifest.json`.

El script de verificación se encuentra ubicado físicamente en la raíz del repositorio bajo el nombre [`check_js.ps1`](check_js.ps1).

#### Instrucciones de Ejecución en PowerShell
Abra una consola de PowerShell en la raíz del proyecto y ejecute:
```powershell
powershell -ExecutionPolicy Bypass -File .\check_js.ps1
```

#### Código Fuente del Script de Verificación (check_js.ps1)
En caso de requerir su ejecución directa, auditoría o integración en entornos de integración continua (CI/CD), el algoritmo de inspección estructurado provisto en `check_js.ps1` es el siguiente:

```powershell
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
    if ($manifestText -match '//' -or $manifestText -match '/\*') {
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
```

**Criterio de Rechazo:** Ningún Pull Request que presente desbalances en sus archivos JavaScript o comentarios en `manifest.json` será admitido para su fusión.

### Prohibición Taxativa de Comentarios en manifest.json

El archivo `manifest.json` constituye el descriptor de configuración interpretado por el motor de Chromium. La especificación JSON estándar (RFC 8259) no admite comentarios. 

Chromium rechaza categóricamente archivos `manifest.json` que contengan comentarios de una línea (`//`) o multilínea (`/* */`), arrojando un error fatal de análisis en tiempo de carga (`Manifest is not valid JSON`). Por consiguiente, **queda estrictamente prohibido incluir cualquier tipo de comentario dentro de manifest.json**.

---

## 7. Protocolo de Pruebas y Aseguramiento de Calidad

Cada cambio funcional o corrección debe ser sometido a un riguroso protocolo de validación bifásica antes de su envío.

### Validación en el Laboratorio Local (test-sample.html)

El repositorio incluye un laboratorio integral de pruebas desacoplado en el archivo [test-sample.html](test-sample.html). Este entorno simula múltiples topologías de formularios y comportamientos asincrónicos complejos.

Todo contribuidor debe comprobar en `test-sample.html`:
1. **Formulario Transaccional con Validaciones Compuestas:** Verificar que el motor de auditoría identifique correctamente las restricciones HTML5 y reconozca el rechazo de envíos cuando los campos obligatorios o formatos específicos (ej. teléfonos de 10 dígitos) no cumplen los requerimientos.
2. **Indexación Multi-Formulario:** Confirmar que la heurística de rastreo del picker diferencie adecuadamente los campos pertenecientes a formularios lógicos independientes situados en la misma página, sin colisiones de selectores.
3. **Componentes Volátiles (Modales y Drawers Desplegables):** Verificar que la funcionalidad de persistencia de estado y disparo de reapertura (*Trigger Selector*) reactive de manera autónoma el diálogo modal o drawer tras cada vector inyectado, permitiendo culminar baterías de prueba sin interrupción.
4. **Campos Hermanos Requeridos:** Comprobar que los campos complementarios obligatorios configurados sean inyectados con valores válidos sintéticos, permitiendo aislar la respuesta exclusiva del campo auditado.

### Verificación en Aplicaciones Web Reales y Frameworks Reactivos

La extensión debe ser sometida a prueba sobre páginas web externas construidas sobre los principales frameworks front-end del mercado:
- **React:** Comprobar que la neutralización reactiva (`_valueTracker`) sincronice el estado interno del componente virtual con el valor inyectado.
- **Angular y Vue:** Verificar la correcta captura de secuencias sintéticas completas de eventos (`focus`, `input`, `change`, `blur`).
- **Vanilla JS y Aplicaciones Legadas:** Confirmar compatibilidad con validaciones atadas a eventos tradicionales del DOM.

### Supervisión de Interceptores y Diagnósticos de Consola

- **Interceptor de Alertas (`window.alert`):** Verificar que formularios que desplieguen diálogos emergentes nativos de confirmación o alerta no congelen la ejecución secuencial de la extensión.
- **Consola de Desarrollo de Chromium (`F12`):** Inspeccionar la consola de la página analizada y la consola propia del Side Panel / Service Worker (`chrome://extensions` > Inspeccionar vistas). La ejecución de pruebas no debe generar excepciones no controladas (`Uncaught TypeError`, `Uncaught ReferenceError`) ni advertencias de seguridad CSP.

### Inspección de Salida Gráfica y Fidelidad de Impresión en Dashboard

Al auditar modificaciones que afecten al módulo `dashboard/`:
- **Gráfico Donut SVG:** Confirmar que la parametrización trigonométrica calcule con exactitud los arcos vectoriales circulares conforme a los porcentajes reales de severidad, sin superposiciones ni deformaciones visuales.
- **Fidelidad Cromática en Impresión:** Accione el comando de impresión del navegador (`Ctrl + P`) y verifique que la regla `@media print` conmute automáticamente a la vista expandida por categorías con la propiedad `print-color-adjust: exact`, conservando la nitidez del Donut SVG y los colores de las etiquetas de severidad sin cortes indebidos de página.

---

## 8. Política de Divulgación Responsable de Seguridad (Responsible Disclosure)

La seguridad de esta plataforma y la de los sistemas auditados por nuestros usuarios es de máxima prioridad. Si usted detecta una debilidad, vector de inyección inesperado, fuga de permisos o vulnerabilidad de seguridad en el código de **QA Form Field Validator**, solicitamos proceder bajo las mejores prácticas de **Divulgación Responsable** (*Responsible Disclosure*).

### Alcance y Enfoque Defensivo
Esta política aplica a cualquier vulnerabilidad identificada en los componentes propios de la extensión, tales como:
- Debilidades en la Política de Seguridad de Contenido (Content Security Policy - CSP).
- Riesgos de inyección de scripts a través de contextos cruzados (Cross-Context Scripting entre Content Scripts y Side Panel).
- Exposición innecesaria o excesiva de permisos en `manifest.json`.
- Fugas involuntarias de datos a través de APIs de almacenamiento o paso de mensajes IPC.

### Canal de Comunicación Confidencial
- **Canal Privado Obligatorio:** Por motivos de seguridad y para proteger a la comunidad de usuarios, **se solicita abstenerse de reportar posibles vulnerabilidades de seguridad en issues públicas de GitHub, foros o redes sociales** antes de que exista un parche de mitigación verificado.
- **Procedimiento de Notificación:** Envíe un reporte detallado al equipo mantenedor a través del buzón confidencial `security@qaformvalidator.org` o mediante la funcionalidad nativa de *Private Vulnerability Reporting* en la pestaña *Security* del repositorio, conforme al procedimiento documentado en [SECURITY.md](SECURITY.md).

### Estructura del Informe de Seguridad
Para acelerar la evaluación y corrección del hallazgo, su comunicación debe incluir:
1. **Descripción Técnica:** Detalle claro y objetivo de la naturaleza de la vulnerabilidad y el componente afectado.
2. **Prueba de Concepto (PoC):** Pasos detallados y reproducibles para verificar la condición insegura.
3. **Evaluación de Impacto:** Estimación técnica objetiva de la severidad (confidencialidad, integridad, disponibilidad) bajo métricas CVSS si están disponibles.
4. **Propuesta de Remediación (Opcional):** Sugerencias técnicas de mitigación o parches preliminares para solventar la anomalía.

### Ventana de Remediación Coordinada y Reconocimiento
- El equipo mantenedor confirmará la recepción del reporte en un plazo razonable y mantendrá una comunicación periódica sobre el estado de la investigación.
- Se acordará una ventana de remediación coordinada (habitualmente entre 30 y 90 días calendario, conforme a la complejidad técnica) para desarrollar, auditar y desplegar la actualización correctiva antes de cualquier divulgación pública.
- Los investigadores y profesionales de seguridad que reporten vulnerabilidades actuando de buena fe y en apego a esta política recibirán reconocimiento formal en las notas de la versión (*Release Notes*) y en el cuadro de honor técnico del proyecto.

---

## 9. Criterios de Aceptación y Definición de Terminado (Definition of Done)

Para que un Pull Request sea formalmente aceptado y fusionado en la rama `main`, debe satisfacer en su totalidad la siguiente lista de control de calidad:

- [ ] **Alineación Arquitectónica:** El cambio cumple con las directivas de Chromium Manifest V3 y respeta el desacoplamiento entre Service Worker, Side Panel, Content Scripts y Dashboard.
- [ ] **Cero Dependencias en Runtime:** No se incorporan bibliotecas externas, llamadas a CDN, fuentes remotas ni paquetes npm en tiempo de ejecución.
- [ ] **Balance Perfecto de Delimitadores:** El script `check_js.ps1` ha sido ejecutado satisfactoriamente, reportando balance exacto en llaves `{}`, paréntesis `()` y corchetes `[]` en todos los archivos `.js`.
- [ ] **Comentarios Didácticos en Español:** Cada función y bloque lógico incorporado o modificado cuenta con documentación en español formal, sin paréntesis huérfanos en listas.
- [ ] **Integridad de manifest.json:** No se han añadido comentarios de ningún tipo en `manifest.json`.
- [ ] **Validación Funcional en Laboratorio:** Las modificaciones fueron probadas y verificadas con éxito sobre el entorno `test-sample.html`.
- [ ] **Validación en Entornos Reales:** Se constató el comportamiento correcto frente a frameworks web modernos y la ausencia de errores en la consola de Chromium.
- [ ] **Estilo Estricto sin Emojis:** Todo archivo modificado, commit y descripción de PR carece de emojis o pictogramas.
- [ ] **Historial Git Impecable:** Mensajes de confirmación redactados bajo el estándar Conventional Commits y rama sincronizada mediante rebase contra `upstream/main`.
- [ ] **Registro de Cambios y Versionado Sincronizado:** El archivo `CHANGELOG.md` y la clave de versión en `manifest.json` han sido auditados satisfactoriamente mediante `update_changelog.ps1 -Verify`, garantizando apego a Keep a Changelog 1.1.0, SemVer 2.0.0 y ausencia total de emojis.

---

## 10. Marco Legal, Cesión de Derechos y Licenciamiento

Toda aportación de código, documentación o recursos gráficos remitida a este repositorio queda automáticamente licenciada bajo los términos y condiciones de la **Licencia MIT** que rige el proyecto (consulte el archivo [LICENSE](LICENSE)).

Al enviar una solicitud de extracción (*Pull Request*), el contribuidor declara y garantiza expresamente que:
1. Es el autor legítimo del código suministrado o cuenta con los derechos de propiedad intelectual necesarios para conceder su licenciamiento libre y perpetuo bajo la Licencia MIT.
2. El código aportado no infringe derechos de autor, patentes, marcas comerciales ni secretos industriales de terceros.
3. Comprende y acepta plenamente la totalidad de las cláusulas de exención de responsabilidad, renuncia de garantías, límites cuantitativos de indemnización y términos de uso ético formalizados en la **Sección 11 de [README.md](README.md)** (*Aviso Legal, Términos de Uso y Exención Exhaustiva de Responsabilidad*).

---

<p align="center">
  <b>QA Form Field Validator</b> &bull; Guía Oficial de Contribución &bull; Estándares de Ingeniería de Software
</p>
