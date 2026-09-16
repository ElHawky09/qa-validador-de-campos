# QA Form Field Validator

**Plataforma de Auditoría de Validación de Entradas Web y Pruebas Dinámicas de Resiliencia**  
*Arquitectura Manifest V3 para Navegadores Basados en Chromium (Google Chrome, Microsoft Edge, Brave)*

---

## Tabla de Contenidos

1. [Descripción General y Arquitectura](#1-descripción-general-y-arquitectura)
2. [Capacidades del Sistema](#2-capacidades-del-sistema)
   - [Mapeo e Inferencia de Formularios en DOM](#mapeo-e-inferencia-de-formularios-en-dom)
   - [Motor de Auditoría Bifásica: Campo y Transacción de Envío](#motor-de-auditoría-bifásica-campo-y-transacción-de-envío)
   - [Persistencia y Recuperación de Estado para Modales y Drawers](#persistencia-y-recuperación-de-estado-para-modales-y-drawers)
   - [Inyección Asistida de Campos Hermanos Requeridos](#inyección-asistida-de-campos-hermanos-requeridos)
   - [Matriz de Profundidad de Pruebas](#matriz-de-profundidad-de-pruebas)
3. [Taxonomía de Severidad y Clasificación de Riesgo](#3-taxonomía-de-severidad-y-clasificación-de-riesgo)
4. [Procedimiento de Instalación y Despliegue](#4-procedimiento-de-instalación-y-despliegue)
   - [Google Chrome y Brave](#google-chrome-y-brave)
   - [Microsoft Edge](#microsoft-edge)
5. [Protocolo Operativo de Uso](#5-protocolo-operativo-de-uso)
   - [Fase 1: Inicialización del Entorno](#fase-1-inicialización-del-entorno)
   - [Fase 2: Reconocimiento y Selección del Objeto de Prueba](#fase-2-reconocimiento-y-selección-del-objeto-de-prueba)
   - [Fase 3: Asignación de Metadatos de la Auditoría](#fase-3-asignación-de-metadatos-de-la-auditoría)
   - [Fase 4: Definición de Entradas Adyacentes (Campos Hermanos)](#fase-4-definición-de-entradas-adyacentes-campos-hermanos)
   - [Fase 5: Configuración de Disparadores de Reapertura](#fase-5-configuración-de-disparadores-de-reapertura)
   - [Fase 6: Parametrización de Vectores y Profundidad](#fase-6-parametrización-de-vectores-y-profundidad)
   - [Fase 7: Ejecución y Diagnóstico](#fase-7-ejecución-y-diagnóstico)
6. [Consola Ejecutiva (Dashboard) y Reportes Técnicos](#6-consola-ejecutiva-dashboard-y-reportes-técnicos)
   - [Métricas y Ponderación de Resiliencia](#métricas-y-ponderación-de-resiliencia)
   - [Visualización Analítica Donut SVG](#visualización-analítica-donut-svg)
   - [Directivas de Generación de Informes PDF](#directivas-de-generación-de-informes-pdf)
7. [Formatos de Exportación e Integración](#7-formatos-de-exportación-e-integración)
8. [Entorno de Pruebas y Validación Local (test-sample.html)](#8-entorno-de-pruebas-y-validación-local-test-samplehtml)
9. [Estructura del Proyecto y Módulos](#9-estructura-del-proyecto-y-módulos)
10. [Seguridad Operativa y Privacidad de Datos](#10-seguridad-operativa-y-privacidad-de-datos)
11. [Aviso Legal, Términos de Uso y Exención Exhaustiva de Responsabilidad](#11-aviso-legal-términos-de-uso-y-exención-exhaustiva-de-responsabilidad)
    - [11.1. Principio de Autorización Previa y Uso Exclusivamente Ético](#111-principio-de-autorización-previa-y-uso-exclusivamente-ético)
    - [11.2. Exención Total de Responsabilidad por Daños](#112-exención-total-de-responsabilidad-por-daños)
    - [11.3. Límite Cuantitativo Máximo de Responsabilidad (Liability Cap)](#113-límite-cuantitativo-máximo-de-responsabilidad-liability-cap)
    - [11.4. Provisión "TAL CUAL" (AS IS) y Exclusión Integral de Garantías](#114-provisión-tal-cual-as-is-y-exclusión-integral-de-garantías)
    - [11.5. Inexistencia de Asesoramiento Profesional, Auditoría Vinculante o Confianza Legítima](#115-inexistencia-de-asesoramiento-profesional-auditoría-vinculante-o-confianza-legítima)
    - [11.6. Imputación de Responsabilidad Exclusiva al Operador y Asunción de Riesgo](#116-imputación-de-responsabilidad-exclusiva-al-operador-y-asunción-de-riesgo)
    - [11.7. Exención por Impactos en Servicios de Terceros, Costes de API y Bloqueos de Red](#117-exención-por-impactos-en-servicios-de-terceros-costes-de-api-y-bloqueos-de-red)
    - [11.8. Cumplimiento Normativo y Legislación sobre Delitos Informáticos](#118-cumplimiento-normativo-y-legislación-sobre-delitos-informáticos)
    - [11.9. Renuncia Expresa a Demandas Colectivas y Acciones de Clase](#119-renuncia-expresa-a-demandas-colectivas-y-acciones-de-clase)
    - [11.10. Cláusula de Indemnización Amplia (Hold Harmless)](#1110-cláusula-de-indemnización-amplia-hold-harmless)
    - [11.11. Deslinde por Modificaciones, Bifurcaciones y Distribuciones de Terceros](#1111-deslinde-por-modificaciones-bifurcaciones-y-distribuciones-de-terceros)
    - [11.12. Cláusula de Divisibilidad, Integración y Subsistencia](#1112-cláusula-de-divisibilidad-integración-y-subsistencia)
12. [Licencia](#12-licencia)
13. [Historial de Versiones y Registro de Cambios](#13-historial-de-versiones-y-registro-de-cambios)

---

## 1. Descripción General y Arquitectura

**QA Form Field Validator** es una herramienta de ingeniería de software diseñada para equipos de Aseguramiento de Calidad (Quality Assurance - QA), ingenieros de Seguridad de Aplicaciones (AppSec), analistas de pruebas dinámicas (DAST) y desarrolladores front-end. Su propósito primordial es automatizar la inyección sistemática de vectores de prueba, valores de frontera, datos anómalos, caracteres multibyte y secuencias de escape sobre elementos de entrada web, diagnosticando la resiliencia y el comportamiento defensivo de las capas de validación del lado del cliente y del servidor.

Desarrollada bajo la especificación **Chromium Manifest V3**, la extensión opera mediante un acoplamiento no intrusivo utilizando la API nativa de **Side Panel**, lo que permite ejecutar auditorías continuas sin desviar el foco operativo, sin alterar el layout de la aplicación analizada y sin recurrir a dependencias externas en tiempo de ejecución.

### Principios Arquitectónicos Fundamentales
- **Aislamiento Contextual:** La lógica de análisis se ejecuta en contextos desacoplados (Service Worker, Side Panel y Content Scripts aislados), interactuando con el DOM mediante paso de mensajes estructurados (Chrome IPC).
- **Sincronización con Frameworks Modernos:** El motor de inyección resetea de forma reactiva rastreadores de estado internos (tales como `_valueTracker` en React y wrappers en Angular/Vue) y dispara secuencias sintéticas completas de eventos (`focus`, `input`, `change`, `blur`), asegurando que la reactividad del componente procese la carga inyectada.
- **Intercepción de Cuadros Bloqueantes:** El script inyectado contiene un interceptor no destructivo de diálogos sincrónicos (`window.alert`), capturando los mensajes de advertencia emitidos por la aplicación y evitando que el hilo de ejecución del navegador se bloquee durante las pruebas automatizadas.

---

## 2. Capacidades del Sistema

### Mapeo e Inferencia de Formularios en DOM
- **Indexación Heurística:** Rastrea y cataloga automáticamente formularios `<form>`, contenedores lógicos y elementos de entrada interactivos (`<input>`, `<textarea>`, y contenedores con `contenteditable="true"`).
- **Selector Visual Asistido (Picker Interactivo):** Permite aislar cualquier elemento o botón mediante el cursor en pantalla, con resaltado cromático en tiempo real y soporte para cancelación instantánea mediante la tecla `Escape`.
- **Integración con Menú Contextual del Navegador:** Incorpora una acción nativa al hacer clic derecho sobre cualquier campo editable (*"Probar este campo con QA Validator"*), abriendo el Side Panel y enfocando el elemento de forma inmediata.
- **Nomenclatura Corporativa de Casos de Prueba:** Permite asignar etiquetas identificadoras personalizadas (ej. `LOGIN-AUTH-V1`, `CHECKOUT-STEP-2`), normalizando la trazabilidad en plataformas de gestión de incidencias (Jira, GitHub Issues, Bugzilla).

### Motor de Auditoría Bifásica: Campo y Transacción de Envío
Para discriminar vulnerabilidades locales frente a vulnerabilidades en el procesamiento del backend, el motor ejecuta cada prueba en dos fases secuenciales:
1. **Fase 1 (Validación Local de Elemento):** Evalúa la aplicación estricta de restricciones HTML5 (`maxlength`, `pattern`, `min`, `max`, validación de tipo) y sanitizadores de entrada al disparar eventos de interfaz.
2. **Fase 2 (Validación de Transacción de Envío):** Localiza y acciona programáticamente el mecanismo de envío (`submit` o botón transaccional). Supervisa respuestas HTTP de error (códigos 4xx, 5xx), la API de validación nativa (`checkValidity`), alertas flotantes (toasts, tooltips de error) y mutaciones estructurales del DOM para comprobar si el backend aceptó o rechazó la transacción.

### Persistencia y Recuperación de Estado para Modales y Drawers
- En interfaces de usuario asíncronas donde el evento de guardado provoca el repliegue o destrucción del contenedor (ventanas modales, paneles laterales *drawers* o diálogos modales dinámicos), la extensión ofrece un mecanismo de auto-recuperación desatendida.
- El auditor define el selector del elemento activador de apertura (*trigger*); la extensión lo acciona automáticamente antes de cada vector sucesivo, permitiendo completar suites exhaustivas sin intervención manual.

### Inyección Asistida de Campos Hermanos Requeridos
- Evita falsos positivos en formularios con dependencias compuestas: sintetiza automáticamente valores válidos coherentes en campos obligatorios adyacentes para que la validación de formulario no aborte prematuramente, aislando la evaluación del campo específico auditado.

### Matriz de Profundidad de Pruebas

La batería de vectores se estructura en cuatro niveles jerárquicos acumulativos:

| Perfil de Ejecución | Volumen Aproximado | Alcance Técnico y Enfoque Operativo |
| :--- | :--- | :--- |
| **Simple** | ~13 vectores | Verificaciones mínimas indispensables: valores nulos, cadenas vacías, espacios en blanco y límites elementales de longitud. |
| **Normal** | ~29 vectores | Cobertura estándar: tipos de datos básicos, casos cotidianos de formularios web, formatos numéricos y rangos esperados. |
| **Avanzado** | ~43 vectores | Evaluación profunda: codificación Unicode multibyte, homóglifos, caracteres invisibles (zero-width), esquemas de URL y secuencias de control. |
| **Total** | ~51 vectores | Batería exhaustiva de estrés: inyecciones de escape sintáctico (XSS, SQL), cadenas de sobrecarga de búfer (5,000 a 10,000 caracteres) y condiciones límite. |

---

## 3. Taxonomía de Severidad y Clasificación de Riesgo

Los hallazgos se categorizan con base en una escala técnica objetiva orientada a la priorización de remediación:

```
+-----------------------------------------------------------------------------------+
|                        TAXONOMÍA TÉCNICA DE DIAGNÓSTICOS                          |
+-------------------+------------+--------------------------------------------------+
| Categoría         | Nivel      | Criterio Técnico y Descripción del Riesgo        |
+-------------------+------------+--------------------------------------------------+
| Seguridad         | CRÍTICO    | Omisión de filtrado o escape frente a inyecciones|
|                   |            | XSS (Cross-Site Scripting), tags HTML o SQL.     |
+-------------------+------------+--------------------------------------------------+
| Capacidad         | ALTO       | Carencia de límites de longitud en el búfer;     |
|                   |            | persistencia de cargas masivas (5K a 10K chars). |
+-------------------+------------+--------------------------------------------------+
| Integridad        | MEDIO      | Aceptación de caracteres invisibles (zero-width),|
|                   |            | homóglifos, pictogramas o bytes de control.      |
+-------------------+------------+--------------------------------------------------+
| Lógica / Formato  | MEDIO      | Inconsistencia de tipo de dato (ej. caracteres   |
|                   |            | alfabéticos en campos de cómputo numérico).      |
+-------------------+------------+--------------------------------------------------+
| Conforme          | SEGURO     | El campo aplicó restricción, truncamiento o      |
|                   |            | rechazo conforme a las especificaciones de diseño|
+-------------------+------------+--------------------------------------------------+
```

---

## 4. Procedimiento de Instalación y Despliegue

La solución ha sido construida con tecnologías web nativas puras (HTML5, CSS3, JavaScript ECMAScript estándar), prescindiendo de etapas de empaquetado, transpilación (`webpack`, `vite`) o dependencias `node_modules`.

### Google Chrome y Brave

1. Clone el repositorio localmente o descargue y descomprima el archivo de código fuente:
   ```bash
   git clone https://github.com/ElHawky09/qa-validador-de-campos.git
   ```
2. Abra el navegador e ingrese en la barra de direcciones:
   - Google Chrome: `chrome://extensions`
   - Brave Browser: `brave://extensions`
3. Active la casilla de verificación **Modo de desarrollador** (*Developer mode*) ubicada en la esquina superior derecha.
4. Haga clic en el botón **Cargar descomprimida** (*Load unpacked*).
5. Seleccione la carpeta raíz del proyecto (`qa-form-validator`).
6. Fije la extensión en la barra de herramientas del navegador para su utilización ágil.

### Microsoft Edge

1. Abra Microsoft Edge y diríjase a la ruta interna: `edge://extensions`.
2. En la barra lateral izquierda, active la opción **Modo de desarrollador**.
3. Seleccione el botón **Cargar extensión sin empaquetar**.
4. Localice y confirme el directorio raíz del proyecto.
5. Verifique la inicialización del componente y fíjelo en la barra de controles.

---

## 5. Protocolo Operativo de Uso

### Fase 1: Inicialización del Entorno
Haga clic sobre el icono de **QA Form Field Validator** en la barra superior del navegador para desplegar el **Side Panel** lateral nativo de Chromium, o haga clic derecho sobre cualquier campo editable y elija *"Probar este campo con QA Validator"*.

### Fase 2: Reconocimiento y Selección del Objeto de Prueba
- **Detección Automatizada:** Presione el botón de reconocimiento para que el script content inyectado indexe los formularios y campos presentes en la página.
- **Picker Asistido:** Haga clic en el control de selección con cursor (*Picker*), posicione el puntero sobre el elemento deseado y confirme con un clic. Presione `Escape` en cualquier momento si desea cancelar el modo de selección.

### Fase 3: Asignación de Metadatos de la Auditoría
Especifique un nombre formal para el caso de prueba en el encabezado del panel (por ejemplo: `SEC-AUTH-LOGIN-PASS` o `BILLING-TAX-ID-VALIDATION`). Esta etiqueta estructurará todos los reportes consolidados y exportaciones.

### Fase 4: Definición de Entradas Adyacentes (Campos Hermanos)
Si el formulario contiene campos obligatorios adicionales que impidan la sumisión del formulario cuando están vacíos, complete los valores sintéticos requeridos en el apartado correspondiente para aislar el diagnóstico del campo bajo prueba.

### Fase 5: Configuración de Disparadores de Reapertura
En componentes volátiles (modales, popovers o drawers laterales que se ocultan al disparar el evento de guardado), registre el selector del botón de despliegue para que la extensión reactive la interfaz de manera autónoma entre cada vector inyectado.

### Fase 6: Parametrización de Vectores y Profundidad
Seleccione las categorías funcionales requeridas:
- **Texto:** Cadenas límite, caracteres de escape y longitud.
- **Unicode y Símbolos:** Caracteres multibyte UTF-8, homóglifos y glifos especiales.
- **Números:** Caracteres no numéricos, notación científica, desbordamiento y negativos.
- **Fechas:** Formatos incompatibles, fechas fuera de rango y delimitadores atípicos.
- **Seguridad:** Payloads XSS, inyecciones de escape sintáctico y etiquetas HTML.
- **URLs y Protocolos:** Esquemas peligrosos (`javascript:`), rutas relativas y dominios maliciosos.
- **Personalizados:** Cargas útiles y reglas sintéticas provistas por el operador.

Defina el perfil de profundidad deseado (*Simple*, *Normal*, *Avanzado* o *Total*).

### Fase 7: Ejecución y Diagnóstico
Haga clic en **Ejecutar Pruebas**. La consola lateral mostrará el progreso en tiempo real, registrando la respuesta del DOM, la severidad determinada, el resultado obtenido y la recomendación técnica asociada.

---

## 6. Consola Ejecutiva (Dashboard) y Reportes Técnicos

Al concluir la batería de pruebas, el botón **Abrir Dashboard** inicializa una interfaz analítica en una pestaña independiente dedicada a pantalla completa:

```
+-----------------------------------------------------------------------------------+
|                        CONSOLA EJECUTIVA DE AUDITORÍA                             |
+-----------------------------------------------------------------------------------+
| [ SALUD DE SEGURIDAD: 85% ]   [ CRÍTICOS: 0 ]   [ ALTOS: 2 ]   [ MEDIOS: 3 ]      |
+-----------------------------------------------------------------------------------+
| DISTRIBUCIÓN ANALÍTICA DE HALLAZGOS (Gráfico Donut SVG + Desglose de Severidad)   |
+-----------------------------------------------------------------------------------+
| VISTA DE HALLAZGOS POR CATEGORÍA           | VISTA TABULAR DE AUDITORÍA           |
| - Vectores de Inyección y Seguridad        | - Motor de búsqueda reactiva         |
| - Resistencia de Búfer y Cargas Masivas    | - Filtros dimensionales de severidad |
| - Integridad de Caracteres y Homóglifos    | - Trazabilidad por campo y payload   |
| - Conformidad con Reglas de Validación     |                                      |
+-----------------------------------------------------------------------------------+
```

### Métricas y Ponderación de Resiliencia
- **Índice Global de Robustez (0 a 100%):** Métrica ponderada calculada en función de la relación entre vectores debidamente contenidos/rechazados frente a anomalías críticas o bloqueos.
- **Buscador Reactivo y Filtros Multidimensionales:** Permite filtrar hallazgos por nombre de prueba, valor inyectado, mensaje de error capturado y recomendaciones de ingeniería.

### Visualización Analítica Donut SVG
- **Representación Vectorial Circular:** Gráfico Donut de alta precisión generado dinámicamente mediante cálculo trigonométrico en SVG nativo, calibrado para visualización en pantalla e impresión técnica sin distorsiones ni artefactos gráficos.
- **Distribución Proporcional de Severidades:** Segmenta visualmente el estado del formulario auditado discriminando hallazgos críticos, advertencias de capacidad, integridad y pruebas conformes.

### Directivas de Generación de Informes PDF
- Al ejecutar la orden de impresión (`Ctrl + P` o botón del Dashboard), el sistema aplica directivas especializadas de `@media print`:
  - **Estructuración Forzada por Categorías:** Para garantizar exhaustividad técnica en revisiones de cumplimiento o comités de arquitectura, la salida impresa conmuta automáticamente al desglose analítico expandido de categorías, suprimiendo la vista tabular simplificada.
  - **Fidelidad Cromática:** Incorpora directivas de precisión (`print-color-adjust: exact`) preservando las insignias de severidad y el gráfico Donut vectorial sin distorsión sobre soporte físico o documentos PDF.

---

## 7. Formatos de Exportación e Integración

La herramienta facilita la interoperabilidad con plataformas corporativas de ingeniería de software y gestión de calidad:

| Formato | Especificación Técnica | Caso de Uso Primario |
| :--- | :--- | :--- |
| **PDF Profesional** | Documento técnico formal con gráficos vectoriales, métricas y desglose exhaustivo de hallazgos. | Entregables para clientes, auditorías de cumplimiento, comités de cambio (*CAB*). |
| **Notion** | Bloques estructurados en HTML semántico optimizados para portapapeles. | Transferencia directa a bases de conocimiento internas, wikis de ingeniería y Notion. |
| **Markdown (GFM)** | Sintaxis normalizada GitHub Flavored Markdown con tablas e indicadores de estado. | Creación de incidencias en GitHub Issues, GitLab Epics y tickets de Jira. |
| **CSV** | Valores delimitados por comas normalizados con codificación UTF-8. | Análisis masivo de datos, auditorías en hojas de cálculo y modelado analítico. |
| **JSON** | Objeto estructurado que serializa metadatos de sesión, métricas y resultados atómicos. | Integración en canalizaciones de integración continua (CI/CD) y almacenes de telemetría. |

---

## 8. Entorno de Pruebas y Validación Local (test-sample.html)

El repositorio incluye un entorno de prueba controlado ubicado en la raíz del proyecto: `test-sample.html`.

### Objetivos del Entorno de Validación
Permite validar y demostrar el 100% de las funciones operativas en un entorno local seguro y reproducible:
1. **Formulario Transaccional con Validaciones Compuestas:** Modela formularios corporativos con restricciones cruzadas (teléfonos estrictos de 10 dígitos, campos obligatorios concurrentes).
2. **Arquitectura Multi-Formulario:** Permite auditar la capacidad de segmentación e indexación heurística cuando coexisten múltiples formularios en el mismo árbol DOM.
3. **Componentes Desplegables (Drawers / Modales):** Demuestra el funcionamiento de la persistencia de estado y la reactivación programática de la interfaz tras el disparo del evento de guardado.

---

## 9. Estructura del Proyecto y Módulos

```
qa-form-validator/
├── manifest.json              # Configuración de permisos, APIs y metadatos Manifest V3
├── CHANGELOG.md              # Registro cronológico estructurado bajo Keep a Changelog 1.1.0 y SemVer 2.0.0
├── check_js.ps1              # Script de auditoría de delimitadores e integridad sintáctica de manifest.json
├── update_changelog.ps1       # Script nativo de automatización de registro de cambios y sincronización de versiones
├── CONTRIBUTING.md           # Guía corporativa de contribución, directivas arquitectónicas y flujo Git
├── service-worker.js          # Coordinador en segundo plano, menús contextuales y apertura de Side Panel
├── content-scripts/
│   ├── picker.js              # Script inyectado: inspección visual, sincronización DOM y desvío de alert()
│   └── picker.css             # Reglas visuales de resaltado, contornos e indicadores flotantes
├── sidepanel/
│   ├── sidepanel.html         # Interfaz de usuario del panel de control lateral
│   ├── sidepanel.css          # Directivas de diseño, paleta corporativa y controles responsivos
│   └── sidepanel.js           # Núcleo de inyección, matriz de vectores, cálculo de métricas y exportadores
├── dashboard/
│   ├── dashboard.html         # Consola ejecutiva de análisis y visualización avanzada
│   ├── dashboard.css          # Estilos de presentación y reglas especializadas de impresión (@media print)
│   ├── dashboard.js           # Controlador lógico del dashboard (gráficos SVG, filtros, reactividad)
│   └── terms.html             # Interfaz nativa de Términos y Condiciones de Uso y Exención de Responsabilidad
├── test-sample.html           # Entorno de pruebas local para validación funcional del validador
├── LICENSE                    # Términos de licenciamiento de código abierto (MIT License)
├── TERMS.md                   # Documento legal corporativo de Términos de Servicio y Exención de Responsabilidad
└── README.md                  # Documentación técnica, manual operativo y cláusulas legales
```

---

## 10. Seguridad Operativa y Privacidad de Datos

- **Aislamiento en Origen y Cero Telemetría:** La extensión no recopila, no registra, no almacena en servidores remotos ni transmite ninguna clase de información personal, credenciales, datos de entrada ni metadatos analíticos.
- **Ejecución Local Estricta:** Todo el procesamiento, cálculo de métricas de resiliencia, manipulación de cadenas y renderizado gráfico se ejecuta exclusivamente dentro de la sandbox del navegador web local del usuario.
- **Operación en Redes Aisladas (*Air-Gapped Readiness*):** La solución carece de dependencias externas en tiempo de ejecución, llamadas a CDNs o peticiones de red a endpoints de terceros, permitiendo su despliegue seguro en entornos de alta confidencialidad y redes corporativas desconectadas de Internet.

---

## 11. Aviso Legal, Términos de Uso y Exención Exhaustiva de Responsabilidad

**POR FAVOR, LEA DETENIDAMENTE ESTA SECCIÓN ANTES DE INSTALAR, COPIAR, ACCEDER, COMPILAR O UTILIZAR CUALQUIER COMPONENTE DE ESTE SOFTWARE. EL USO, DESCARGA O DISTRIBUCIÓN DE ESTA HERRAMIENTA CONSTITUYE LA ACEPTACIÓN PLENA, EXPRESA, INCONDICIONAL E IRREVOCABLE DE LA TOTALIDAD DE LOS TÉRMINOS, CONDICIONES Y CLÁUSULAS DE EXENCIÓN AQUÍ ESTIPULADAS. SI NO ESTÁ DE ACUERDO CON ESTAS CONDICIONES, DEBE ABSTENERSE DE UTILIZAR, INSTALAR O DISTRIBUIR ESTE SOFTWARE.**

### 11.1. Principio de Autorización Previa y Uso Exclusivamente Ético
- Este software ha sido concebido, diseñado y distribuido con fines estrictamente didácticos, de investigación técnica, de aseguramiento de calidad de software (*Quality Assurance - QA*), pruebas de resiliencia de entrada y evaluación de seguridad debidamente autorizada (*authorized penetration testing* / *ethical hacking*).
- **PROHIBICIÓN TAXATIVA DE USO NO AUTORIZADO:** Queda terminantemente prohibido utilizar esta herramienta contra cualquier sitio web, plataforma digital, aplicación web, interfaz de programación de aplicaciones (API), base de datos o infraestructura informática de terceros sin contar con la autorización previa, expresa, por escrito y fehacientemente documentada de los propietarios o representantes legales de dichos sistemas.
- La ejecución de pruebas sobre sistemas informáticos ajenos sin autorización legal explícita constituye una conducta punible bajo las leyes civiles y penales aplicables en la mayoría de los países del mundo.

### 11.2. Exención Total de Responsabilidad por Daños
- **DISCLAIMER OF DAMAGES:** EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEGISLACIÓN VIGENTE, EN NINGÚN CASO Y BAJO NINGUNA TEORÍA JURÍDICA O EQUITATIVA (YA SEA POR RESPONSABILIDAD CONTRACTUAL, EXTRACONTRACTUAL, NEGLIGENCIA, RESPONSABILIDAD OBJETIVA O DE CUALQUIER OTRA ÍNDOLE), LOS AUTORES, DESARROLLADORES, CONTRIBUIDORES, MANTENEDORES O TITULARES DE DERECHOS DE ESTE PROYECTO SERÁN RESPONSABLES ANTE EL USUARIO O ANTE CUALQUIER TERCERO POR NINGÚN DAÑO DIRECTO, INDIRECTO, INCIDENTAL, ESPECIAL, PUNITIVO, MORAL, EJEMPLAR O CONSECUENCIAL DERIVADO DEL USO, MAL USO O INCAPACIDAD DE USO DE ESTE SOFTWARE.
- La presente exclusión de responsabilidad comprende, de manera enunciativa y no taxativa:
  - Daños por lucro cesante, pérdida de ingresos comerciales, pérdida de oportunidades de negocio o interrupción operativa.
  - Pérdida, alteración, corrupción, filtración o divulgación no autorizada de datos, registros transaccionales o bases de datos.
  - Colapso de servidores, degradación de rendimiento, saturación de búferes o caída involuntaria o forzada de servicios (denegación de servicio - DoS).
  - Activación de incidentes de seguridad en Cortafuegos de Aplicaciones Web (WAF), Sistemas de Prevención de Intrusiones (IPS/IDS), SiEM o Centros de Operaciones de Seguridad (SOC).
  - Costes derivados de investigaciones forenses, contención de incidentes de ciberseguridad, honorarios periciales o defensa legal.
  - Multas administrativas, sanciones regulatorias o reclamaciones indemnizatorias impuestas por autoridades gubernamentales o terceros.

### 11.3. Límite Cuantitativo Máximo de Responsabilidad (Liability Cap)
- En el supuesto excepcional de que cualquier autoridad judicial, arbitral o tribunal de jurisdicción competente determine que la exención total de responsabilidad estipulada en los presentes términos resulta contraria a normas de orden público, inaplicable o nula, **la responsabilidad acumulada total y agregada de los autores, desarrolladores, colaboradores y distribuidores frente al usuario o cualquier tercero, bajo cualquier concepto o causa de acción, no excederá en ningún caso de la suma de $0.00 USD (cero dólares de los Estados Unidos de América) o el equivalente a cero en cualquier moneda local**, habida cuenta de la naturaleza íntegramente gratuita y libre de cánones de licencia con que se distribuye este software.

### 11.4. Provisión "TAL CUAL" (AS IS) y Exclusión Integral de Garantías
- **DISCLAIMER OF WARRANTIES:** EL SOFTWARE Y LA DOCUMENTACIÓN ASOCIADA SE SUMINISTRAN "TAL CUAL" (*AS IS*) Y "SEGÚN DISPONIBILIDAD" (*AS AVAILABLE*), SIN GARANTÍAS DE NINGÚN TIPO, SEAN EXPRESAS, IMPLÍCITAS, LEGALES O CONVENCIONALES.
- LOS AUTORES Y LICENCIANTES RENUNCIAN EXPRESAMENTE A TODA GARANTÍA IMPLÍCITA, INCLUYENDO SIN LIMITACIÓN:
  - GARANTÍAS DE COMERCIABILIDAD (*MERCHANTABILITY*).
  - IDONEIDAD PARA UN PROPÓSITO O FIN DETERMINADO (*FITNESS FOR A PARTICULAR PURPOSE*).
  - NO INFRACCIÓN DE DERECHOS DE PROPIEDAD INTELECTUAL O DE TERCEROS (*NON-INFRINGEMENT*).
  - EXACTITUD, INTEGRIDAD, INFALIBILIDAD O CONTINUIDAD DE LOS RESULTADOS O DEL SOFTWARE.
- Los autores no garantizan que la ejecución del software carezca de errores involuntarios (*bugs*), que sea compatible con la totalidad de frameworks web presentes o futuros, ni que los vectores de prueba suministrados identifiquen todas las vulnerabilidades potenciales del sistema bajo análisis.
- **AUSENCIA DE CERTIFICACIÓN DE SEGURIDAD:** Esta herramienta constituye un asistente complementario de validación heurística; **bajo ningún concepto constituye una certificación formal de seguridad informática, ni garantiza la conformidad con marcos regulatorios tales como PCI-DSS, ISO/IEC 27001, SOC 2, HIPAA, ENS, RGPD ni regulaciones equivalentes.**

### 11.5. Inexistencia de Asesoramiento Profesional, Auditoría Vinculante o Confianza Legítima
- La información técnica, los diagnósticos de severidad, las puntuaciones porcentuales de robustez (*Score*) y las sugerencias de remediación generadas por la extensión o su Dashboard tienen un propósito meramente orientativo y analítico.
- Ninguna sección del código fuente, documentación o reporte generado constituye asesoramiento profesional, jurídico, de ciberseguridad, forense o de ingeniería de software vinculante.
- **PROHIBICIÓN DE CONFIANZA LEGÍTIMA (*NON-RELIANCE*):** El usuario no podrá ampararse ni alegar confianza legítima en los diagnósticos de la herramienta como justificación o eximente ante brechas de seguridad, filtraciones de datos o sanciones normativas sufridas en sus sistemas. Corresponde exclusivamente al operador y a sus equipos de ingeniería efectuar auditorías independientes, revisiones manuales de código fuente y análisis exhaustivos de arquitectura.

### 11.6. Imputación de Responsabilidad Exclusiva al Operador y Asunción de Riesgo
- El operador del software asume la responsabilidad total, directa, exclusiva e indelegable por cualquier acción, consecuencia o perjuicio derivado de la ejecución del software sobre cualquier sistema o interfaz.
- La inyección de datos de prueba (incluyendo cargas de Cross-Site Scripting, inyecciones de escape sintáctico, sobrecargas masivas de hasta 10,000 caracteres o secuencias Unicode atípicas) puede desencadenar comportamientos imprevistos, bloqueos de procesos o fallos en aplicaciones de destino desprovistas de mecanismos de contención.
- Es obligación y responsabilidad exclusiva del operador:
  - Verificar de manera previa y fehaciente que las pruebas se ejecuten exclusivamente en entornos de desarrollo, pruebas (*staging*) o laboratorios aislados.
  - Asegurar la realización de respaldos integrales y verificados (*backups*) de bases de datos y configuraciones antes de iniciar cualquier batería de pruebas.
  - Supervisar en tiempo real las transacciones emitidas para evitar la polución de almacenes de datos productivos o colapsos de infraestructura.

### 11.7. Exención por Impactos en Servicios de Terceros, Costes de API y Bloqueos de Red
- Los formularios web auditados pueden estar integrados con pasarelas de pago (ej. Stripe, PayPal), proveedores de mensajería SMS/correo (ej. Twilio, SendGrid), sistemas de autenticación multifactor (MFA), herramientas CRM o APIs facturables de terceros.
- Los autores de este software no asumen ninguna responsabilidad por:
  - Costes de facturación, consumo de cuotas o cargos financieros devengados en servicios de computación en la nube o APIs de terceros a raíz de las transacciones generadas durante las pruebas.
  - Inclusión de direcciones IP, subredes o nombres de dominio en listas negras (*IP blacklisting*) o bases de datos de reputación de amenazas.
  - Suspensión, bloqueo de cuentas o revocación de credenciales por parte de proveedores de hosting o servicios gestionados debido a la activación de mecanismos automáticos de protección antifraude o antispam.

### 11.8. Cumplimiento Normativo y Legislación sobre Delitos Informáticos
- El usuario asume el compromiso inequívoco de cumplir rigurosamente con todas las leyes, tratados y reglamentos aplicables en materia de ciberseguridad, delincuencia informática y protección de datos a nivel local, regional, nacional e internacional.
- El uso no autorizado o negligente de este software puede tipificar conductas sancionadas penalmente bajo las siguientes normativas y sus leyes sucesoras o análogas:
  - **Estados Unidos de América:** Computer Fraud and Abuse Act (CFAA, 18 U.S.C. § 1030) y Electronic Communications Privacy Act (ECPA).
  - **Unión Europea:** Directiva 2013/40/UE del Parlamento Europeo y del Consejo relativa a los ataques contra los sistemas de información, y normativas de transposición de los Estados miembros.
  - **Ámbito Internacional:** Convenio sobre la Ciberdelincuencia del Consejo de Europa (Convenio de Budapest, ETS No. 185).
  - **España:** Código Penal (artículos 197 bis, 197 ter, 264 y concordantes relativos al acceso ilícito y daños en sistemas informáticos).
  - **México:** Código Penal Federal (Título Noveno, Delitos contra la Indemnidad y Seguridad Informática, artículos 211 bis 1 al 211 bis 7).
  - **Argentina:** Ley 26.388 de Delitos Informáticos y disposiciones complementarias del Código Penal.
  - **Colombia:** Ley 1273 de 2009 relativa a la Protección de la Información y de los Datos.
  - **Chile:** Ley 21.459 que establece normas sobre delitos informáticos.
  - Cualquier otra legislación penal, civil o administrativa vinculante en la jurisdicción en que opere el usuario o se localicen los servidores de destino.

### 11.9. Renuncia Expresa a Demandas Colectivas y Acciones de Clase
- **CLASS ACTION WAIVER:** EN LA MEDIDA PERMITIDA POR LA LEY APLICABLE, EL USUARIO RENUNCIA EXPRESA, DEFINITIVA E IRREVOCABLEMENTE A CUALQUIER DERECHO DE INICIAR, INTERVENIR, SUMARSE O PARTICIPAR COMO DEMANDANTE O MIEMBRO EN CUALQUIER DEMANDA COLECTIVA (*CLASS ACTION*), ACCIÓN REPRESENTATIVA, PROCEDIMIENTO GRUPAL O PLEITO CONJUNTO CONTRA LOS AUTORES, DESARROLLADORES O DISTRIBUIDORES DE ESTE SOFTWARE.
- Cualquier litigio, diferendo o procedimiento legal que pudiera surgir en relación con el software se ventilará de forma estrictamente individual.

### 11.10. Cláusula de Indemnización Amplia (Hold Harmless)
- El usuario acepta defender, indemnizar y mantener totalmente indemnes a los autores, desarrolladores, contribuidores, mantenedores y distribuidores de este software frente a cualquier querella, reclamación, demanda, investigación judicial o administrativa, litigio, arbitraje o requerimiento regulatorio, así como respecto de cualquier pérdida, daño, responsabilidad, acuerdo transaccional, sanción, costo y gasto (incluyendo honorarios razonables de abogados, peritos y costas procesales) que surjan de o se relacionen directa o indirectamente con:
  1. El acceso, descarga, instalación, ejecución, modificación o distribución del software por parte del usuario.
  2. La infracción de estos Términos de Uso o de cualquier ordenamiento jurídico nacional o internacional por parte del usuario.
  3. La vulneración de los derechos de cualquier persona física o jurídica (incluyendo derechos de propiedad intelectual, intimidad, protección de datos o integridad de sistemas) derivada de las pruebas efectuadas con esta herramienta.

### 11.11. Deslinde por Modificaciones, Bifurcaciones y Distribuciones de Terceros
- Este software es de código abierto. En caso de que terceros realicen bifurcaciones (*forks*), modificaciones, empaquetados no oficiales o incorporen el código fuente en otras aplicaciones o bibliotecas, los autores del repositorio original no asumen ninguna clase de responsabilidad, deber de soporte ni garantía sobre dichas versiones alteradas.
- La inclusión de cargas de prueba maliciosas, binarios alterados o código adulterado distribuido por terceros ajenos a este repositorio oficial no podrá ser imputada en ningún caso a los creadores originales.

### 11.12. Cláusula de Divisibilidad, Integración y Subsistencia
- **Divisibilidad (*Severability*):** Si cualquier tribunal o autoridad competente declarase que alguna de las disposiciones o cláusulas del presente aviso legal es inválida, ilícita, inoponible o nula, dicha declaración afectará única y exclusivamente a la disposición concreta en cuestión. La nulidad parcial no invalidará el resto de las cláusulas, las cuales conservarán plena vigencia, validez y eficacia vinculante.
- **Subsistencia (*Survival*):** Las disposiciones relativas a la exención de responsabilidad, exclusión de garantías, límite cuantitativo de responsabilidad, indemnización, renuncia a demandas colectivas y legislación aplicable continuarán en pleno vigor incluso tras la desinstalación del software, terminación de su uso o revocación de licencias.

---

## 12. Licencia

Este proyecto se distribuye bajo los términos de la **Licencia MIT**. Para mayores detalles sobre los términos de cesión de derechos de autor, consulte el archivo [LICENSE](LICENSE).

Las disposiciones legales, términos de uso ético, exenciones de responsabilidad e indemnidades estipuladas en la sección [11. Aviso Legal, Términos de Uso y Exención Exhaustiva de Responsabilidad](#11-aviso-legal-términos-de-uso-y-exención-exhaustiva-de-responsabilidad) complementan y detallan el alcance de la Licencia MIT, rigiendo con carácter vinculante sobre cualquier uso, distribución o modificación de este software.

---

## 13. Historial de Versiones y Registro de Cambios

Para consultar el registro cronológico integral de todas las capacidades incorporadas, correcciones técnicas, directivas de seguridad y optimizaciones arquitectónicas, consulte el archivo [`CHANGELOG.md`](CHANGELOG.md).

El control de versiones y el registro de cambios se encuentran automatizados mediante el script nativo en PowerShell [`update_changelog.ps1`](update_changelog.ps1), rigiéndose estrictamente por las especificaciones internacionales **Keep a Changelog (v1.1.0)** y **Semantic Versioning (SemVer 2.0.0)**. Para consultar los procedimientos operativos de actualización y directivas de ingeniería, refiérase a la [Guía de Contribución](CONTRIBUTING.md).

---

<p align="center">
  <b>QA Form Field Validator</b> &bull; Plataforma de Diagnóstico de Robustez y Calidad en Entradas Web &bull; Chromium Manifest V3
</p>
