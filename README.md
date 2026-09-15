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
    - [11.3. Provisión "TAL CUAL" (AS IS) y Exclusión de Garantías](#113-provisión-tal-cual-as-is-y-exclusión-de-garantías)
    - [11.4. Imputación de Responsabilidad Exclusiva al Operador](#114-imputación-de-responsabilidad-exclusiva-al-operador)
    - [11.5. Cumplimiento Normativo y Legislación sobre Delitos Informáticos](#115-cumplimiento-normativo-y-legislación-sobre-delitos-informáticos)
    - [11.6. Cláusula de Indemnización (Hold Harmless)](#116-cláusula-de-indemnización-hold-harmless)
12. [Licencia](#12-licencia)

---

## 1. Descripción General y Arquitectura

**QA Form Field Validator** es una herramienta de ingeniería de software diseñada para equipos de Quality Assurance (QA), auditores de seguridad de aplicaciones (AppSec), analistas de pruebas de penetración y desarrolladores front-end. Su propósito fundamental es automatizar la inyección sistemática de vectores de prueba, cargas límite, datos anómalos y secuencias de escape sobre elementos de entrada web, evaluando la robustez de las capas de validación del cliente y del servidor.

Desarrollada bajo el estándar **Chromium Manifest V3**, la solución se acopla de manera no intrusiva a través de la API nativa de **Side Panel**, permitiendo realizar diagnósticos exhaustivos en tiempo real sin desviar el flujo de trabajo ni alterar la estructura visual de las aplicaciones auditadas.

---

## 2. Capacidades del Sistema

### Mapeo e Inferencia de Formularios en DOM
- **Detección Automática de Superficies de Entrada:** Analiza la jerarquía del Document Object Model (DOM) para indexar formularios, contenedores lógicos y elementos interactivos (`<input>`, `<textarea>`, `<select>`).
- **Selector Asistido por Cursor (Picker Interactivo):** Permite aislar y seleccionar elementos individuales o contenedores contextuales mediante eventos de cursor sobre la página activa.
- **Asignación de Nomenclatura Corporativa:** Facilita la asignación de identificadores de prueba descriptivos a cada formulario auditado, garantizando trazabilidad en suites de prueba y sistemas de gestión de defectos.

### Motor de Auditoría Bifásica: Campo y Transacción de Envío
El motor de evaluación opera en dos fases desacopladas para distinguir vulnerabilidades en la capa de presentación de fallos en la lógica de procesamiento:
1. **Fase 1 (Validación a Nivel de Elemento):** Simula ciclos de interacción de usuario mediante el disparo secuencial de eventos estándar (`focus`, `input`, `change`, `blur`). Evalúa la aplicación de restricciones HTML5 (`maxlength`, `pattern`, `min`, `max`) y filtros de sanitización locales.
2. **Fase 2 (Validación a Nivel de Transacción de Envío):** Localiza y activa de forma programática el mecanismo de envío (`submit` o botón transaccional). Monitorea respuestas HTTP anómalas (errores 500, fallos de API), activaciones de la API de validación de restricciones (`checkValidity`), componentes de notificación flotantes (toasts, modales de error) y mutaciones estructurales en el DOM para verificar si el backend aceptó o rechazó la carga útil.

### Persistencia y Recuperación de Estado para Modales y Drawers
- En interfaces de usuario asíncronas donde la acción de guardado provoca el cierre del contenedor (ventanas modales, paneles deslizantes o diálogos dinámicos), la extensión incorpora un mecanismo de auto-recuperación.
- El operador registra el selector o elemento disparador de apertura (*trigger*); la extensión lo ejecuta automáticamente antes de cada vector de prueba, asegurando la continuidad desatendida del ciclo de auditoría.

### Inyección Asistida de Campos Hermanos Requeridos
- Resuelve el problema de falsos positivos en formularios con dependencias compuestas: genera valores válidos coherentes en campos obligatorios adyacentes para que la transacción de envío proceda hasta el backend, aislando la evaluación del campo objetivo.

### Matriz de Profundidad de Pruebas

| Perfil de Ejecución | Volumen de Vectores | Alcance Técnico y Enfoque Operativo |
| :--- | :--- | :--- |
| **Simple** | ~10 vectores | Pruebas de humo (*smoke testing*), valores nulos y límites elementales de longitud. |
| **Normal** | ~23 vectores | Cobertura estándar para ciclos de regresión de calidad funcional y control de tipos. |
| **Avanzado** | ~34 vectores | Pruebas de codificación Unicode, homóglifos, caracteres de control y vectores de escape. |
| **Total** | ~41 vectores | Batería exhaustiva: inyecciones de escape sintáctico, estrés de búfer y desbordamiento. |

---

## 3. Taxonomía de Severidad y Clasificación de Riesgo

Los hallazgos se categorizan de acuerdo con una escala técnica de impacto, proporcionando un marco uniforme para la priorización de remediaciones:

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

La extensión no requiere procesos de compilación, transpilación ni instalación de módulos externos; se encuentra construida con estándares web puros (HTML5, CSS3, JavaScript ECMAScript moderno).

### Google Chrome y Brave

1. Clone el repositorio o descargue el archivo comprimido del proyecto en su estación de trabajo.
2. Inicie el navegador y navegue a la interfaz de administración de extensiones:
   - Google Chrome: `chrome://extensions`
   - Brave Browser: `brave://extensions`
3. Active la casilla de verificación **Modo de desarrollador** (*Developer mode*) situada en el sector superior derecho.
4. Presione el botón **Cargar descomprimida** (*Load unpacked*).
5. Seleccione el directorio raíz del proyecto (`qa-form-validator`).
6. Fije la extensión en la barra de herramientas del navegador para acceso directo.

### Microsoft Edge

1. Inicie Microsoft Edge y diríjase a la ruta: `edge://extensions`.
2. En el panel de navegación lateral izquierdo, active el interruptor **Modo de desarrollador**.
3. Seleccione el control **Cargar extensión sin empaquetar**.
4. Localice y confirme el directorio raíz del repositorio.
5. Verifique la correcta activación del componente y fíjelo en la barra de herramientas.

---

## 5. Protocolo Operativo de Uso

### Fase 1: Inicialización del Entorno
Haga clic sobre el identificador de **QA Form Field Validator** en la barra superior del navegador. Se desplegará el **Side Panel** de Chromium adyacente a la pestaña de navegación activa, manteniendo intacto el contexto de la aplicación web bajo examen.

### Fase 2: Reconocimiento y Selección del Objeto de Prueba
- **Detección Automatizada:** Ejecute el comando de escaneo para que el motor identifique y liste las estructuras de formulario presentes en el documento.
- **Selección Focalizada:** Si el elemento se encuentra anidado en componentes complejos o iframes, active el modo de inspección asistida y posicione el cursor directamente sobre el campo de destino.

### Fase 3: Asignación de Metadatos de la Auditoría
Defina el nombre o identificador del caso de prueba en la cabecera del panel (por ejemplo: `PROD-AUTH-LOGIN-V1` o `CHECKOUT-BILLING-STEP2`). Esta etiqueta estructurará la totalidad de los informes generados.

### Fase 4: Definición de Entradas Adyacentes (Campos Hermanos)
En caso de existir campos obligatorios concurrentes dentro del mismo formulario, establezca los valores sintéticos requeridos para evitar abortos tempranos de la transacción de envío durante la prueba.

### Fase 5: Configuración de Disparadores de Reapertura (Opcional)
Para componentes de interfaz transitorios (diálogos modales o paneles desplegables que se repliegan tras la acción de guardado), registre el selector del botón de apertura para que la extensión reactive la interfaz de manera autónoma entre vectores.

### Fase 6: Parametrización de Vectores y Profundidad
Seleccione las categorías analíticas pertinentes al caso de uso (*Texto, Unicode, Números, Fechas, Seguridad, Entradas Personalizadas*) y determine el nivel de profundidad requerido (*Simple*, *Normal*, *Avanzado*, *Total*).

### Fase 7: Ejecución y Diagnóstico
Inicie el ciclo de ejecución. La barra de telemetría local reflejará el avance porcentual, registrando en tiempo real cada vector procesado, la respuesta de la interfaz y la severidad asignada.

---

## 6. Consola Ejecutiva (Dashboard) y Reportes Técnicos

Al concluir la batería de pruebas, el botón **Abrir Dashboard** inicializa una interfaz analítica en una pestaña independiente dedicada:

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
- **Puntuación Global de Robustez (0 a 100%):** Índice ponderado derivado del balance entre vectores contenidos exitosamente frente a vectores que causaron fallos críticos o degradaciones del servicio.
- **Gráfico Donut SVG Vectorial:** Representación circular de alta precisión calibrada matemáticamente mediante cálculo de coordenadas polares en SVG nativo, optimizada para visualización en pantalla e impresión técnica.
- **Filtrado Dinámico en Memoria:** Permite segmentar hallazgos mediante búsqueda de subcadenas sobre payloads inyectados, mensajes de error emitidos por la aplicación y recomendaciones técnicas asociadas.

### Directivas de Generación de Informes PDF
- La emisión de informes formales (mediante `Ctrl + P` o el control de impresión) implementa reglas estrictas de `@media print`:
  - **Estructura Forzada por Categorías:** Para asegurar la máxima rigurosidad en auditorías de entrega y revisiones técnicas, la salida impresa despliega automáticamente la totalidad de los acordeones analíticos por categoría, suprimiendo la vista tabular condensada.
  - **Fidelidad Cromática:** Incorpora directivas de ajuste exacto (`print-color-adjust: exact`) preservando la diferenciación cromática de las insignias de severidad sobre papel o documentos PDF vectoriales.

---

## 7. Formatos de Exportación e Integración

La herramienta facilita la interoperabilidad con ecosistemas corporativos de gestión de defectos e ingeniería de software:

| Formato | Especificación Técnica | Caso de Uso Primario |
| :--- | :--- | :--- |
| **PDF Profesional** | Documento técnico formal con gráficos vectoriales, métricas y desglose exhaustivo de hallazgos. | Entregables para clientes, auditorías de cumplimiento, comités de cambio (*CAB*). |
| **Notion** | Bloques estructurados en HTML semántico optimizados para portapapeles. | Transferencia directa a bases de conocimiento internas, wikis de ingeniería y Notion. |
| **Markdown (GFM)** | Sintaxis normalizada GitHub Flavored Markdown con tablas e indicadores de estado. | Creación de incidencias en GitHub Issues, GitLab Epics y tickets de Jira. |
| **CSV** | Valores delimitados por comas normalizados con codificación UTF-8. | Análisis masivo de datos, auditorías en hojas de cálculo y modelado analítico. |
| **JSON** | Objeto estructurado que serializa metadatos de sesión, métricas y resultados atómicos. | Integración en canalizaciones de integración continua (CI/CD) y almacenes de telemetría. |

---

## 8. Entorno de Pruebas y Validación Local (test-sample.html)

El repositorio suministra un laboratorio de pruebas controlado ubicado en la raíz del proyecto: `test-sample.html`.

### Objetivos del Entorno de Validación
Este laboratorio reproduce condiciones reales de prueba sin requerir conexión a redes externas:
1. **Formulario Transaccional con Restricciones Compuestas:** Incorpora validaciones cruzadas (números telefónicos estrictos, campos de correo requeridos adyacentes).
2. **Arquitectura Multi-Formulario:** Permite evaluar los algoritmos de detección e indexación heurística ante la presencia de múltiples formularios en un mismo documento.
3. **Componentes Modales Desplegables (Drawers):** Demuestra el funcionamiento de la persistencia de estado y la reactivación programática de la interfaz tras el disparo del evento de guardado.

---

## 9. Estructura del Proyecto y Módulos

```
qa-form-validator/
├── manifest.json              # Configuración de permisos, APIs y metadatos Manifest V3
├── service-worker.js          # Coordinador en segundo plano y gestor de eventos del Side Panel
├── content-scripts/
│   ├── picker.js              # Script inyectado para reconocimiento de elementos y navegación DOM
│   └── picker.css             # Reglas visuales de resaltado e inspección en la página examinada
├── sidepanel/
│   ├── sidepanel.html         # Interfaz de usuario del panel de control lateral
│   ├── sidepanel.css          # Directivas de diseño, paleta corporativa y controles
│   └── sidepanel.js           # Núcleo de inyección, matriz de vectores y motores de exportación
├── dashboard/
│   ├── dashboard.html         # Consola ejecutiva de análisis y visualización avanzada
│   ├── dashboard.css          # Estilos de presentación y reglas especializadas de impresión (@media print)
│   └── dashboard.js           # Controlador lógico del dashboard (gráficos SVG, filtros, reactividad)
├── test-sample.html           # Entorno de pruebas local para validación funcional del validador
├── LICENSE                    # Términos de licenciamiento de código abierto (MIT)
└── README.md                  # Documentación técnica, manual operativo y cláusulas legales
```

---

## 10. Seguridad Operativa y Privacidad de Datos

- **Aislamiento en Origen y Cero Telemetría:** La extensión no recopila, no registra, no almacena en servidores remotos ni transmite ninguna clase de información o metadatos.
- **Ejecución Local Estricta:** Todo el procesamiento, cálculo de métricas de resiliencia, manipulación de cadenas y renderizado gráfico se ejecuta exclusivamente dentro de la sandbox del navegador web local del usuario.
- **Operación en Redes Aisladas (*Air-Gapped Readiness*):** La solución carece de dependencias externas en tiempo de ejecución, CDNs o peticiones a endpoints de terceros, permitiendo su despliegue seguro en entornos de alta confidencialidad y redes corporativas desconectadas de Internet.

---

## 11. Aviso Legal, Términos de Uso y Exención Exhaustiva de Responsabilidad

**POR FAVOR, LEA DETENIDAMENTE ESTA SECCIÓN ANTES DE INSTALAR, COMPILAR, COPIAR O UTILIZAR CUALQUIER COMPONENTE DE ESTE SOFTWARE. EL USO DE ESTA HERRAMIENTA CONSTITUYE LA ACEPTACIÓN PLENA, INCONDICIONAL E IRREVOCABLE DE LA TOTALIDAD DE LOS TÉRMINOS Y CLÁUSULAS AQUÍ ESTIPULADAS.**

### 11.1. Principio de Autorización Previa y Uso Exclusivamente Ético
- Este software ha sido concebido, diseñado y distribuido con propósitos estrictamente pedagógicos, de investigación académica, de aseguramiento de calidad de software (*Quality Assurance - QA*), pruebas de resiliencia de entrada y evaluación de seguridad autorizada (*authorized penetration testing* / *ethical hacking*).
- **PROHIBICIÓN EXPRESA DE USO NO AUTORIZADO:** Queda terminantemente prohibido utilizar esta herramienta contra cualquier sitio web, plataforma digital, aplicación web, interfaz de programación de aplicaciones (API), base de datos o infraestructura informática de terceros sin contar con la autorización previa, explícita, por escrito y fehacientemente documentada de los propietarios o representantes legales de dichos sistemas.
- La ejecución de pruebas sobre sistemas informáticos ajenos sin autorización legal previa constituye una actividad ilícita y pasible de sanciones penales y civiles.

### 11.2. Exención Total de Responsabilidad por Daños
- **DISCLAIMER OF DAMAGES:** EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEGISLACIÓN APLICABLE, EN NINGÚN CASO Y BAJO NINGUNA TEORÍA LEGAL O EQUITATIVA (YA SEA POR RESPONSABILIDAD CONTRACTUAL, EXTRACONTRACTUAL, NEGLIGENCIA, RESPONSABILIDAD OBJETIVA O DE CUALQUIER OTRA ÍNDOLE), LOS AUTORES, DESARROLLADORES, CONTRIBUIDORES, MANTENEDORES O TITULARES DE DERECHOS DE AUTOR DE ESTE REPOSITORIO SERÁN RESPONSABLES ANTE EL USUARIO O ANTE CUALQUIER TERCERO POR NINGÚN DAÑO DIRECTO, INDIRECTO, INCIDENTAL, ESPECIAL, PUNITIVO, MORAL, EJEMPLAR O CONSECUENCIAL DERIVADO DEL USO O DE LA INCAPACIDAD DE USO DE ESTE SOFTWARE.
- La presente limitación comprende, de manera enunciativa mas no limitativa:
  - Daños por pérdida de beneficios, interrupción del negocio o cese de operaciones comerciales.
  - Pérdida, alteración, corrupción o divulgación no autorizada de datos, registros o bases de datos.
  - Caída de servidores, indisponibilidad, saturación o degradación intencional o involuntaria de servicios (denegación de servicio - DoS).
  - Activación de alertas de seguridad en Cortafuegos de Aplicaciones Web (WAF), Sistemas de Prevención de Intrusiones (IPS/IDS) o Centros de Operaciones de Seguridad (SOC).
  - Costos de recuperación de sistemas, remediación de incidentes, investigaciones forenses o asesoría jurídica.
  - Sanciones administrativas, multas regulatorias o demandas interpuestas por autoridades gubernamentales o terceros.

### 11.3. Provisión "TAL CUAL" (AS IS) y Exclusión de Garantías
- **DISCLAIMER OF WARRANTIES:** EL SOFTWARE Y LA DOCUMENTACIÓN ASOCIADA SE PROVEEN "TAL CUAL" (*AS IS*) Y "SEGÚN DISPONIBILIDAD" (*AS AVAILABLE*), SIN GARANTÍA DE NINGÚN TIPO, EXPRESA O IMPLÍCITA.
- LOS CREADORES Y TITULARES DE DERECHOS RENUNCIAN EXPRESAMENTE A CUALQUIER GARANTÍA O CONDICIÓN IMPLÍCITA, INCLUYENDO, DE MANERA NO TAXATIVA:
  - GARANTÍAS DE COMERCIABILIDAD (*MERCHANTABILITY*).
  - IDONEIDAD PARA UN PROPÓSITO O FIN DETERMINADO (*FITNESS FOR A PARTICULAR PURPOSE*).
  - NO INFRACCIÓN DE DERECHOS DE PROPIEDAD INTELECTUAL O DE TERCEROS (*NON-INFRINGEMENT*).
  - EXACTITUD, INTEGRIDAD O FIABILIDAD DE LOS RESULTADOS EMITIDOS POR LAS PRUEBAS.
- Los autores no garantizan que la operación del software sea ininterrumpida, esté libre de defectos o vulnerabilidades, ni que el conjunto de vectores de prueba contemple la totalidad de los vectores de ataque existentes en el panorama de amenazas.
- Esta herramienta opera como un asistente complementario de diagnóstico funcional y de robustez; **en ningún caso constituye una certificación formal de seguridad, ni garantiza el cumplimiento de marcos regulatorios como PCI-DSS, ISO/IEC 27001, SOC 2, HIPAA ni normativas análogas.**

### 11.4. Imputación de Responsabilidad Exclusiva al Operador
- El operador del software asume la responsabilidad total, directa, exclusiva e indelegable por cualquier acción, consecuencia o resultado derivado del uso de la herramienta.
- La inyección de cadenas de prueba (tales como vectores de Cross-Site Scripting, inyecciones de escape sintáctico, cargas de saturación de búfer de hasta 10,000 caracteres o secuencias Unicode atípicas) puede provocar comportamientos anómalos o bloqueos en aplicaciones de destino que no dispongan de mecanismos de defensa adecuados.
- Es obligación indeclinable y exclusiva del operador:
  - Verificar que las pruebas se lleven a cabo únicamente en entornos de desarrollo, preproducción (*staging*) o laboratorios de prueba aislados.
  - Realizar copias de seguridad de respaldo (*backups*) completas antes de ejecutar cualquier batería de pruebas sobre entornos que interactúen con almacenamiento persistente.
  - Supervisar las transacciones generadas para evitar colapsos o polución de datos productivos.

### 11.5. Cumplimiento Normativo y Legislación sobre Delitos Informáticos
- El usuario se compromete expresamente a cumplir con la totalidad de las leyes, tratados y reglamentos aplicables en materia de delitos informáticos, privacidad de datos y ciberseguridad a nivel local, federal, nacional e internacional.
- El empleo indebido de este software en redes o sistemas no autorizados puede encuadrar en conductas penalmente sancionadas en las siguientes disposiciones legales y sus equivalentes globales:
  - **Estados Unidos de América:** Computer Fraud and Abuse Act (CFAA, 18 U.S.C. § 1030) y Electronic Communications Privacy Act (ECPA).
  - **Unión Europea:** Directiva 2013/40/UE del Parlamento Europeo y del Consejo, relativa a los ataques contra los sistemas de información, y normativas nacionales de transposición.
  - **Marco Internacional:** Convenio sobre la Ciberdelincuencia del Consejo de Europa (Convenio de Budapest, ETS No. 185).
  - **España:** Código Penal (artículos 197 bis, 197 ter, 264 y concordantes relativos al acceso no autorizado y daños informáticos).
  - **México:** Código Penal Federal (Título Noveno, Delitos contra la Indemnidad y Seguridad Informática, artículos 211 bis 1 al 211 bis 7).
  - **Argentina:** Ley 26.388 de Delitos Informáticos y modificaciones al Código Penal.
  - **Colombia:** Ley 1273 de 2009 de la Protección de la Información y de los Datos.
  - **Chile:** Ley 21.459 que establece normas sobre delitos informáticos.
  - Cualquier otra legislación penal o regulatoria análoga aplicable en la jurisdicción en que se ejecute la herramienta o resida el sistema auditado.

### 11.6. Cláusula de Indemnización (Hold Harmless)
- El usuario acepta defender, indemnizar y mantener indemne a los autores, desarrolladores, contribuidores y distribuidores de este software frente a cualquier reclamación, querella, demanda, litigio, investigación gubernamental, sanción administrativa, arbitraje o procedimiento legal de cualquier índole, así como de cualesquiera pérdidas, daños, responsabilidades, costos y gastos (incluyendo, sin limitación, honorarios razonables de abogados, peritos y costas judiciales) que surjan de o se relacionen con:
  1. La instalación, ejecución, modificación o distribución del software por parte del usuario.
  2. La violación por parte del usuario de estos Términos de Uso o de cualquier ley, tratado o regulación aplicable.
  3. La vulneración o afectación de los derechos de cualquier persona física o jurídica a raíz de las actividades de prueba llevadas a cabo con esta herramienta.

---

## 12. Licencia

Este proyecto se distribuye bajo los términos de la **Licencia MIT**. Para mayores detalles, consulte el archivo [LICENSE](LICENSE).

Las disposiciones establecidas en la sección [11. Aviso Legal, Términos de Uso y Exención Exhaustiva de Responsabilidad](#11-aviso-legal-términos-de-uso-y-exención-exhaustiva-de-responsabilidad) complementan y detallan las estipulaciones de limitación de responsabilidad de la Licencia MIT original, rigiendo plenamente sobre cualquier interpretación de alcance o uso de este software.

---

<p align="center">
  <b>QA Form Field Validator</b> &bull; Plataforma de Diagnóstico de Robustez y Calidad en Entradas Web &bull; Chromium Manifest V3
</p>
