// =================================================================================================
// ARCHIVO: service-worker.js
// PROPÓSITO: Service Worker de fondo (Background Service Worker) para la extensión QA Form Validator.
// COMPATIBILIDAD: Google Chrome, Microsoft Edge, Brave y navegadores basados en Chromium (Manifest V3).
//
// ¿QUÉ ES UN SERVICE WORKER EN CHROME EXTENSIONS (MANIFEST V3)?
// En Manifest V3, el "service worker" sustituye a las antiguas páginas de fondo ("background pages").
// Es un script que se ejecuta en segundo plano, independiente de cualquier pestaña web y sin acceso
// directo al DOM (árbol de elementos HTML). Se activa únicamente en respuesta a eventos del sistema
// (como clics en iconos, mensajes entre scripts o menús contextuales) y se suspende cuando está inactivo
// para ahorrar memoria RAM y batería.
// =================================================================================================

// -------------------------------------------------------------------------------------------------
// EVENTO: chrome.runtime.onInstalled
// ¿QUÉ HACE?
// Se dispara exactamente cuando la extensión se instala por primera vez, cuando se actualiza a una
// nueva versión, o cuando se recarga manualmente desde la pantalla de extensiones (chrome://extensions).
//
// PALABRAS CLAVE:
// - "chrome": Objeto global proporcionado por los navegadores Chromium con todas las APIs de extensiones.
// - "runtime": Módulo para gestionar el ciclo de vida de la extensión, mensajes y metadatos.
// - "addListener": Método que registra una función para que se ejecute ("escuche") cuando ocurra el evento.
// - "() => { ... }": Función flecha (arrow function), una forma concisa de escribir una función anónima en JS.
// -------------------------------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  // -----------------------------------------------------------------------------------------------
  // 1. CONFIGURACIÓN DEL COMPORTAMIENTO DEL PANEL LATERAL (SIDE PANEL)
  // "chrome.sidePanel": API moderna de Chromium (a partir de la versión 114) que permite mostrar una
  // interfaz de usuario persistente en el panel lateral nativo del navegador, sin tapar la página web.
  //
  // "setPanelBehavior": Método para configurar cómo reacciona el panel lateral al interactuar con la extensión.
  // "openPanelOnActionClick: true": Indica que al hacer clic izquierdo en el icono de la barra de
  // herramientas (Action Icon), el navegador debe desplegar automáticamente el panel lateral.
  //
  // "catch((err) => { ... })": Si el navegador no soporta esta opción o falla, captura el error para
  // que la extensión no se detenga inesperadamente.
  // -----------------------------------------------------------------------------------------------
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      // console.warn: Muestra un mensaje de advertencia en la consola de depuración del Service Worker.
      console.warn('sidePanel.setPanelBehavior not supported or failed:', err);
    });
  }

  // -----------------------------------------------------------------------------------------------
  // 2. CREACIÓN DEL MENÚ CONTEXTUAL (CLIC DERECHO)
  // "chrome.contextMenus.create": Añade una opción interactiva al menú que aparece al hacer clic derecho.
  //
  // PARÁMETROS:
  // - "id": Identificador único en texto ('qa_inspect_element') para reconocer qué opción pulsó el usuario.
  // - "title": Texto que se mostrará visiblemente en el menú emergente del usuario.
  // - "contexts: ['editable']": Filtro restrictivo. La opción SOLO aparecerá cuando el clic derecho se
  //   haga sobre elementos editables (etiquetas <input>, <textarea> o contenedores con contenteditable="true").
  // -----------------------------------------------------------------------------------------------
  chrome.contextMenus.create({
    id: 'qa_inspect_element',
    title: 'Probar este campo con QA Validator',
    contexts: ['editable']
  });
});

// -------------------------------------------------------------------------------------------------
// EVENTO: chrome.action.onClicked
// ¿QUÉ HACE?
// Se ejecuta cuando el usuario hace clic en el icono de la extensión en la barra de herramientas.
// Actúa como mecanismo de respaldo (fallback) en caso de que el navegador no haya abierto el panel
// lateral de manera automática mediante openPanelOnActionClick.
//
// PALABRAS CLAVE:
// - "async": Declara que la función es asíncrona, permitiendo usar la palabra clave "await" dentro de ella.
// - "tab": Objeto que contiene toda la información de la pestaña web activa en ese momento (id, url, windowId).
// - "await": Pausa la ejecución de la función asíncrona hasta que la promesa (operación en curso) se resuelva.
// - "try / catch": Bloque de control de excepciones; si ocurre un error dentro de "try", se captura en "catch".
// -------------------------------------------------------------------------------------------------
chrome.action.onClicked.addListener(async (tab) => {
  // Verificamos si la API de Side Panel está disponible y tiene la función .open()
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      // Intentamos abrir el panel lateral en la ventana actual (tab.windowId)
      await chrome.sidePanel.open({ windowId: tab.windowId });
      // Si tuvo éxito, salimos de la función con "return" para no ejecutar el respaldo alternativo.
      return;
    } catch (e) {
      // Si falló (por ejemplo en navegadores antiguos), registramos la advertencia en consola.
      console.warn('sidePanel.open failed, opening in window fallback', e);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // RESPALDO ALTERNATIVO (FALLBACK): ABRIR EN VENTANA POPUP INDEPENDIENTE
  // Si el panel lateral nativo no está disponible, abrimos la interfaz de la extensión en una pequeña
  // ventana emergente tipo ventana auxiliar (popup) de 480x800 píxeles.
  //
  // "chrome.runtime.getURL": Convierte una ruta relativa del proyecto en una URL absoluta con el protocolo
  // interno de extensiones de Chrome (ejemplo: chrome-extension://<id-de-la-extension>/sidepanel/sidepanel.html).
  // "chrome.windows.create": Crea una nueva ventana nativa en el sistema operativo.
  // -----------------------------------------------------------------------------------------------
  const url = chrome.runtime.getURL('sidepanel/sidepanel.html');
  await chrome.windows.create({
    url: url,
    type: 'popup',
    width: 480,
    height: 800
  });
});

