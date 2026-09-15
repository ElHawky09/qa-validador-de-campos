# 🛡️ QA Form Field Validator

> **Extensión profesional para Google Chrome, Microsoft Edge y Brave (Manifest V3)** diseñada para automatizar auditorías de calidad de software, pruebas de penetración en entradas de datos, detección inteligente de formularios web, diagnóstico de severidad en doble fase y generación de reportes ejecutivos en PDF, Notion, Markdown, CSV y JSON.

---

## 📋 Tabla de Contenidos
1. [¿Qué es QA Form Field Validator?](#-qué-es-qa-form-field-validator)
2. [Características Destacadas](#-características-destacadas)
3. [Taxonomía de Severidad y Categorías de Riesgo](#-taxonomía-de-severidad-y-categorías-de-riesgo)
4. [Instalación Paso a Paso](#-instalación-paso-a-paso)
5. [Guía de Uso Rápido](#-guía-de-uso-rápido)
6. [Dashboard Ejecutivo y Reportes PDF](#-dashboard-ejecutivo-y-reportes-pdf)
7. [Formatos de Exportación](#-formatos-de-exportación)
8. [Laboratorio de Pruebas Integrado (test-sample.html)](#-laboratorio-de-pruebas-integrado-test-samplehtml)
9. [Estructura del Proyecto](#-estructura-del-proyecto)
10. [Seguridad y Privacidad](#-seguridad-y-privacidad)

---

## 💡 ¿Qué es QA Form Field Validator?

**QA Form Field Validator** es una herramienta esencial para ingenieros de Quality Assurance (QA), analistas de ciberseguridad, desarrolladores front-end y pentesters. Permite someter cualquier campo o formulario web a baterías intensivas de pruebas de validación funcional, pruebas de estrés (DoS de entrada), inyecciones de escape y vulnerabilidades comunes sin necesidad de escribir scripts manuales.

La extensión opera directamente desde el **Side Panel (Panel Lateral)** nativo de Chromium, permitiendo auditar páginas web en tiempo real mientras se interactúa con la interfaz de usuario.

---

## 🚀 Características Destacadas

### 🎯 Mapeo y Detección Inteligente de Formularios
- **Detección Automática:** Escanea el DOM y mapea instantáneamente todos los formularios y sus campos asociados (`<input>`, `<textarea>`, `<select>`).
- **Selector Asistido por Cursor (Picker):** Permite hacer clic directamente sobre cualquier campo específico o contenedor de la página para auditarlo de manera aislada.
- **Asignación de Nombre al Formulario:** Opción para renombrar el formulario auditado con un título corporativo o de caso de prueba (evita la asignación automática por el primer campo detectado).

### ⚡ Auditoría en Doble Fase (Campo + Acción de Guardado)
- **Fase 1 (Nivel de Campo):** Inyecta el payload simulando eventos reales del usuario (`input`, `change`, `blur`) y evalúa si el campo restringe el valor o lo trunca mediante `maxlength` o máscaras.
- **Fase 2 (Nivel de Guardado / Submit):** Localiza el botón de envío o guardado y lo activa automáticamente. Captura errores de servidor (500), mensajes nativos HTML5 (`checkValidity`), banners flotantes de advertencia y cambios en el DOM para determinar si el backend o la lógica de negocio procesó indebidamente el dato.

### 🔄 Auto-recuperación para Modales y Paneles Desplegables (Drawers)
- Para formularios dentro de paneles laterales (*drawers*) o modales que se cierran al hacer clic en "Guardar", la extensión permite registrar pasos de apertura automática (clic en botón o elemento de activación).
- Antes de cada prueba, reabre automáticamente el formulario para garantizar la continuidad de la auditoría sin intervención humana.

### 🧩 Relleno Inteligente de Campos Obligatorios Secundarios
- Evita falsos positivos causados por otros campos obligatorios vacíos: genera valores válidos aleatorios o respeta valores fijos en los campos secundarios hermanos para que el formulario se envíe con éxito y se evalúe exclusivamente el campo bajo prueba.

### 📊 Niveles de Profundidad de Pruebas
| Nivel | Cobertura Aproximada | Enfoque Principal |
| :--- | :--- | :--- |
| **Simple** | ~10 pruebas | Casos críticos de humo (*smoke test*) y límites elementales. |
| **Normal** | ~23 pruebas | Cobertura equilibrada para ciclos regulares de regresión QA. |
| **Avanzado** | ~34 pruebas | Casos extremos de Unicode, inyecciones de escape y validaciones estrictas. |
| **Total** | ~41 pruebas | Batería exhaustiva de seguridad, estrés de búfer y calidad de datos. |

---

## 🏷️ Taxonomía de Severidad y Categorías de Riesgo

El sistema clasifica cada hallazgo bajo una taxonomía técnica estricta:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TAXONOMÍA DE DIAGNÓSTICOS                       │
├─────────────────┬──────────┬───────────────────────────────────────────┤
│ Categoría       │ Nivel    │ Descripción Técnica                       │
├─────────────────┼──────────┼───────────────────────────────────────────┤
│ Seguridad       │ CRÍTICO  │ Falta de filtrado frente a inyecciones    │
│                 │          │ XSS, etiquetas HTML o vectores SQL.       │
├─────────────────┼──────────┼───────────────────────────────────────────┤
│ Capacidad       │ ALTO     │ Falta de límite de longitud (buffer/DoS), │
│                 │          │ cargas masivas de 5,000 a 10,000 chars.   │
├─────────────────┼──────────┼───────────────────────────────────────────┤
│ Integridad      │ MEDIO    │ Caracteres invisibles (zero-width),       │
│                 │          │ homoglyphs, emojis o caracteres de control│
├─────────────────┼──────────┼───────────────────────────────────────────┤
│ Lógica / Formato│ MEDIO    │ Incompatibilidad de tipo (ej. letras en   │
│                 │          │ campo numérico, solo espacios en blanco). │
├─────────────────┼──────────┼───────────────────────────────────────────┤
│ Conforme        │ SEGURO   │ El campo restringió, truncó o validó      │
│                 │          │ la entrada correctamente según el diseño. │
└─────────────────┴──────────┴───────────────────────────────────────────┘
```

---

## 📦 Instalación Paso a Paso

QA Form Field Validator no requiere compilación ni dependencias externas; está construido con tecnologías web puras bajo **Manifest V3**.

### Google Chrome / Brave / Chromium
1. Clona o descarga este repositorio en tu computadora.
2. Abre tu navegador y dirígete a:
   - En Chrome: `chrome://extensions`
   - En Brave: `brave://extensions`
3. En la esquina superior derecha, activa el **Modo de desarrollador**.
4. Haz clic en el botón **Cargar descomprimida** (*Load unpacked*).
5. Selecciona la carpeta raíz del proyecto (`qa-form-validator`).
6. *(Recomendado)* Haz clic en el ícono de extensiones (pieza de rompecabezas) y fija **QA Form Field Validator** en la barra de herramientas para acceder con un clic.

### Microsoft Edge
1. Navega a `edge://extensions`.
2. En la barra lateral izquierda, activa el interruptor **Modo de desarrollador**.
3. Haz clic en **Cargar extensión sin empaquetar**.
4. Selecciona la carpeta raíz del repositorio.
5. Fija la extensión en la barra de herramientas.

---

## 🖥️ Guía de Uso Rápido

### Paso 1: Abrir la Extensión
Haz clic en el ícono de **QA Form Field Validator** en la barra del navegador. Se abrirá automáticamente el **Panel Lateral (Side Panel)** a la derecha de la pantalla sin interrumpir la navegación.

### Paso 2: Seleccionar o Detectar el Formulario
- **Detectar Formularios:** Haz clic en el botón para que la extensión identifique todos los bloques de entrada de la página.
- **Puntero Asistido:** Si el formulario está dentro de un iframe o diseño complejo, haz clic en **"Apuntar sector"** o **"Añadir campo"** y haz clic sobre el elemento en la página.

### Paso 3: Asignar un Nombre Descriptivo
En el encabezado del panel lateral, personaliza el nombre del formulario (por ejemplo: *"Formulario de Registro de Clientes"* o *"Checkout - Paso 2"*). Este nombre se utilizará en todos los reportes y en el Dashboard.

### Paso 4: Configurar Campos Hermanos (Opcional pero Recomendado)
Si el formulario tiene otros campos marcados como `required` (por ejemplo, correo o teléfono de 10 dígitos), configura valores de relleno automático para que el envío no falle por esos campos secundarios mientras se evalúa el campo principal.

### Paso 5: Automatización de Apertura (Para Modales / Drawers)
Si al presionar "Guardar" el modal o panel lateral se cierra automáticamente:
1. Activa la casilla **"Reabrir formulario automáticamente"**.
2. Usa el puntero para seleccionar el botón o trigger que abre el modal.
3. La extensión lo activará antes de cada caso de prueba.

### Paso 6: Seleccionar Categorías y Nivel de Profundidad
Elige si deseas ejecutar todas las categorías (*Texto, Unicode, Números, Fechas, Seguridad, Propios*) o desmarca las que no apliquen a tu tipo de campo. Configura la profundidad (*Simple*, *Normal*, *Avanzado*, *Total*).

### Paso 7: Iniciar Verificación
Haz clic en **"Iniciar Verificación"**. La extensión ejecutará cada prueba en orden, mostrando una barra de progreso en vivo y registrando los diagnósticos en tiempo real.

---

## 📈 Dashboard Ejecutivo y Reportes PDF

Al finalizar la auditoría, haz clic en **"Abrir Dashboard"** para abrir la consola ejecutiva de análisis en una pestaña dedicada a pantalla completa:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD EJECUTIVO                             │
├────────────────────────────────────────────────────────────────────────┤
│ [ SCORE DE SALUD: 85% ]   [ CRÍTICOS: 0 ]   [ ALTOS: 2 ]   [ MEDIOS: 3 ]│
├────────────────────────────────────────────────────────────────────────┤
│  DISTRIBUCIÓN VISUAL DE RIESGOS (Donut Chart SVG + Barras de Severidad)│
├────────────────────────────────────────────────────────────────────────┤
│  VISTA DE ACORDEONES POR CATEGORÍA  |  VISTA DE TABLA DETALLADA        │
│  - Seguridad e Inyecciones          |  - Buscador reactivo en vivo     │
│  - Capacidad y Resistencia DoS      |  - Filtros dinámicos por píldora │
│  - Integridad y Spoofing            |  - Insignias de riesgo           │
│  - Conformes y Restringidos         |                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Funciones del Dashboard:
- **Score Global de Robustez (0 a 100%):** Métrica porcentual ponderada que sintetiza la resistencia del formulario frente a datos anómalos y ataques comunes.
- **Gráfico Donut SVG Calibrado:** Visualización matemática circular del balance entre pruebas conformes y vulnerabilidades detectadas.
- **Tarjetas de Severidad Detalladas:** Desglose cuantitativo y porcentual por categoría de riesgo.
- **Buscador en Tiempo Real y Filtros:** Permite buscar hallazgos específicos por nombre de prueba, campo evaluado, carga útil (*payload*) o recomendación técnica.
- **Informe Formal en PDF:**
  - Al hacer clic en **"Imprimir / PDF"** (o presionar `Ctrl + P`), se genera automáticamente un documento imprimible de alta calidad técnica.
  - **Formato Exclusivo por Categorías:** El PDF se renderiza siempre en el formato estructurado por categorías (el más exhaustivo y completo), expandiendo automáticamente todas las tarjetas de hallazgos, recomendaciones técnicas y respetando la paleta de colores oficial (`print-color-adjust: exact`).

---

## 📤 Formatos de Exportación

La extensión ofrece múltiples alternativas para compartir hallazgos con equipos de desarrollo o plataformas de gestión de proyectos:

| Formato | Descripción | Destino Ideal |
| :--- | :--- | :--- |
| **PDF Profesional** | Informe formal ejecutivo con Score, gráficos y detalle de hallazgos. | Clientes, stakeholders, auditorías de entrega. |
| **Notion** | Copia al portapapeles en HTML semántico con bloques y formato enriquecido. | Documentación en wikis de equipo o Notion pages. |
| **Markdown (GFM)** | Tabla formateada en sintaxis estándar GitHub Flavored Markdown. | Issues de GitHub/GitLab, pull requests, tickets de Jira. |
| **CSV** | Archivo `.csv` estructurado con columnas delimitadas por comas. | Excel, Google Sheets, análisis de datos en masa. |
| **JSON** | Objeto JSON completo con metadatos, métricas y resultados brutos. | Integración en pipelines CI/CD o almacenamiento analítico. |

---

## 🧪 Laboratorio de Pruebas Integrado (`test-sample.html`)

El repositorio incluye un archivo de prueba completo ubicado en la raíz: `test-sample.html`.

### ¿Para qué sirve?
Permite comprobar y demostrar el 100% de las funciones de la extensión en un entorno local controlado:
1. Abre el archivo `test-sample.html` directamente en tu navegador.
2. Contiene diversos escenarios de prueba reales:
   - Formulario de Registro con validaciones estrictas (teléfonos de 10 dígitos, campos obligatorios adyacentes).
   - Formulario secundario en la misma página para probar detección multi-formulario.
   - Formulario en panel lateral desplegable (*drawer*) que se oculta automáticamente al guardar (ideal para probar la auto-reapertura).
3. Abre la extensión y comprueba cómo detecta los campos, ejecuta las pruebas y genera los reportes de inmediato.

---

## 📂 Estructura del Proyecto

```
qa-form-validator/
├── manifest.json              # Manifiesto V3 de la extensión (permisos, side panel, scripts)
├── service-worker.js          # Background worker (apertura de side panel al hacer clic en el ícono)
├── content-scripts/
│   ├── picker.js              # Script inyectado para selección visual de campos y detección DOM
│   └── picker.css             # Estilos de resaltado, contornos e indicadores visuales en página
├── sidepanel/
│   ├── sidepanel.html         # Interfaz de usuario del panel lateral
│   ├── sidepanel.css          # Estilos del panel lateral (tema oscuro, botones, animaciones)
│   └── sidepanel.js           # Motor central de pruebas, taxonomía, lógica de ejecución y exportadores
├── dashboard/
│   ├── dashboard.html         # Interfaz del Dashboard Ejecutivo de Auditoría
│   ├── dashboard.css          # Estilos del dashboard y reglas de impresión profesional (@media print)
│   └── dashboard.js           # Controlador lógico del dashboard (gráficos SVG, filtros, reactividad)
├── test-sample.html           # Página de laboratorio local con casos de prueba y drawers
└── README.md                  # Manual de usuario y documentación técnica completa
```

---

## 🔒 Seguridad y Privacidad

- **Cero Telemetría:** La extensión no recopila, almacena ni transmite ningún tipo de información a servidores externos.
- **Ejecución 100% Local:** Todo el procesamiento, validación, cálculo de métricas y renderizado de gráficos se ejecuta estrictamente en el entorno del navegador del usuario.
- **Sin Dependencias de Red Externas:** No utiliza CDNs ni librerías de terceros en tiempo de ejecución, asegurando su funcionamiento incluso en redes corporativas con aislamiento total (*air-gapped*) o sin conexión a Internet.
- **Código Didáctico y Auditable:** Todos los archivos JavaScript del proyecto cuentan con documentación técnica exhaustiva en español para facilitar su revisión de seguridad y adaptación interna.

---

<p align="center">
  <b>QA Form Field Validator</b> &bull; Herramienta de Diagnósticos Granulares de Calidad &bull; Arquitectura Manifest V3
</p>
