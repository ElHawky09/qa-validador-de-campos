# Política de Seguridad y Divulgación Coordinada de Vulnerabilidades

**QA Form Field Validator**  
*Documento Corporativo de Seguridad de la Información y Gestión de Vulnerabilidades*  
*Última actualización: Septiembre de 2026*

---

## 1. Compromiso con la Seguridad

La seguridad y la integridad del software son principios fundamentales del proyecto **QA Form Field Validator** (en adelante, el "Software").

Como herramienta orientada a la ingeniería de calidad y resiliencia defensiva, mantenemos el compromiso prioritario de garantizar que el código fuente, los scripts inyectados y los componentes de la extensión no introduzcan riesgos de seguridad ni vectores de ataque en los navegadores ni en los entornos de trabajo de los usuarios.

Agradecemos y fomentamos la colaboración responsable de investigadores de seguridad, ingenieros de aseguramiento de calidad y la comunidad técnica para identificar y reportar posibles vulnerabilidades en este proyecto.

---

## 2. Ámbito de Aplicación (Scope)

Esta política aplica exclusivamente a los componentes de software desarrollados y mantenidos dentro del repositorio oficial de **QA Form Field Validator**:

### 2.1. Componentes en Ámbito (*In-Scope*):
- Código fuente de la extensión Chromium Manifest V3:
  - Archivo de configuración [`manifest.json`](manifest.json).
  - Coordinador en segundo plano [`service-worker.js`](service-worker.js).
  - Scripts de contenido inyectados (`content-scripts/picker.js`, `content-scripts/picker.css`).
  - Interfaz del panel lateral (`sidepanel/sidepanel.html`, `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`).
  - Consola ejecutiva de diagnóstico (`dashboard/dashboard.html`, `dashboard/dashboard.js`, `dashboard/dashboard.css`).
- Scripts de automatización y verificación del repositorio (`check_js.ps1`, `update_changelog.ps1`).

### 2.2. Fuera de Ámbito (*Out-of-Scope*):
- Vulnerabilidades intrínsecas del motor del navegador Chromium (Google Chrome, Microsoft Edge, Brave) no causadas por la Extensión.
- Sitios web, aplicaciones, APIs o plataformas de terceros que los usuarios decidan auditar utilizando la herramienta.
- Bifurcaciones (*forks*), paquetes no oficiales, dependencias alteradas o versiones modificadas por terceros fuera del repositorio oficial.

---

## 3. Procedimiento para el Reporte de Vulnerabilidades

Si identifica una posible vulnerabilidad o defecto de seguridad en el Software, le solicitamos que nos lo comunique de inmediato mediante un canal privado y coordinado, **absteniéndose de publicar detalles técnicos o pruebas de concepto en canales públicos o issues de GitHub antes de que exista una mitigación disponible**.

### 3.1. Canal de Reporte Privado
Envíe su reporte de seguridad detallado a la siguiente dirección de correo electrónico designada:

- **Buzón de Seguridad:** `hawkymfs09@proton.me`
- **Asunto sugerido:** `[Vulnerabilidad QA Form Validator] Breve descripción del hallazgo`

### 3.2. Información Requerida en el Reporte
Para permitirnos reproducir, evaluar y remediar la incidencia con la máxima celeridad, por favor incluya:

1. **Descripción Técnica:** Explicación clara de la vulnerabilidad, vector de impacto y severidad estimada.
2. **Versión Afectada:** Versión de la Extensión analizada (consulte [`manifest.json`](manifest.json)).
3. **Entorno de Prueba:** Navegador web y versión exacta (ej. Chrome 128.0, Edge 128.0) y sistema operativo (Windows, Linux, macOS).
4. **Pasos de Reproducción:** Guía paso a paso, precisa y determinista para reproducir la condición anómala.
5. **Prueba de Concepto (PoC):** Código de demostración mínimo y seguro.
6. **Recomendación de Mitigación (opcional):** Si dispone de sugerencias de parche o código de corrección, serán bienvenidas.

### 3.3. Restricciones Éticas y Buenas Prácticas
Al investigar o documentar un hallazgo:
- **NO** incluya credenciales reales de acceso, secretos corporativos, tokens privados ni datos de carácter personal.
- **NO** ejecute acciones que comprometan la disponibilidad, degraden el rendimiento de sistemas o destruyan información.
- Realice todas las pruebas de concepto en entornos locales controlados y reproducibles.

---

## 4. Política de Divulgación Coordinada (*Coordinated Disclosure*)

El proyecto se apega al estándar de **Divulgación Coordinada de Vulnerabilidades** (*Coordinated Vulnerability Disclosure - CVD*), rigiéndose por el siguiente cronograma de respuesta:

1. **Acuse de Recibo:** Los mantenedores emitirán un acuse de recibo inicial en un plazo objetivo de **48 a 72 horas laborables** tras la recepción del reporte.
2. **Evaluación y Triage:** En un plazo de **7 a 10 días laborables**, se comunicará al investigador el resultado del análisis técnico, confirmando la reproducibilidad y el nivel de criticidad asignado.
3. **Desarrollo y Pruebas del Parche:** Se desarrollará e implementará la corrección técnica correspondiente en una rama privada, verificando que no existan regresiones funcionales.
4. **Ventana de Coordinación (90 Días):** Se solicita al investigador mantener la confidencialidad de los detalles técnicos durante una ventana estándar de hasta **90 días naturales** desde el reporte inicial, o hasta que la versión corregida sea publicada oficialmente en las tiendas de extensiones y en el repositorio.
5. **Publicación y Reconocimiento:** Tras el despliegue del parche, se publicará la nota de seguridad en [`CHANGELOG.md`](CHANGELOG.md), acreditando formalmente al investigador que descubrió y reportó la incidencia, salvo que manifieste su deseo de conservar el anonimato.

---

## 5. Prácticas Defensivas del Software

QA Form Field Validator implementa internamente directivas defensivas estrictas para mitigar riesgos en tiempo de ejecución:

- **Escape Sistemático de Salidas:** Todas las cadenas de entrada y metadatos reflejados en el DOM del Side Panel o Dashboard se procesan mediante funciones rigurosas de escape de entidades HTML (`escapeHtml`), impidiendo la inyección cruzada en el contexto de la extensión.
- **Content Security Policy (CSP):** Operación bajo la política de seguridad por defecto de Manifest V3, impidiendo la ejecución de scripts remotos, llamadas a `eval()` o recursos no empaquetados.
- **Aislamiento de Entornos:** Los scripts de contenido se ejecutan en contextos de ejecución aislados (*isolated worlds*), evitando la contaminación mutua de prototipos entre la página web auditada y la extensión.
- **Operación Desconectada:** Inexistencia de llamadas a APIs remotas o CDNs, anulando la exposición a ataques de intermediario (*Man-In-The-Middle*) o envenenamiento de recursos remotos.

---

## 6. Contactos Oficiales de Seguridad

- **Reportes de Seguridad e Incidentes:** `hawkymfs09@proton.me`
- **Consultas Legales y Regulatorias:** `hawkymfs09@proton.me`
- **Repositorio Oficial:** [https://github.com/ElHawky09/qa-validador-de-campos](https://github.com/ElHawky09/qa-validador-de-campos)
