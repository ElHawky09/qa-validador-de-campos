# Política de Privacidad

**QA Form Field Validator**  
*Documento Corporativo de Privacidad y Tratamiento Técnico de Datos*  
*Última actualización: Septiembre de 2026*

---

## 1. Compromiso Fundamental de Privacidad

El proyecto **QA Form Field Validator** (en adelante, el "Software" o la "Extensión") está fundamentado en el principio de **privacidad desde el diseño y por defecto** (*Privacy by Design and by Default*).

La Extensión es una herramienta técnica concebida para ingenieros de Aseguramiento de Calidad (Quality Assurance - QA), desarrolladores web y auditores de resiliencia de software. La política rectora es transparente y categórica: **la Extensión no recopila, no registra, no comercializa ni transmite remotamente ninguna clase de dato personal, identificador de dispositivo ni información analítica a servidores externos bajo control de los Autores o de terceros.**

---

## 2. Distinción entre Procesamiento Local y Transmisión Remota

Es imprescindible distinguir técnicamente entre el procesamiento efímero dentro del navegador del usuario y la recopilación o transmisión de información:

### 2.1. Procesamiento Estrictamente Local en el Navegador
Para cumplir sus funciones de auditoría y diagnóstico de campos web, la Extensión debe acceder e interactuar de forma programática con la interfaz gráfica y los elementos del Modelo de Objetos del Documento (DOM) de la pestaña que el Usuario decide auditar expresamente.

Este acceso ocurre **única y exclusivamente de forma local**, dentro de los procesos de memoria y la caja de arena (*sandbox*) del navegador Chromium del propio Usuario. Ningún dato leído del DOM ni generado durante la auditoría sale del entorno del navegador local.

### 2.2. Inexistencia de Transmisión o Recopilación Remota
- **Cero Telemetría:** La Extensión no contiene código de rastreo, analítica de uso (como Google Analytics, Mixpanel o similares), ni sondas de seguimiento.
- **Cero Servidores de Recopilación:** No existen servidores remotos, intermediarios, pasarelas de nube ni bases de datos remotas que reciban datos desde la Extensión.
- **Sin Dependencias en Red:** La Extensión no realiza peticiones de red remotas (`fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`) a ningún servicio externo ni descarga recursos externos (scripts, hojas de estilo o fuentes) durante su ejecución.
- **Operatividad en Redes Aisladas (*Air-Gapped*):** La Extensión puede operar plenamente en infraestructuras desconectadas de Internet sin degradación funcional alguna.

---

## 3. Especificación Precisa de Datos Procesados Localmente

Durante una sesión de auditoría iniciada voluntariamente por el Usuario, la Extensión puede acceder y procesar en memoria local las siguientes categorías de información:

1. **Estructura y Jerarquía de Formularios en el DOM:**
   - Etiquetas de formulario (`<form>`), contenedores de interfaz, ventanas modales y paneles laterales (*drawers*).
   - Elementos interactivos editables (`<input>`, `<textarea>`, elementos con `contenteditable="true"`).

2. **Metadatos Técnicos de Campos:**
   - Atributos estándar HTML5: identificadores (`id`), nombres (`name`), tipos de campo (`type`), etiquetas asociadas (`<label>`), textos guía (`placeholder`), atributos de límite (`maxlength`, `minlength`, `min`, `max`, `pattern`, `required`).
   - Selectores CSS generados automáticamente para identificar inequívocamente el elemento en el DOM.

3. **Cargas de Prueba (Payloads) Inyectadas:**
   - Valores sintéticos y cadenas de prueba predefinidas (valores límite, caracteres multibyte, homóglifos, cadenas de sobrecarga de longitud, vectores de escape sintáctico XSS/SQL).
   - Cargas personalizadas ingresadas manualmente por el Usuario para casos de prueba específicos.

4. **Respuestas Observables de la Interfaz Web:**
   - Mensajes y estados de validación nativos de la API de validación HTML5 (`checkValidity`, `validationMessage`).
   - Alertas sincrónicas nativas de JavaScript (`window.alert`) interceptadas no destructivamente para evitar bloqueos del navegador.
   - Mensajes de error visibles generados por la aplicación analizada en el DOM tras la interacción.
   - Variaciones observables del DOM o cambios en el comportamiento visual de la interfaz.

5. **Métricas de Resiliencia y Metadatos de Auditoría:**
   - Títulos o identificadores de casos de prueba asignados por el Usuario (ejemplo: `LOGIN-AUTH-V1`).
   - Conteos estadísticos de pruebas ejecutadas, clasificaciones de respuesta y cálculos heurísticos de resiliencia.

---

## 4. Almacenamiento Local en el Dispositivo

La Extensión hace uso restrictivo de mecanismos de almacenamiento local provistos por el navegador:

