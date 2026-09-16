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
3. [Taxonomía de Diagnósticos y Clasificación de Señales de Riesgo](#3-taxonomía-de-diagnósticos-y-clasificación-de-señales-de-riesgo)
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
   - [Métricas y Ponderación de Resiliencia Heurística](#métricas-y-ponderación-de-resiliencia-heurística)
   - [Visualización Analítica Donut SVG](#visualización-analítica-donut-svg)
   - [Directivas de Generación de Informes PDF](#directivas-de-generación-de-informes-pdf)
7. [Formatos de Exportación e Integración](#7-formatos-de-exportación-e-integración)
8. [Entorno de Pruebas y Validación Local (test-sample.html)](#8-entorno-de-pruebas-y-validación-local-test-samplehtml)
9. [Estructura del Proyecto y Módulos](#9-estructura-del-proyecto-y-módulos)
10. [Seguridad Operativa y Privacidad de Datos](#10-seguridad-operativa-y-privacidad-de-datos)
11. [Aviso Legal, Condiciones de Uso y Política Ética](#11-aviso-legal-condiciones-de-uso-y-política-ética)
    - [11.1. Principio de Autorización Previa y Uso Autorizado](#111-principio-de-autorización-previa-y-uso-autorizado)
    - [11.2. Advertencias de Seguridad Operativa y Mitigación de Riesgos](#112-advertencias-de-seguridad-operativa-y-mitigación-de-riesgos)
    - [11.3. Naturaleza Heurística y Ausencia de Certificación](#113-naturaleza-heurística-y-ausencia-de-certificación)
    - [11.4. Limitación de Responsabilidad y Cláusula de Cuantía](#114-limitación-de-responsabilidad-y-cláusula-de-cuantía)
    - [11.5. Cumplimiento Normativo y Legislación Aplicable](#115-cumplimiento-normativo-y-legislación-aplicable)
12. [Licencia y Documentos Vinculados](#12-licencia-y-documentos-vinculados)
13. [Historial de Versiones y Registro de Cambios](#13-historial-de-versiones-y-registro-de-cambios)

---

## 1. Descripción General y Arquitectura

**QA Form Field Validator** es una herramienta de ingeniería de software diseñada para equipos de Aseguramiento de Calidad (Quality Assurance - QA), ingenieros de Seguridad de Aplicaciones (AppSec), analistas de pruebas dinámicas (DAST) y desarrolladores front-end. Su propósito primordial es automatizar la inyección sistemática de vectores de prueba, valores de frontera, datos anómalos, caracteres multibyte y secuencias de escape sobre elementos de entrada web, diagnosticando la resiliencia y el comportamiento defensivo de las capas de validación del lado del cliente y del servidor.

Desarrollada bajo la especificación **Chromium Manifest V3**, la extensión opera mediante un acoplamiento no intrusivo utilizando la API nativa de **Side Panel**, lo que permite ejecutar auditorías continuas sin desviar el foco operativo, sin alterar el layout de la aplicación analizada y sin recurrir a dependencias externas en tiempo de ejecución.

### Principios Arquitectónicos Fundamentales
- **Aislamiento Contextual:** La lógica de análisis se ejecuta en contextos desacoplados (Service Worker, Side Panel y Content Scripts aislados), interactuando con el DOM mediante paso de mensajes estructurados (Chrome IPC).
- **Sincronización con Frameworks Modernos:** El motor de inyección resetea de forma reactiva rastreadores de estado internos (tales como `_valueTracker` en React y wrappers en Angular/Vue) y dispara secuencias sintéticas completas de eventos (`focus`, `input`, `change`, `blur`), asegurando que la reactividad del componente procese la carga inyectada.
- **Intercepción de Cuadros Bloqueantes:** El script inyectado contiene un interceptor no destructivo de diálogos sincrónicos (`window.alert`), capturando los mensajes de advertencia emitidos por la aplicación y evitando que el hilo de ejecución del navegador se bloquee durante las pruebas automatizadas.
- **Procesamiento 100% Local:** Todo el procesamiento, estructuración de datos y renderizado ocurre dentro de la sandbox del navegador del usuario, con cero telemetría y sin transmisión de datos a servidores remotos.

---

## 2. Capacidades del Sistema

### Mapeo e Inferencia de Formularios en DOM
- **Indexación Heurística:** Rastrea y cataloga automáticamente formularios `<form>`, contenedores lógicos y elementos de entrada interactivos (`<input>`, `<textarea>`, y contenedores con `contenteditable="true"`).
- **Selector Visual Asistido (Picker Interactivo):** Permite aislar cualquier elemento o botón mediante el cursor en pantalla, con resaltado cromático en tiempo real y soporte para cancelación instantánea mediante la tecla `Escape`.
- **Integración con Menú Contextual del Navegador:** Incorpora una acción nativa al hacer clic derecho sobre cualquier campo editable (*"Probar este campo con QA Validator"*), abriendo el Side Panel y enfocando el elemento de forma inmediata.
- **Nomenclatura Corporativa de Casos de Prueba:** Permite asignar etiquetas identificadoras personalizadas (ej. `LOGIN-AUTH-V1`, `CHECKOUT-STEP-2`), normalizando la trazabilidad en plataformas de gestión de incidencias (Jira, GitHub Issues, Bugzilla).

### Motor de Auditoría Bifásica: Campo y Transacción de Envío
Para evaluar integralmente las defensas de la interfaz y del procesamiento posterior, el motor ejecuta cada prueba en dos fases secuenciales:
1. **Fase 1 (Validación Local de Elemento):** Evalúa la aplicación estricta de restricciones HTML5 (`maxlength`, `pattern`, `min`, `max`, validación de tipo) y sanitizadores de entrada al disparar eventos de interfaz en el campo.
2. **Fase 2 (Validación de Transacción de Envío):** Localiza y acciona programáticamente el mecanismo de envío (`submit` o botón transaccional). Infiere el resultado de la transacción a partir de las señales observables disponibles, incluyendo respuestas HTTP (códigos 4xx, 5xx), la API de validación nativa (`checkValidity`), alertas flotantes (toasts, tooltips de error) y mutaciones estructurales del DOM.

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
| **Total** | ~51 vectores | Batería exhaustiva de estrés: vectores de escape sintáctico (XSS, SQL), cadenas de sobrecarga de búfer (5,000 a 10,000 caracteres) y condiciones límite. |

---

## 3. Taxonomía de Diagnósticos y Clasificación de Señales de Riesgo

Los hallazgos se categorizan con base en una escala técnica orientativa orientada a la priorización de revisiones y remediación defensiva. **La aceptación de un payload en la capa de entrada constituye un indicador o hallazgo potencial de falta de filtrado, mas no demuestra por sí misma la explotabilidad efectiva de una vulnerabilidad sin un análisis contextual de las capas posteriores:**

```
+-----------------------------------------------------------------------------------+
|                        TAXONOMÍA TÉCNICA DE DIAGNÓSTICOS                          |
+-------------------+------------+--------------------------------------------------+
| Categoría         | Prioridad  | Señal Heurística y Criterio Técnico              |
+-------------------+------------+--------------------------------------------------+
| Seguridad         | PRIORITARIO| Indicador de falta de filtrado ante vectores     |
|                   |            | potenciales XSS, sintaxis SQL, tags HTML o nulos.|
|                   |            | Requiere verificar escapado de salida en backend.|
+-------------------+------------+--------------------------------------------------+
| Capacidad         | ALTO       | Carencia de límites de longitud en el búfer;     |
|                   |            | aceptación de cargas masivas (1K a 5K caracteres)|
+-------------------+------------+--------------------------------------------------+
| Integridad        | MEDIO      | Aceptación de caracteres invisibles (zero-width),|
|                   |            | homóglifos, caracteres de control o bytes nulos. |
+-------------------+------------+--------------------------------------------------+
| Lógica / Formato  | MEDIO      | Inconsistencias de formato, omisión de trim() en |
|                   |            | espacios o incompatibilidad con reglas de tipo.  |
+-------------------+------------+--------------------------------------------------+
| Conforme          | CONFORME   | Validación efectiva: el campo aplicó restricción,|
|                   |            | recorte o rechazo conforme a las especificaciones|
+-------------------+------------+--------------------------------------------------+
```

### Estados de Resultado Observable
- **Restringido en Campo:** El elemento HTML5 o los controladores locales impidieron el ingreso o marcaron error inmediato.
- **Restringido al Guardar:** El botón de envío disparó una validación del formulario o respuesta observable que bloqueó la transacción.
- **Truncado por Longitud:** El campo aplicó un límite máximo (`maxlength`) recortando automáticamente la carga excedente.
- **Conforme:** Comportamiento esperado y regular según las especificaciones del campo.
- **Indicador de Riesgo / Hallazgo Potencial:** El valor anómalo fue admitido por la interfaz sin validación aparente, requiriendo revisión técnica de las defensas internas.

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
- **Detección Automatizada:** Presione el botón de reconocimiento para que el script inyectado indexe los formularios y campos presentes en la página.
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
- **URLs y Protocolos:** Esquemas no estándar (`javascript:`), rutas relativas y dominios.
- **Personalizados:** Cargas útiles y reglas sintéticas provistas por el operador.

Defina el perfil de profundidad deseado (*Simple*, *Normal*, *Avanzado* o *Total*).

### Fase 7: Ejecución y Diagnóstico
Haga clic en **Iniciar Verificación de Campos**. La consola lateral mostrará el progreso en tiempo real, registrando la respuesta del DOM, la severidad determinada, el resultado obtenido y la recomendación técnica asociada.

---

## 6. Consola Ejecutiva (Dashboard) y Reportes Técnicos

Al concluir la batería de pruebas, el botón **Abrir Dashboard** inicializa una interfaz analítica en una pestaña independiente dedicada a pantalla completa:

```
+-----------------------------------------------------------------------------------+
|                        CONSOLA EJECUTIVA DE AUDITORÍA                             |
+-----------------------------------------------------------------------------------+
| [ RESILIENCIA: 85% ]   [ SEGURIDAD: 0 ]   [ CAPACIDAD: 2 ]   [ FORMATO: 3 ]       |
+-----------------------------------------------------------------------------------+
| DISTRIBUCIÓN ANALÍTICA DE SEÑALES (Gráfico Donut SVG + Desglose de Severidad)     |
+-----------------------------------------------------------------------------------+
| VISTA DE HALLAZGOS POR CATEGORÍA           | VISTA TABULAR DE AUDITORÍA           |
| - Vectores de Entrada y Seguridad          | - Motor de búsqueda reactiva         |
| - Resistencia de Búfer y Cargas Masivas    | - Filtros dimensionales de estado    |
| - Integridad de Caracteres y Homóglifos    | - Trazabilidad por campo y payload   |
| - Conformidad con Reglas de Validación     |                                      |
+-----------------------------------------------------------------------------------+
```

### Métricas y Ponderación de Resiliencia Heurística
- **Índice Heurístico de Resiliencia (0 a 100%):** Métrica ponderada orientativa calculada en función de la relación entre vectores contenidos o rechazados frente a anomalías en la capa de entrada.
- **Carácter No Certificativo:** Este índice refleja una estimación heurística de robustez de validaciones de cliente; **no constituye una certificación formal de seguridad informática ni sustituye pruebas de penetración profesionales**.
- **Buscador Reactivo y Filtros Multidimensionales:** Permite filtrar hallazgos por nombre de prueba, valor inyectado, mensaje de error capturado y recomendaciones de ingeniería.

### Visualización Analítica Donut SVG
- **Representación Vectorial Circular:** Gráfico Donut generado dinámicamente mediante cálculo trigonométrico en SVG nativo, calibrado para visualización en pantalla e impresión técnica sin distorsiones ni artefactos gráficos.
- **Distribución Proporcional de Severidades:** Segmenta visualmente el estado del formulario auditado discriminando señales de seguridad, capacidad, integridad y pruebas conformes.

### Directivas de Generación de Informes PDF
- Al ejecutar la orden de impresión (`Ctrl + P` o botón del Dashboard), el sistema aplica directivas especializadas de `@media print`:
  - **Estructuración por Categorías:** La salida impresa prioriza el desglose analítico expandido de categorías para revisiones formales de ingeniería.
  - **Fidelidad Cromática:** Incorpora directivas de precisión (`print-color-adjust: exact`) preservando las insignias de severidad y el gráfico Donut vectorial sobre soporte físico o documentos PDF.

---

## 7. Formatos de Exportación e Integración

La herramienta facilita la interoperabilidad con plataformas corporativas de ingeniería de software y gestión de calidad:

| Formato | Especificación Técnica | Caso de Uso Primario |
| :--- | :--- | :--- |
| **PDF Profesional** | Documento técnico formal con gráficos vectoriales, métricas y desglose exhaustivo de hallazgos. | Entregables para equipos de desarrollo, revisiones de calidad y comités técnicos. |
| **Notion** | Bloques estructurados en HTML semántico optimizados para portapapeles. | Transferencia directa a bases de conocimiento internas, wikis de ingeniería y Notion. |
| **Markdown (GFM)** | Sintaxis normalizada GitHub Flavored Markdown con tablas e indicadores de estado. | Creación de incidencias en GitHub Issues, GitLab Epics y tickets de Jira. |
| **CSV** | Valores delimitados por comas normalizados con codificación UTF-8. | Análisis cuantitativo, auditorías en hojas de cálculo y modelado analítico. |
| **JSON** | Objeto estructurado que serializa metadatos de sesión, métricas y resultados atómicos. | Integración en canalizaciones de integración continua (CI/CD) e informes de prueba. |

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
├── LICENSE                    # Licencia oficial de código abierto (MIT License)
├── TERMS.md                   # Documento legal corporativo de Términos de Servicio y Condiciones de Uso
├── PRIVACY.md                 # Política de privacidad corporativa y tratamiento técnico local de datos
├── SECURITY.md                # Política de seguridad y procedimiento de divulgación coordinada
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
│   └── terms.html             # Interfaz visual de Términos, Privacidad y Seguridad accesible en la extensión
├── test-sample.html           # Entorno de pruebas local para validación funcional del validador
└── README.md                  # Documentación técnica, manual operativo y especificaciones
```

---

## 10. Seguridad Operativa y Privacidad de Datos

- **Aislamiento Local Estricto y Cero Telemetría:** La extensión no recopila, no registra, no comercializa ni transmite remotamente información personal, credenciales de acceso ni metadatos analíticos a servidores de los Autores ni de terceros.
- **Ejecución Local en el Navegador:** Todo el procesamiento, cálculo de índices de resiliencia, manipulación de cadenas y renderizado gráfico se ejecuta exclusivamente dentro de la sandbox del navegador web local del usuario.
- **Almacenamiento Local Transparente:** La extensión utiliza exclusivamente `chrome.storage.local` para conservar los vectores de prueba personalizados añadidos por el usuario y transferir los datos estructurados a la pestaña del Dashboard. El usuario puede limpiar estos datos en cualquier momento mediante los botones de reinicio.
- **Advertencia de Datos Sintéticos:** El usuario **no debe** utilizar contraseñas reales, secretos comerciales, tokens de autenticación ni datos personales sensibles durante las pruebas. Se recomienda el uso exclusivo de datos sintéticos y entornos aislados.
- Para conocer en detalle las políticas de tratamiento de datos, consulte la [Política de Privacidad](PRIVACY.md).

---

## 11. Aviso Legal, Condiciones de Uso y Política Ética

### 11.1. Principio de Autorización Previa y Uso Autorizado
- El Software ha sido concebido para propósitos legítimos de ingeniería de calidad, aseguramiento de software y evaluación de resiliencia autorizada.
- **Requisito Indispensable:** El Operador únicamente ejecutará la herramienta sobre sistemas de su propiedad exclusiva o sobre los que cuente con autorización formal, previa, expresa y por escrito de sus administradores autorizados.
- Queda prohibido el empleo del Software para denegaciones de servicio (DoS), ataques indiscriminados o pruebas no consentidas sobre sistemas ajenos.

### 11.2. Advertencias de Seguridad Operativa y Mitigación de Riesgos
- El Operador es responsable de verificar que las pruebas se ejecuten en entornos de desarrollo, laboratorios o preproducción (*staging*).
- Se debe asegurar la existencia de respaldos recientes y verificados (*backups*) de bases de datos antes de iniciar auditorías.
- Se debe evitar la ejecución de pruebas automatizadas sobre formularios vinculados a pasarelas de pago reales o servicios de terceros con efectos irreversibles o costos financieros.

### 11.3. Naturaleza Heurística y Ausencia de Certificación
- Los resultados, clasificaciones de severidad y el Índice Heurístico de Resiliencia emitidos por la herramienta constituyen indicadores orientativos de calidad de entrada.
- **No constituyen una auditoría formal de seguridad informática, peritaje vinculante ni certificación de cumplimiento frente a normas o estándares como PCI-DSS, ISO/IEC 27001, SOC 2, HIPAA, ENS o RGPD.**

### 11.4. Limitación de Responsabilidad y Cláusula de Cuantía
- En la máxima medida permitida por la legislación aplicable, los Autores y colaboradores no serán responsables por daños indirectos, pérdida de datos, lucro cesante o sanciones derivadas del uso de la herramienta.
- La responsabilidad acumulada total se limita al importe abonado por el Software en los doce meses anteriores a la reclamación, o a una suma nominal máxima de diez dólares estadounidenses ($10.00 USD) en caso de distribución gratuita.
- Nada de lo estipulado en este documento pretende excluir o limitar derechos o responsabilidades que por mandato legal imperativo no puedan ser objeto de exclusión o limitación.

### 11.5. Cumplimiento Normativo y Legislación Aplicable
- El Usuario es el único responsable de cumplir con las leyes civiles, administrativas y penales vigentes en la jurisdicción desde la cual opera y donde se ubiquen los sistemas auditados.
- Las referencias normativas contenidas en la documentación del proyecto tienen carácter meramente orientativo e ilustrativo.
- Para consultar los términos legales completos y el régimen de responsabilidad, refiérase al documento independiente [TERMS.md](TERMS.md).

---

## 12. Licencia y Documentos Vinculados

Este proyecto se distribuye bajo los términos de la **Licencia MIT oficial**. Para conocer los términos de cesión de derechos sobre el código fuente, consulte el archivo [LICENSE](LICENSE).

El marco operativo y de gobernanza del proyecto se complementa con los siguientes instrumentos oficiales:
- [Términos y Condiciones de Uso (TERMS.md)](TERMS.md) — Condiciones de uso, autorización previa y límites de responsabilidad.
- [Política de Privacidad (PRIVACY.md)](PRIVACY.md) — Tratamiento técnico de datos, almacenamiento local y cero telemetría.
- [Política de Seguridad (SECURITY.md)](SECURITY.md) — Procedimiento para reporte privado y divulgación coordinada de vulnerabilidades.
- [Guía de Contribución (CONTRIBUTING.md)](CONTRIBUTING.md) — Directivas técnicas, arquitectura y flujo Git.

---

## 13. Historial de Versiones y Registro de Cambios

Para consultar el registro cronológico integral de todas las capacidades incorporadas, correcciones técnicas, directivas de seguridad y optimizaciones arquitectónicas, consulte el archivo [`CHANGELOG.md`](CHANGELOG.md).

El control de versiones y el registro de cambios se encuentran automatizados mediante el script nativo en PowerShell [`update_changelog.ps1`](update_changelog.ps1), rigiéndose estrictamente por las especificaciones internacionales **Keep a Changelog (v1.1.0)** y **Semantic Versioning (SemVer 2.0.0)**.

---

<p align="center">
  <b>QA Form Field Validator</b> &bull; Plataforma de Diagnóstico de Robustez y Calidad en Entradas Web &bull; Chromium Manifest V3
</p>