// -------------------------------------------------------------------------------------------------
// EVENTO: chrome.contextMenus.onClicked
// ¿QUÉ HACE?
// Se activa cuando el usuario hace clic en una opción de nuestro menú contextual (clic derecho).
//
// PARÁMETROS:
// - "info": Objeto con datos de la acción efectuada (contiene menuItemId, qué texto se seleccionó, etc.).
// - "tab": La pestaña web activa donde el usuario hizo el clic derecho.
// -------------------------------------------------------------------------------------------------
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Validamos que el clic provenga de nuestra opción específica ('qa_inspect_element') y que la pestaña exista.
  // "tab?.id": Sintaxis de encadenamiento opcional (optional chaining); si "tab" es nulo o indefinido, no da error.
  if (info.menuItemId === 'qa_inspect_element' && tab?.id) {

    // PASO 1: Abrir el panel lateral para que el usuario pueda ver los resultados inmediatamente
    if (chrome.sidePanel && chrome.sidePanel.open) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn('Could not open side panel:', err);
      }
    }

    // PASO 2: Enviar un mensaje al "content script" inyectado en la página web
    // "chrome.tabs.sendMessage": Envía un objeto de mensaje a través de comunicación entre procesos (IPC)
    // hacia los scripts que se ejecutan directamente dentro del contexto visual de la página web de esa pestaña.
    // La acción 'SELECT_CONTEXT_TARGET' le indica al content-script (picker.js) que seleccione el elemento
    // HTML sobre el cual el usuario hizo clic derecho.
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SELECT_CONTEXT_TARGET'
      });
    } catch (err) {
      // Puede ocurrir si la página se acaba de cargar o es una página protegida del navegador (ej: chrome://).
      console.warn('Content script not yet ready on tab:', err);
    }
  }
});

// -------------------------------------------------------------------------------------------------
// EVENTO: chrome.runtime.onMessage
// ¿QUÉ HACE?
// Escucha y centraliza los mensajes internos que envían otros componentes de la extensión,
// como el Panel Lateral (sidepanel.js), el Dashboard (dashboard.js) o el Inspector (picker.js).
//
// PARÁMETROS:
// - "message": Objeto JavaScript con los datos enviados (por convención incluye una propiedad "action").
// - "sender": Información de quién envió el mensaje (pestaña, id de extensión, url de origen).
// - "sendResponse": Función回调 (callback) para responder directamente a quien envió el mensaje.
// -------------------------------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // 1. Verificación de conectividad (PING / PONG)
  // Utilizado para comprobar que el Service Worker está despierto y respondiendo.
  if (message.action === 'PING') {
    sendResponse({ status: 'PONG' });
    return false; // "return false" indica que la respuesta fue inmediata y síncrona.
  }

  // 2. Delegación para abrir una nueva pestaña con el Dashboard
  // ¿POR QUÉ SE HACE AQUÍ?
  // En algunas configuraciones de seguridad de extensiones, ciertos contextos secundarios pueden carecer
  // de permisos directos para invocar "chrome.tabs.create". Al delegar la acción al Service Worker,
  // garantizamos una apertura 100% fiable de pestañas completas.
  if (message.action === 'OPEN_DASHBOARD_TAB') {
    // Si el mensaje incluye una URL personalizada la usamos; de lo contrario, abrimos dashboard/dashboard.html
    const url = message.url || chrome.runtime.getURL('dashboard/dashboard.html');

    // "chrome.tabs.create": Crea y abre una nueva pestaña en el navegador con la URL indicada.
    chrome.tabs.create({ url: url }).then((tab) => {
      // Respondemos con éxito e informamos el identificador numérico de la nueva pestaña creada.
      sendResponse({ success: true, tabId: tab.id });
    }).catch((err) => {
      // Si ocurrió un error al abrir la pestaña, lo informamos de regreso.
      sendResponse({ success: false, error: err.message });
    });

    // "return true": OBLIGATORIO cuando se responde de forma asíncrona dentro de "onMessage".
    // Le indica a Chromium que mantenga el canal de comunicación abierto hasta que se llame a sendResponse().
    return true;
  }

  // Si el mensaje no coincide con ninguna acción de este listener, retornamos false para cerrar el canal.
  return false;
});