| Mecanismo de Almacenamiento | Finalidad Técnica Exclusiva | Duración y Control |
| :--- | :--- | :--- |
| **`chrome.storage.local`** (clave `qa_custom_payloads`) | Guardar de forma persistente en el navegador las cargas útiles personalizadas añadidas voluntariamente por el Usuario para que estén disponibles en sesiones posteriores. | Persiste localmente hasta que el Usuario elimina la prueba personalizada o desinstala la Extensión. |
| **`chrome.storage.local`** (clave `qa_audit_dashboard_data`) | Transferir los resultados estructurados de la última auditoría desde el panel lateral (*Side Panel*) hacia la pestaña completa de la Consola Ejecutiva (*Dashboard*). | Se sobrescribe con cada nueva auditoría o se elimina al presionar el botón "Limpiar" o "Reiniciar todo". |
| **`localStorage`** | Canal alternativo de respaldo utilizado únicamente si el Dashboard se ejecuta en un contexto desacoplado de las APIs de Chrome. | Efímero; gestionable desde las herramientas de desarrollador del navegador. |
| **Memoria RAM de Sesión** | Retención de los estados temporales de auditoría durante la ejecución activa de las pruebas. | Se destruye al cerrar el panel lateral o recargar la pestaña. |

---

## 5. Exportaciones de Informes y Control del Usuario

La Extensión ofrece mecanismos para exportar los resultados de auditoría:
- **Portapapeles del Sistema:** Copiado voluntario de tablas formateadas para Notion o Markdown (GFM). Esta acción interactúa únicamente con el portapapeles local del sistema operativo a solicitud explícita del Usuario.
- **Descarga de Archivos Locales (CSV):** La generación de archivos CSV se procesa mediante un objeto Blob en memoria y se guarda a través de la API estándar de descargas del navegador directamente en el disco del Usuario.
- **Impresión y Generación de PDF:** Se canaliza a través del diálogo nativo del navegador (`window.print`), sin recurrir a servicios externos de renderizado.

En ningún caso los informes o datos exportados se sincronizan ni se envían a servidores de los Autores.

---

## 6. Directivas Operativas: Uso Exclusivo de Datos Sintéticos

**Aviso de Seguridad en Pruebas:**

La Extensión está diseñada para evaluar la resiliencia y los filtros de validación de formularios en entornos de prueba, preproducción (*staging*) o desarrollo.

- **Uso Exclusivo sin Credenciales Reales:** El Usuario debe abstenerse de ejecutar pruebas automatizadas utilizando contraseñas reales, números de identificación oficial reales, claves privadas, tokens de acceso o datos bancarios/financieros auténticos.
- **Recomendación de Datos Sintéticos:** Se recomienda enfáticamente utilizar cuentas ficticias, simuladores (*mocks*), datos aleatorios sintéticos y registros creados específicamente con propósitos de control de calidad.
- **Protección de Datos de Terceros:** El Usuario es responsable de garantizar que las pruebas efectuadas no involucren el tratamiento no consentido de datos personales de terceros protegidos por normativas tales como el RGPD (Unión Europea), la CCPA (California), la LGPD (Brasil), la LFPDPPP (México) u ordenamientos homólogos.

---

## 7. Justificación de Permisos del Manifiesto (Chrome Web Store y Microsoft Edge)

De conformidad con el **Principio de Mínimo Privilegio** y las directrices de la política de Uso Limitado (*Limited Use Policy*) de Google Chrome y Microsoft Edge, cada permiso declarado en [`manifest.json`](manifest.json) responde a una necesidad funcional indispensable:

- `sidePanel`: Requerido para presentar la interfaz de usuario en el panel lateral nativo de Chromium, permitiendo la visualización simultánea del formulario web y el panel de auditoría sin deformar el layout del sitio auditado.
- `activeTab`: Permite a la Extensión acceder temporalmente a la pestaña activa únicamente cuando el Usuario interactúa de forma explícita con la Extensión.
- `scripting`: Necesario para inyectar el script de inspección visual (`content-scripts/picker.js`) sobre la página que el Usuario desea evaluar.
- `storage`: Necesario para almacenar las pruebas personalizadas del Usuario y transferir la información de la auditoría al Dashboard analítico en `chrome.storage.local`.
- `tabs`: Requerido para abrir la pestaña dedicada de pantalla completa para la Consola Ejecutiva (`dashboard/dashboard.html`).
- `contextMenus`: Requerido para habilitar el acceso rápido *"Probar este campo con QA Validator"* al pulsar clic derecho sobre elementos interactivos.
- `host_permissions` (`<all_urls>`): Requerido para que la herramienta pueda ser empleada por ingenieros de calidad en cualquier dominio web, intranet corporativa o servidor de desarrollo local (`http://localhost`, `http://127.0.0.1`) sin restricciones artificiales de origen.

---

## 8. Modificaciones a esta Política de Privacidad

Cualquier actualización en las prácticas de privacidad de la Extensión será reflejada oportunamente en este documento y registrada en el historial cronológico de [`CHANGELOG.md`](CHANGELOG.md). Al tratarse de una herramienta sin telemetría ni comunicación con servidores remotos, los cambios entrarán en vigencia al instalar o actualizar las versiones oficiales del Software.

---

## 9. Canales de Contacto

Para consultas, observaciones técnicas o solicitudes de aclaración sobre las prácticas de privacidad de este proyecto, los interesados pueden comunicarse a través de los canales designados:

- **Contacto de Privacidad y Legal:** `legal@qaformvalidator.org`
- **Contacto de Seguridad Informática:** `security@qaformvalidator.org`
- **Repositorio Oficial del Proyecto:** [https://github.com/ElHawky09/qa-validador-de-campos](https://github.com/ElHawky09/qa-validador-de-campos)
