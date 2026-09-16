// =================================================================================================
// ARCHIVO: content-scripts/picker.js
// PROPÓSITO: Script de contenido inyectado directamente en las páginas web auditadas.
// COMPATIBILIDAD: Manifest V3 de Chromium (Chrome, Edge, Brave).
//
// ¿QUÉ HACE ESTE CONTENT SCRIPT?
// 1. Proporciona el modo "Picker" visual para apuntar e inspeccionar campos, botones y formularios con el cursor.
// 2. Extrae metadatos precisos de los elementos del DOM (tipo de input, selectores CSS únicos, etiquetas asociadas).
// 3. Autodetecta el formulario principal y su respectivo botón de Guardar/Enviar.
// 4. Inyecta cargas de prueba (payloads) de forma segura y resetea rastreadores internos (como el _valueTracker de React).
// 5. Soporta el relleno inteligente de campos obligatorios hermanos con datos sintéticos válidos para no bloquear el guardado.
// 6. Monitorea y captura mensajes de error del DOM y llamadas nativas a "window.alert" durante las pruebas de inyección.
// =================================================================================================

(() => {
  // -----------------------------------------------------------------------------------------------
  // PROTECCIÓN CONTRA INYECCIÓN MÚLTIPLE
  // Si el script ya fue inyectado previamente en esta misma pestaña (por ejemplo, al recargar o inyectar manualmente),
  // se detiene inmediatamente para no duplicar escuchas de eventos ni sobrecargar la página web.
  // -----------------------------------------------------------------------------------------------
  if (window.__qaFormValidatorInjected) {
    return;
  }
  window.__qaFormValidatorInjected = true; // Marca global en la ventana para indicar que el script ya está activo.

  // -----------------------------------------------------------------------------------------------
  // VARIABLES DE ESTADO DEL INSPECTOR (PICKER)
  // Controlan qué tipo de elemento está seleccionando el usuario en cada momento.
  // -----------------------------------------------------------------------------------------------
  let isPickingField = false;         // Verdadero si el usuario está seleccionando un campo de entrada (input/textarea)
  let isPickingSaveButton = false;    // Verdadero si está apuntando al botón de Guardar/Enviar
  let isPickingForm = false;          // Verdadero si está apuntando a un formulario completo o contenedor
  let isPickingReopenStep = false;    // Verdadero si está seleccionando un botón de re-apertura (ej: "Editar", "Modal")
  let hoveredElement = null;          // Almacena la referencia en memoria del elemento HTML bajo el cursor
  let targetElement = null;           // Almacena el campo actualmente seleccionado como objetivo de prueba
  let saveButtonElement = null;       // Almacena el botón de guardado actualmente asociado
  let lastRightClickedElement = null; // Almacena el último elemento sobre el que el usuario hizo clic derecho
  let bannerEl = null;                // Elemento visual (DOM) del banner informativo superior fijado en pantalla
  let tooltipEl = null;               // Elemento flotante (tooltip) que sigue al cursor mostrando información del elemento
  let lastCapturedAlert = null;       // Mensaje de texto capturado si la página ejecutó window.alert("...")

  // -----------------------------------------------------------------------------------------------
  // INTERCEPTOR DE DIÁLOGOS "window.alert"
  // ¿POR QUÉ SE INTERCEPTA?
  // Muchos formularios web antiguos o sistemas corporativos muestran alertas nativas con window.alert()
  // al rechazar datos inválidos. Dado que window.alert() congela el hilo de ejecución del navegador,
  // inyectamos una función envoltorio en el contexto de la página para capturar el texto del alert,
  // despachar un evento personalizado ('__qa_alert_captured') y permitir que la auditoría continúe sin trabarse.
  // -----------------------------------------------------------------------------------------------
  try {
    const script = document.createElement('script');
    script.textContent = `
      (() => {
        window.__qa_last_alert = null;
        const _nativeAlert = window.alert;
        window.alert = function(msg) {
          window.__qa_last_alert = String(msg || '');
          // Despachamos un evento en el objeto window para que el content script lo capture
          window.dispatchEvent(new CustomEvent('__qa_alert_captured', { detail: { message: String(msg || '') } }));
          console.warn('[QA Form Validator Alert Intercepted]:', msg);
        };
      })();
    `;
    // Insertamos el script en el <head> para que se ejecute en el contexto de la página web y luego lo removemos
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    // Escuchamos el evento personalizado disparado por el interceptor
    window.addEventListener('__qa_alert_captured', (e) => {
      lastCapturedAlert = e.detail?.message || null;
    });
  } catch (err) {
    console.warn('Could not inject alert interceptor:', err);
  }

  // -----------------------------------------------------------------------------------------------
  // RASTREO DEL ELEMENTO BAJO EL MENÚ CONTEXTUAL (CLIC DERECHO)
  // Almacena el elemento HTML exacto donde se presionó el botón secundario del mouse para que,
  // si el usuario elige "Probar este campo con QA Validator", sepamos exactamente cuál evaluar.
  // -----------------------------------------------------------------------------------------------
  document.addEventListener('contextmenu', (e) => {
    lastRightClickedElement = e.target;
  }, true);

  // -----------------------------------------------------------------------------------------------
  // CONJUNTO DE TIPOS DE INPUT PERMITIDOS (ALLOWED_INPUT_TYPES)
  // Define estrictamente los tipos de <input> que admiten texto o datos evaluables.
  // Se excluyen botones, checkboxes y radios de la lista de evaluación directa de inyección textual.
  // -----------------------------------------------------------------------------------------------
  const ALLOWED_INPUT_TYPES = new Set([
    'text', 'search', 'email', 'tel', 'url', 'password',
    'number', 'date', 'datetime-local', 'time', 'month', 'week'
  ]);

  // -----------------------------------------------------------------------------------------------
  // FUNCIÓN AUXILIAR: isTestableField(el)
  // ¿QUÉ HACE?
  // Determina si un elemento HTML es un campo de entrada textual válido para auditoría de QA:
  // - Rechaza elementos nulos, deshabilitados (disabled) o de solo lectura (readOnly).
  // - Acepta <textarea>, contenedores con contenteditable="true" e <input> de tipos textuales permitidos.
  // -----------------------------------------------------------------------------------------------
  function isTestableField(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.disabled || el.readOnly) return false;

    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (el.isContentEditable) return true; // Soporta editores enriquecidos como Notion o Medium

    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase().trim();
      return ALLOWED_INPUT_TYPES.has(type);
    }

    return false;
  }

  // -----------------------------------------------------------------------------------------------
  // FUNCIÓN AUXILIAR: isClickableButton(el)
  // ¿QUÉ HACE?
  // Verifica si un elemento HTML califica como botón accionable para guardar o enviar:
  // - Etiquetas <button>.
  // - Etiquetas <input type="submit"> o <input type="button">.
  // - Enlaces <a> con rol de botón (role="button") o clases típicas de botón (ej. .btn, .btn-primary).
  // -----------------------------------------------------------------------------------------------
  function isClickableButton(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'button') return true;
    if (tag === 'input') {
      const type = (el.getAttribute('type') || '').toLowerCase();
      return ['submit', 'button'].includes(type);
    }
    if (tag === 'a' && (el.getAttribute('role') === 'button' || el.className.toLowerCase().includes('btn'))) {
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------------------------------
  // FUNCIÓN AUXILIAR: isElementVisible(el)
  // ¿QUÉ HACE?
  // Comprobación rigurosa de visibilidad en el DOM real:
  // - Verifica que esté conectado al documento (isConnected).
  // - Evalúa si sus dimensiones de renderizado son mayores a cero mediante getBoundingClientRect().
  // - Inspecciona los estilos computados (display !== 'none', visibility !== 'hidden', opacity !== '0').
  // - Recorre hacia arriba hasta 8 niveles de contenedores padres para asegurar que ningún modal,
  //   pestaña o drawer padre esté oculto con atributos 'hidden' o 'aria-hidden="true"'.
  // -----------------------------------------------------------------------------------------------
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (!el.isConnected) return false;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && el.getClientRects().length === 0) {
        return false;
      }
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      // Inspección de contenedores ancestros (hasta 8 niveles para no degradar rendimiento)
      let parent = el.parentElement;
      let depth = 0;
      while (parent && parent !== document.body && depth < 8) {
        if (parent.hasAttribute('hidden') || parent.getAttribute('aria-hidden') === 'true') {
          return false;
        }
        const pStyle = window.getComputedStyle(parent);
        if (pStyle.display === 'none' || pStyle.visibility === 'hidden') {
          return false;
        }
        parent = parent.parentElement;
        depth++;
      }
    } catch {
      return false;
    }
    return true;
  }

  // ============================================================================
  // FUNCIÓN: resolveElementByStep
  // OBJETIVO: Re-localizar un nodo del DOM que fue guardado previamente como
  //           paso para re-abrir un modal o desplegable (ej. botón "Editar").
  // PARÁMETROS:
  //   - step: Objeto con propiedades identificadoras { id, selector, text }.
  // RETORNO: El HTMLElement encontrado en la página actual, o null si no existe.
  // ============================================================================
  function resolveElementByStep(step) {
    // Si no se proporcionó información del paso, no se puede buscar nada
    if (!step) return null;

    // ESTRATEGIA 1: Búsqueda directa por ID único en el documento HTML
    // El ID es el identificador más confiable y rápido en el estándar web
    if (step.id) {
      const byId = document.getElementById(step.id);
      // Priorizar el elemento si se encuentra presente y actualmente visible en pantalla
      if (byId && isElementVisible(byId)) return byId;
      // Si existe pero no está completamente visible aún, devolverlo de todos modos
      if (byId) return byId;
    }

    // ESTRATEGIA 2: Búsqueda mediante selector CSS (clases, atributos o jerarquía)
    if (step.selector) {
      try {
        // querySelector evalúa la regla CSS en todo el árbol del documento
        const bySel = document.querySelector(step.selector);
        // Si coincide y además es visible, es nuestro candidato ideal
        if (bySel && isElementVisible(bySel)) return bySel;
        // Si existe en el DOM aunque esté oculto, retornarlo como respaldo
        if (bySel) return bySel;
      } catch (e) {
        // En caso de selectores CSS inválidos o generados con caracteres no escapados
        console.warn('Step selector resolution error:', e);
      }
    }

    // ESTRATEGIA 3: Búsqueda heurística por texto visible del elemento
    // Muy útil en interfaces donde los selectores o IDs son dinámicos o auto-generados
    if (step.text) {
      // Normalizamos el texto de referencia eliminando espacios en blanco y pasando a minúsculas
      const textTrim = step.text.trim().toLowerCase();

      // 3.1. Alta prioridad: Coincidencia exacta en botones, enlaces o elementos con rol button
      const interactives = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
      const exactBtn = interactives.find(c => {
        // Obtenemos el texto visible, el valor del botón o la etiqueta de accesibilidad aria-label
        const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return cText === textTrim;
      });
      if (exactBtn) return exactBtn;

      // 3.2. Prioridad media: Coincidencia parcial en elementos interactivos (para textos largos o con iconos)
      const partialBtn = interactives.find(c => {
        const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return cText.length < 60 && (cText.includes(textTrim) || textTrim.includes(cText));
      });
      if (partialBtn) return partialBtn;

      // 3.3. Prioridad baja (Respaldo): Buscar en elementos hoja contenedores (spans, divs, filas de tablas)
      // Se descartan aquellos que contienen otros elementos interactivos para evitar clics erróneos
      const genericCandidates = Array.from(document.querySelectorAll('span, div, tr, li, td, .btn'));
      const leafMatch = genericCandidates.find(c => {
        // Si contiene botones o inputs dentro, ignorarlo
        if (c.querySelector('button, a, input, [role="button"]')) return false;
        const cText = (c.innerText || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return (cText === textTrim || (cText.length < 50 && cText.includes(textTrim))) && isElementVisible(c);
      });
      if (leafMatch) return leafMatch;
    }

    // Si ninguna estrategia logró localizar el elemento, retornamos null
    return null;
  }

  // ============================================================================
  // FUNCIÓN: resolveSaveButton
  // OBJETIVO: Localizar con precisión el botón de guardado/envío asociado a un
  //           campo o formulario específico, evitando disparar botones globales.
  // PARÁMETROS:
  //   - btnMeta: Metadatos del botón guardados previamente { id, selector, text }.
  //   - fieldEl: Elemento del campo de prueba actual para delimitar el ámbito (scope).
  // RETORNO: El botón interactivo encontrado, o null.
  // ============================================================================
  function resolveSaveButton(btnMeta, fieldEl) {
    // Si no existen metadatos del botón, no se puede resolver
    if (!btnMeta) return null;

    // 1. Intentar por ID directo en el DOM (los IDs son teóricamente únicos por estándar)
    if (btnMeta.id) {
      const byId = document.getElementById(btnMeta.id);
      if (byId) return byId;
    }

    // 2. Intentar mediante el selector CSS específico generado
    if (btnMeta.selector) {
      try {
        const bySel = document.querySelector(btnMeta.selector);
        if (bySel) return bySel;
      } catch (e) {
        console.warn('Save button selector error:', e);
      }
    }

    // 3. Si falló ID y Selector, buscar por coincidencia de texto ACOTADA AL FORMULARIO del campo
    // Esto previene que se presione un botón "Guardar" de otra sección o de la barra de navegación
    if (btnMeta.text && fieldEl) {
      // Localizamos el contenedor inmediato: <form>, modal, tarjeta o sección
      const fieldForm = fieldEl.form || fieldEl.closest('form, [role="form"], .form-module-card, .modal, .card, .section');
      if (fieldForm) {
        const textTrim = btnMeta.text.trim().toLowerCase();
        // Buscamos candidatos interactivos únicamente dentro de este contenedor delimitado
        const candidates = Array.from(fieldForm.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
        
        // 3.1. Coincidencia exacta de texto dentro del formulario
        const exactInForm = candidates.find(c => {
          const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
          return cText === textTrim && isElementVisible(c);
        });
        if (exactInForm) return exactInForm;

        // 3.2. Coincidencia parcial de texto dentro del formulario
        const partialInForm = candidates.find(c => {
          const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
          return cText.length < 60 && (cText.includes(textTrim) || textTrim.includes(cText)) && isElementVisible(c);
        });
        if (partialInForm) return partialInForm;
      }
    }

    // 4. Respaldo Global por texto: Solo se ejecuta si la búsqueda acotada no tuvo éxito
    if (btnMeta.text) {
      const textTrim = btnMeta.text.trim().toLowerCase();
      const interactives = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
      const exactBtn = interactives.find(c => {
        const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return cText === textTrim && isElementVisible(c);
      });
      if (exactBtn) return exactBtn;
    }

    // No se pudo encontrar el botón de guardado
    return null;
  }


  // ============================================================================
  // FUNCIÓN ASÍNCRONA: executeReopenSequence
  // OBJETIVO: Ejecutar en orden cronológico una secuencia de clics grabados
  //           por el usuario para volver a abrir un formulario colapsable,
  //           acordeón, modal o pestaña que se haya cerrado tras guardar.
  // PARÁMETROS:
  //   - steps: Arreglo de pasos grabados [{ id, selector, text }, ...].
  //   - waitBetweenMs: Tiempo de espera en milisegundos entre cada clic (por defecto 400ms).
  // RETORNO: Booleano true al completar la secuencia.
  // ============================================================================
  async function executeReopenSequence(steps, waitBetweenMs = 400) {
    // Si no es un arreglo válido o está vacío, no hay acciones que simular
    if (!Array.isArray(steps) || steps.length === 0) return true;

    // Iteramos secuencialmente por cada uno de los pasos registrados
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // Localizamos el elemento en el DOM actual
      const el = resolveElementByStep(step);

      if (el) {
        // Desplazamos suavemente la pantalla para centrar el elemento
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}

        // Disparamos la secuencia completa de eventos de ratón (mousedown -> mouseup -> click)
        // Esto garantiza compatibilidad con librerías modernas (React, Angular, Vuetify)
        // que a menudo escuchan mousedown en lugar de únicamente click
        try {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.click();
        } catch (e) {
          console.warn('Error clicking reopen step element:', e);
        }
      } else {
        console.warn('Could not locate element for reopen step:', step);
      }

      // Pausa asíncrona no bloqueante para permitir transiciones CSS y animaciones del DOM
      await new Promise(r => setTimeout(r, waitBetweenMs));
    }
    return true;
  }

  // ============================================================================
  // FUNCIÓN ASÍNCRONA: waitForElementVisible
  // OBJETIVO: Monitorear el DOM mediante sondeo (polling) reactivo hasta que un
  //           campo objetivo esté renderizado y 100% visible tras abrir un modal.
  // PARÁMETROS:
  //   - fieldInfo: Información identificadora del campo objetivo.
  //   - maxWaitMs: Tiempo límite máximo de espera en milisegundos (por defecto 1800ms).
  // RETORNO: El HTMLElement visible, o null si expiró el tiempo límite.
  // ============================================================================
  async function waitForElementVisible(fieldInfo, maxWaitMs = 1800) {
    const start = Date.now(); // Marca de tiempo inicial para control de timeout

    // Bucle de comprobación repetitiva cada 60ms
    while (Date.now() - start < maxWaitMs) {
      try {
        const el = resolveFieldElement(fieldInfo);
        // Si el elemento ya existe y supera todas las pruebas de visibilidad geométrica y CSS
        if (el && isElementVisible(el)) {
          return el; // Devolver de inmediato sin esperar más tiempo
        }
      } catch (err) {
        console.warn('waitForElementVisible check error:', err);
      }
      // Pausa corta antes de la siguiente verificación para no saturar el hilo principal
      await new Promise(r => setTimeout(r, 60));
    }

    // Última comprobación al agotarse el tiempo máximo
    const finalEl = resolveFieldElement(fieldInfo);
    return (finalEl && isElementVisible(finalEl)) ? finalEl : null;
  }

  // ============================================================================
  // FUNCIÓN: getElementLabel
  // OBJETIVO: Extraer el nombre legible y accesible de un campo de formulario,
  //           utilizando los estándares de accesibilidad W3C / WAI-ARIA y HTML5.
  // PARÁMETROS:
  //   - el: Elemento HTML a inspeccionar.
  // RETORNO: Cadena de texto descriptiva con la etiqueta encontrada.
  // ============================================================================
  function getElementLabel(el) {
    if (!el) return '';

    // 1. Etiqueta explícita HTML <label for="id_del_campo">
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.innerText.trim()) return label.innerText.trim();
    }

    // 2. Etiqueta envolvente (el campo está anidado dentro de un <label>...</label>)
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText.trim()) {
      return parentLabel.innerText.trim();
    }

    // 3. Atributo directo de accesibilidad aria-label
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }

    // 4. Atributo aria-labelledby que apunta a los IDs de otros nodos descriptivos
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl && labelEl.innerText.trim()) return labelEl.innerText.trim();
    }

    // 5. Placeholder del campo (texto de ayuda que describe el formato esperado)
    if (el.getAttribute('placeholder')) {
      return `Placeholder: "${el.getAttribute('placeholder').trim()}"`;
    }

    // 6. Atributo técnico 'name' (utilizado comúnmente al enviar peticiones POST/GET)
    if (el.name) return `name="${el.name}"`;

    // 7. Atributo ID del elemento en el DOM
    if (el.id) return `#${el.id}`;

    // 8. Respaldo genérico con el nombre de la etiqueta HTML
    return `<${el.tagName.toLowerCase()}>`;
  }

  // ============================================================================
  // FUNCIÓN: getUniqueSelector
  // OBJETIVO: Construir un selector CSS legible y compacto que permita
  //           re-identificar el elemento unívocamente en la página.
  // PARÁMETROS:
  //   - el: Elemento HTML objetivo.
  // RETORNO: Cadena con el selector CSS (ej. #email, input[name="user"], div.card.active).
  // ============================================================================
  function getUniqueSelector(el) {
    if (!el) return '';

    // Si tiene un identificador ID, es la forma más rápida y única
    if (el.id) return `#${CSS.escape(el.id)}`;

    // Si tiene un atributo name, lo combinamos con la etiqueta
    if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;

    // Respaldo: Etiqueta combinada con sus dos primeras clases CSS
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) path += `.${classes}`;
    }
    return path;
  }

  // ============================================================================
  // FUNCIÓN: isUrlField
  // OBJETIVO: Determinar heurística y semánticamente si un campo representa una
  //           URL, enlace web, repositorio o slug de ruta.
  // PARÁMETROS:
  //   - el: Elemento HTML a evaluar.
  // RETORNO: Booleano true si es un campo de URL/enlace, false en caso contrario.
  // ============================================================================
  function isUrlField(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toLowerCase();
    // Determinamos el tipo de campo
    const type = (el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    
    // Si el tipo nativo de HTML5 es 'url', confirmación inmediata
    if (type === 'url') return true;

    // Recopilamos todas las pistas textuales del campo para análisis de palabras clave
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const label = getElementLabel(el).toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const allText = `${name} ${id} ${placeholder} ${label} ${ariaLabel}`;

    // Expresión regular multilingüe para detectar términos asociados a enlaces web
    return /\b(url|link|enlace|sitio|website|web|endpoint|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(allText);
  }

  // ============================================================================
  // FUNCIÓN: isSlugField
  // OBJETIVO: Identificar si el campo está destinado a un slug de ruta o path
  //           (ej. mi-empresa-2025 o articulos/mi-post).
  // PARÁMETROS:
  //   - el: Elemento HTML a evaluar.
  // RETORNO: Booleano true si corresponde a un slug/ruta.
  // ============================================================================
  function isSlugField(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const label = getElementLabel(el).toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const allText = `${name} ${id} ${placeholder} ${label} ${ariaLabel}`;
    return /\b(slug|ruta|path)\b/i.test(allText);
  }

  // ============================================================================
  // FUNCIÓN: generateSmartDummyValue
  // OBJETIVO: Generar de manera inteligente y contextual datos ficticios (dummy)
  //           que cumplan estrictamente con las reglas de validación del campo
  //           (tipo, patrón regex, longitud mínima, rango numérico, etc.) para
  //           que los campos hermanos obligatorios no bloqueen el guardado.
  // PARÁMETROS:
  //   - el: Elemento HTML del campo para el cual se generará el dato.
  // RETORNO: Cadena de texto con un valor válido sintácticamente.
  // ============================================================================
  function generateSmartDummyValue(el) {
    if (!el) return 'Dato Válido QA';
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    const pattern = el.getAttribute('pattern') || '';
    const minLength = el.minLength >= 0 ? el.minLength : 0;
    const min = el.getAttribute('min');
    const max = el.getAttribute('max');
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const label = getElementLabel(el).toLowerCase();
    const allText = `${name} ${id} ${placeholder} ${label}`;

    // CASO 0: Menú desplegable (<select>)
    // Selecciona la primera opción que tenga valor real y no esté deshabilitada
    if (tag === 'select' && el instanceof HTMLSelectElement) {
      const options = Array.from(el.options || []);
      const validOpt = options.find(opt => opt.value && opt.value.trim() !== '' && !opt.disabled);
      if (validOpt) return validOpt.value;
      if (options.length > 1) return options[1].value;
      if (options.length > 0) return options[0].value;
      return '';
    }

    // CASO 0.1: Campos semánticos de URL / Enlace / Slug (deben ser en minúsculas y válidos)
    if (isUrlField(el)) {
      if (isSlugField(el)) {
        return 'recurso-qa-valido';
      }
      return 'https://qa.ejemplo.com/recurso-valido';
    }

    // CASO 1: Teléfono o regla de 10 dígitos (ej. estándar telefónico mexicano/internacional)
    // Genera un número de 10 dígitos que comience con '55' y 8 dígitos aleatorios
    if (type === 'tel' || /tel[eé]fono|phone|celular|movil|móvil|10\s*d[ií]gito/.test(allText) || /\[0-9\]\{10\}|\\d\{10\}/.test(pattern)) {
      return '55' + Math.floor(10000000 + Math.random() * 90000000); // 10 dígitos válidos
    }

    // CASO 2: Expresiones regulares comunes en el atributo pattern
    if (pattern) {
      if (/\[0-9\]\{8\}|\\d\{8\}/.test(pattern)) return '12345678';
      if (/\[0-9\]\{5\}|\\d\{5\}/.test(pattern)) return '28001';
      if (/\[A-Za-z0-9\]\{5\}/.test(pattern)) return 'AB123';
      if (/\[0-9\]\{4\}|\\d\{4\}/.test(pattern)) return '2025';
    }

    // CASO 3: Correo electrónico (formato estándar RFC 5322 con dominio de prueba)
    if (type === 'email' || /correo|email|e-mail/.test(allText)) {
      return `usuario.qa${Math.floor(100 + Math.random() * 900)}@test.com`;
    }

    // CASO 4: Números (respeta límites min y max si están definidos en HTML5)
    if (type === 'number') {
      let minNum = min !== null && min !== '' ? parseFloat(min) : null;
      let maxNum = max !== null && max !== '' ? parseFloat(max) : null;
      // Si tiene rango acotado, calculamos el punto medio
      if (minNum !== null && maxNum !== null) {
        return String(Math.floor((minNum + maxNum) / 2));
      }
      if (minNum !== null) return String(minNum + 5);
      if (maxNum !== null) return String(Math.max(1, maxNum - 5));
      return '25';
    }

    // CASO 5: Fechas y horas (formato estándar ISO YYYY-MM-DD)
    if (type === 'date' || type === 'datetime-local' || /fecha|date|nacimiento|cita/.test(allText)) {
      return '2025-06-15';
    }

    // CASO 6: Códigos postales o ZIP
    if (/c[oó]digo\s*postal|zip|postal/.test(allText)) {
      return '28001';
    }

    // CASO 7: Contraseñas (cumple mayúsculas, minúsculas, números y símbolos especiales)
    if (type === 'password' || /pass|clave|contrase[ñn]a/.test(allText)) {
      return 'ClaveValida_2025!';
    }

    // CASO 8: Cadenas con requisito de longitud mínima (minLength)
    if (minLength > 0) {
      return 'DatoValido'.padEnd(minLength + 2, 'X');
    }

    // CASO 9: Nombres, apellidos, direcciones y comentarios de texto abierto
    if (/nombre|name|first/.test(allText)) return 'Juan Carlos';
    if (/apellido|last/.test(allText)) return 'Pérez Gómez';
    if (/ciudad|city/.test(allText)) return 'Ciudad de Prueba';
    if (/direccion|address|calle/.test(allText)) return 'Av. Principal 123';
    if (tag === 'textarea' || /comentario|observaci[oó]n|descripci[oó]n/.test(allText)) {
      return 'Observaciones de prueba válidas.';
    }

    // Respaldo genérico estándar
    return 'Dato Válido QA';
  }

  // ============================================================================
  // FUNCIÓN: autoDetectSaveButton
  // OBJETIVO: Descubrir automáticamente el botón de envío o guardado perteneciente
  //           al formulario o sección donde reside el campo de prueba.
  // PARÁMETROS:
  //   - fieldEl: Elemento del campo de prueba para acotar la búsqueda.
  //   - allowHidden: Si es true, permite botones temporalmente ocultos.
  // RETORNO: El botón interactivo encontrado o null.
  // ============================================================================
  function autoDetectSaveButton(fieldEl, allowHidden = false) {
    if (!fieldEl) return null;

    // 1. Inspeccionar si el campo está dentro de un elemento <form> o contenedor con rol 'form'
    const form = fieldEl.form || fieldEl.closest('form, [role="form"]');
    if (form) {
      // 1a. Botones externos enlazados mediante el atributo estándar HTML5 form="id_del_formulario"
      if (form.id) {
        try {
          const linkedSubmit = document.querySelector(`button[form="${CSS.escape(form.id)}"][type="submit"], input[form="${CSS.escape(form.id)}"][type="submit"]`);
          if (linkedSubmit && (allowHidden || isElementVisible(linkedSubmit))) return linkedSubmit;

          const linkedButtons = Array.from(document.querySelectorAll(`button[form="${CSS.escape(form.id)}"], input[form="${CSS.escape(form.id)}"]`));
          for (const btn of linkedButtons) {
            if (!allowHidden && !isElementVisible(btn)) continue;
            const text = (btn.innerText || btn.value || '').toLowerCase();
            if (/guardar|save|enviar|submit|actualizar|update|crear|create|aceptar|confirmar|continuar/.test(text)) {
              return btn;
            }
          }
        } catch (e) {}
      }

      // 1b. Botón explícito type="submit" dentro del formulario
      const explicitSubmit = form.querySelector('button[type="submit"], input[type="submit"]');
      if (explicitSubmit && (allowHidden || isElementVisible(explicitSubmit))) return explicitSubmit;

      // 1c. Búsqueda por palabras clave de acción de guardado en botones internos
      const buttons = Array.from(form.querySelectorAll('button, input[type="button"], a.btn, [role="button"]'));
      for (const btn of buttons) {
        if (!allowHidden && !isElementVisible(btn)) continue;
        const text = (btn.innerText || btn.value || '').toLowerCase();
        if (/guardar|save|enviar|submit|actualizar|update|crear|create|aceptar|confirmar|continuar/.test(text)) {
          return btn;
        }
      }
      // 1d. Cualquier botón interactivo disponible dentro del formulario
      for (const btn of buttons) {
        if (allowHidden || isElementVisible(btn)) return btn;
      }
    }

    // 2. Si no hay <form> estándar, buscar en componentes modales, tarjetas o cajones (drawers)
    const container = fieldEl.closest('.form-module-card, .modal, .dialog, .card, .drawer, .section, fieldset');
    if (container) {
      const explicitSubmit = container.querySelector('button[type="submit"], input[type="submit"]');
      if (explicitSubmit && (allowHidden || isElementVisible(explicitSubmit))) return explicitSubmit;

      const buttons = Array.from(container.querySelectorAll('button, input[type="button"], a.btn, [role="button"]'));
      for (const btn of buttons) {
        if (!allowHidden && !isElementVisible(btn)) continue;
        const text = (btn.innerText || btn.value || '').toLowerCase();
        if (/guardar|save|enviar|submit|actualizar|update|crear|create|aceptar|confirmar|continuar/.test(text)) {
          return btn;
        }
      }
      for (const btn of buttons) {
        if (allowHidden || isElementVisible(btn)) return btn;
      }
    }

    return null;
  }

  // ============================================================================
  // FUNCIÓN: getFormTitle
  // OBJETIVO: Deducir un título descriptivo y legible para un formulario o
  //           contenedor evaluado en la auditoría.
  // PARÁMETROS:
  //   - formEl: Contenedor HTML del formulario.
  //   - index: Número secuencial para respaldo en caso de no hallar título textual.
  // RETORNO: Cadena de texto con el título determinado.
  // ============================================================================
  function getFormTitle(formEl, index = 1) {
    if (!formEl) return `Formulario #${index}`;

    // 1. Etiqueta semántica estándar HTML <legend> (común dentro de <fieldset>)
    const legend = formEl.querySelector('legend');
    if (legend && legend.innerText.trim()) return legend.innerText.trim();

    // 2. Encabezados estructurales internos (h1 a h5 o clases de título)
    const heading = formEl.querySelector('h1, h2, h3, h4, h5, .card-title, .modal-title, .form-title');
    if (heading && heading.innerText.trim()) return heading.innerText.trim();

    // 3. Encabezados inmediatamente precedentes en el DOM (títulos sobre el formulario)
    let prev = formEl.previousElementSibling;
    while (prev) {
      if (/^h[1-6]$/i.test(prev.tagName) && prev.innerText.trim()) {
        return prev.innerText.trim();
      }
      prev = prev.previousElementSibling;
    }

    // 4. Atributo de accesibilidad aria-label en el propio contenedor
    if (formEl.getAttribute('aria-label')) return formEl.getAttribute('aria-label').trim();
    // 5. Atributo ID del contenedor
    if (formEl.id) return `Formulario #${formEl.id}`;
    // 6. Atributo name del formulario
    if (formEl.name) return `Formulario (${formEl.name})`;

    // Respaldo seguro: Evitamos tomar el texto del primer <label>, ya que causaría
    // nombrar erróneamente al formulario con el nombre de un campo individual (ej. "Nombre")
    return `Formulario Principal`;
  }

  // ============================================================================
  // FUNCIÓN: getElementMetadata
  // OBJETIVO: Empaquetar exhaustivamente todos los atributos, restricciones HTML5,
  //           selectores y estados de un campo para enviarlos al panel lateral.
  // PARÁMETROS:
  //   - el: Campo del DOM a serializar.
  //   - allowHidden: Permite detectar botones de guardado aunque estén ocultos.
  // RETORNO: Objeto estructurado con metadatos del campo.
  // ============================================================================
  function getElementMetadata(el, allowHidden = false) {
    const parentForm = el.form || el.closest('form, [role="form"], .modal, .card, .section');
    const formSaveBtn = autoDetectSaveButton(el, allowHidden);
    const formId = parentForm ? (parentForm.id || getUniqueSelector(parentForm)) : 'form_1';
    const formTitle = parentForm ? getFormTitle(parentForm) : 'Formulario Principal';
    const formSelector = parentForm ? getUniqueSelector(parentForm) : null;
    return {
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || (el.tagName.toLowerCase() === 'textarea' ? 'textarea' : 'text')).toLowerCase(),
      isUrlField: isUrlField(el),
      isSlugField: isSlugField(el),
      id: el.id || '',
      name: el.name || '',
      placeholder: el.getAttribute('placeholder') || '',
      label: getElementLabel(el),
      maxLength: el.maxLength >= 0 ? el.maxLength : null,
      minLength: el.minLength >= 0 ? el.minLength : null,
      min: el.getAttribute('min') || null,
      max: el.getAttribute('max') || null,
      step: el.getAttribute('step') || null,
      pattern: el.getAttribute('pattern') || null,
      required: !!el.required || el.getAttribute('aria-required') === 'true',
      suggestedFillerValue: generateSmartDummyValue(el),
      initialValue: el.value !== undefined ? el.value : el.innerText,
      selector: getUniqueSelector(el),
      formId: formId,
      formTitle: formTitle,
      formSelector: formSelector,
      saveButton: formSaveBtn ? getButtonMetadata(formSaveBtn) : null
    };
  }

  // ============================================================================
  // FUNCIÓN: getButtonMetadata
  // OBJETIVO: Empaquetar y resumir las propiedades del botón de guardado/envío
  //           para su transmisión y representación visual en el panel lateral.
  // PARÁMETROS:
  //   - el: Elemento HTML del botón.
  // RETORNO: Objeto con { text, tag, id, type, selector } o null si no se proporcionó.
  // ============================================================================
  function getButtonMetadata(el) {
    if (!el) return null;
    // Extraemos el texto visible, el valor del botón o la etiqueta aria-label
    const text = el.innerText?.trim() || el.value || el.getAttribute('aria-label') || 'Botón';
    return {
      text: text.slice(0, 30), // Acotamos a 30 caracteres para no saturar la interfaz
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      type: el.getAttribute('type') || 'submit',
      selector: getUniqueSelector(el)
    };
  }

  // ============================================================================
  // FUNCIÓN: detectSingleForm
  // OBJETIVO: Descubrir e indexar automáticamente el formulario principal o
  //           el contenedor modal donde se encuentra el usuario en la página.
  // PARÁMETROS:
  //   - baseEl: Elemento opcional de referencia desde el cual iniciar la búsqueda.
  // RETORNO: Objeto estructurado con { title, fields, fieldsCount, saveButton }.
  // ============================================================================
  function detectSingleForm(baseEl) {
    let container = null;
    // Si se pasa un elemento base, buscamos su contenedor ascendente inmediato
    if (baseEl) {
      container = baseEl.form || baseEl.closest('form, [role="form"], .modal, .dialog, .card, .section') || baseEl;
    }

    // Si no hay contenedor o es el body completo, buscamos formularios estructurados en el DOM
    if (!container || container === document.body) {
      const forms = Array.from(document.querySelectorAll('form, [role="form"], .modal, .card, .section'));
      for (const f of forms) {
        // Filtramos para verificar que contenga al menos un campo interactivo auditable
        const inputs = Array.from(f.querySelectorAll('input, textarea, select, [contenteditable]')).filter(isTestableField);
        if (inputs.length > 0) {
          container = f;
          break;
        }
      }
    }

    // Si no se encontró ningún contenedor estructurado, recurrimos al primer <form> o al <body>
    if (!container) {
      container = document.querySelector('form') || document.body;
    }

    // Obtenemos todos los campos interactivos auditables dentro de este contenedor
    const rawInputs = Array.from(container.querySelectorAll('input, textarea, select, [contenteditable]'));
    const testable = rawInputs.filter(isTestableField);
    const title = getFormTitle(container, 1);
    const fields = testable.map(el => getElementMetadata(el, true));
    // Deducimos el botón de guardado local correspondiente a estos campos
    const btn = autoDetectSaveButton(testable[0] || container, true);
    const saveBtnMeta = btn ? getButtonMetadata(btn) : null;

    if (btn) {
      saveButtonElement = btn;
    }

    return {
      title: title,
      fields: fields,
      fieldsCount: fields.length,
      saveButton: saveBtnMeta
    };
  }

  // ============================================================================
  // FUNCIÓN: escapeHtml
  // OBJETIVO: Sanitizar cadenas de texto convirtiendo caracteres especiales
  //           en entidades HTML seguras, previniendo vulnerabilidades XSS al
  //           insertar información en banners, tooltips o reportes.
  // PARÁMETROS:
  //   - str: Cadena de texto a sanitizar.
  // RETORNO: Cadena sanitizada segura para innerHTML.
  // ============================================================================
  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================================
  // FUNCIÓN: createPickerUI
  // OBJETIVO: Crear e inyectar en la página web la interfaz flotante (HUD) del
  //           modo de selección, incluyendo la barra superior de instrucciones
  //           y la etiqueta flotante (tooltip) que sigue al ratón.
  // PARÁMETROS:
  //   - type: Tipo de selección activa ('field', 'button', 'form', 'reopen_step').
  //   - extraLabel: Nombre complementario del elemento para dar contexto al usuario.
  // ============================================================================
  function createPickerUI(type, extraLabel = '') {
    // Si la barra superior flotante aún no existe en el DOM, la creamos
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'qa-picker-banner';
      document.body.appendChild(bannerEl);
    }

    // Iconos vectoriales SVG limpios e incrustados para cada tipo de objetivo
    const icons = {
      button: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
      form: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="11" y2="17"></line></svg>',
      reopen_step: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
      field: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>'
    };

    // Configuramos el contenido visual e instrucciones según el modo actual
    if (type === 'button') {
      const targetTxt = extraLabel ? ` para <strong>${escapeHtml(extraLabel)}</strong>` : '';
      bannerEl.innerHTML = `
        <span>${icons.button}<strong>QA Validator:</strong> Haz clic en el botón de <strong>Guardar / Enviar</strong>${targetTxt}</span>
        <kbd>ESC para cancelar</kbd>
      `;
    } else if (type === 'form') {
      bannerEl.innerHTML = `
        <span>${icons.form}<strong>QA Validator:</strong> Haz clic en el <strong>formulario o sector</strong> que deseas auditar</span>
        <kbd>ESC para cancelar</kbd>
      `;
    } else if (type === 'reopen_step') {
      bannerEl.innerHTML = `
        <span>${icons.reopen_step}<strong>QA Validator:</strong> Haz clic en el elemento que abre el formulario (ej. <strong>Cliente</strong> o <strong>Editar</strong>)</span>
        <kbd>ESC para cancelar</kbd>
      `;
    } else {
      bannerEl.innerHTML = `
        <span>${icons.field}<strong>QA Validator:</strong> Haz clic en un <strong>campo</strong> (o presiona ESC para salir)</span>
        <kbd>ESC para cancelar</kbd>
      `;
    }

    // Si el tooltip interactivo no existe aún, lo creamos
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'qa-picker-tooltip';
      tooltipEl.style.display = 'none';
      document.body.appendChild(tooltipEl);
    }
  }

  // ============================================================================
  // FUNCIÓN: removePickerUI
  // OBJETIVO: Limpiar y destruir del DOM todos los elementos visuales de selección
  //           cuando se cancela o finaliza el modo picker.
  // ============================================================================
  function removePickerUI() {
    if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    if (hoveredElement) {
      hoveredElement.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
      hoveredElement = null;
    }
  }

  // ============================================================================
  // FUNCIÓN: startPicking
  // OBJETIVO: Iniciar el modo de captura interactiva en la página web, activando
  //           los escuchadores de eventos del mouse en fase de captura (capture).
  // PARÁMETROS:
  //   - type: Tipo de objetivo a seleccionar ('field', 'button', 'form', 'reopen_step').
  //   - extraLabel: Contexto adicional para mostrar en las instrucciones del HUD.
  // ============================================================================
  function startPicking(type = 'field', extraLabel = '') {
    // Detener cualquier selección previa activa para evitar estados inconsistentes
    stopPicking();

    // Establecemos la bandera booleana correspondiente al tipo solicitado
    if (type === 'button') {
      isPickingSaveButton = true;
    } else if (type === 'form') {
      isPickingForm = true;
    } else if (type === 'reopen_step') {
      isPickingReopenStep = true;
    } else {
      isPickingField = true;
    }
    // Mostramos la interfaz de usuario en la pantalla
    createPickerUI(type, extraLabel);

    // Registramos los escuchadores globales de eventos en fase de captura (useCapture = true).
    // La fase de captura es fundamental: intercepta el evento antes de que llegue a los
    // manejadores propios de la página web (evitando que el sitio envíe formularios o cambie de página)
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  // ============================================================================
  // FUNCIÓN: stopPicking
  // OBJETIVO: Apagar de forma segura el modo de captura interactiva, desmontando
  //           los escuchadores de eventos y limpiando los elementos visuales del DOM.
  // ============================================================================
  function stopPicking() {
    // Restablecemos todas las banderas de estado a falso
    isPickingField = false;
    isPickingSaveButton = false;
    isPickingForm = false;
    isPickingReopenStep = false;

    // Retiramos los escuchadores globales registrados en fase de captura
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    // Eliminamos la interfaz visual inyectada (banner y tooltip)
    removePickerUI();
  }

  // ============================================================================
  // FUNCIÓN: onMouseOver
  // OBJETIVO: Manejar el evento de movimiento del ratón sobre los elementos de la página,
  //           destacando con un contorno visual aquellos que coincidan con el tipo
  //           de objetivo buscado y mostrando un tooltip con sus datos.
  // PARÁMETROS:
  //   - e: Evento nativo MouseEvent.
  // ============================================================================
  function onMouseOver(e) {
    // Si ningún modo de selección está encendido, salir de inmediato
    if (!isPickingField && !isPickingSaveButton && !isPickingForm && !isPickingReopenStep) return;
    const target = e.target;
    // Ignorar si el puntero se encuentra sobre los propios elementos de nuestra interfaz HUD
    if (target === bannerEl || bannerEl?.contains(target) || target === tooltipEl) return;

    // Si teníamos otro elemento previamente resaltado y ya no es el actual, quitarle el estilo
    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
    }

    // MODO 1: Selección de un paso de reapertura (ej. botón de menú, pestaña, botón 'Editar')
    if (isPickingReopenStep) {
      hoveredElement = target;
      hoveredElement.classList.add('qa-picker-hover-highlight');
      const rawText = target.innerText?.trim() || target.getAttribute('aria-label') || target.value || target.tagName.toLowerCase();
      const text = rawText.split('\n')[0].trim().slice(0, 35) || 'Elemento';

      // Mostramos una tarjeta flotante morada indicando que es un paso de reapertura
      tooltipEl.innerHTML = `
        <span class="qa-badge" style="background:#8b5cf6;">PASO RE-APERTURA</span>
        <span>${text.replace(/[<>&"]/g, '')}</span>
      `;
      tooltipEl.style.display = 'flex';

      // Posicionamiento inteligente del tooltip relativo a las coordenadas del elemento en pantalla
      const rect = target.getBoundingClientRect();
      let top = rect.top - 34;
      if (top < 10) top = rect.bottom + 8; // Si se sale por arriba, mostrarlo abajo
      let left = Math.max(10, rect.left);

      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.left = `${left}px`;
      return;
    }

    // MODO 2: Selección de un formulario o bloque modular completo
    if (isPickingForm) {
      // Localizamos el contenedor de formulario más cercano
      const formTarget = target.closest('form, [role="form"], .modal, .card, .section, fieldset') || (isTestableField(target) ? (target.form || target.closest('form') || target) : target);
      if (formTarget) {
        hoveredElement = formTarget;
        hoveredElement.classList.add('qa-form-hover-highlight');
        // Contabilizamos cuántos campos auditables residen dentro
        const rawInputs = Array.from(formTarget.querySelectorAll('input, textarea, select, [contenteditable]'));
        const testable = rawInputs.filter(isTestableField);
        const title = getFormTitle(formTarget);

        tooltipEl.innerHTML = `
          <span class="qa-badge" style="background:#0ea5e9;">FORMULARIO</span>
          <span><strong>${title.replace(/[<>&"]/g, '')}</strong> (${testable.length} campos)</span>
        `;
        tooltipEl.style.display = 'flex';

        const rect = formTarget.getBoundingClientRect();
        let top = rect.top - 34;
        if (top < 10) top = rect.bottom + 8;
        let left = Math.max(10, rect.left);

        tooltipEl.style.top = `${top}px`;
        tooltipEl.style.left = `${left}px`;
      }
      return;
    }

    // MODO 3 Y 4: Selección de botón de guardado o campo individual de datos
    const isValid = isPickingSaveButton ? isClickableButton(target) : isTestableField(target);

    if (isValid) {
      hoveredElement = target;
      hoveredElement.classList.add('qa-picker-hover-highlight');

      const label = isPickingSaveButton 
        ? (target.innerText?.trim() || target.value || 'Botón')
        : getElementLabel(target);
      const tag = target.tagName.toLowerCase();
      const type = target.getAttribute('type') || tag;

      tooltipEl.innerHTML = `
        <span class="qa-badge">${type}</span>
        <span>${label.slice(0, 40)}</span>
      `;
      tooltipEl.style.display = 'flex';

      const rect = target.getBoundingClientRect();
      let top = rect.top - 34;
      if (top < 10) top = rect.bottom + 8;
      let left = Math.max(10, rect.left);

      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.left = `${left}px`;
    } else {
      // Si el cursor está sobre un nodo no interactivo/inválido, ocultar tooltip y borde
      if (tooltipEl) tooltipEl.style.display = 'none';
      if (hoveredElement) {
        hoveredElement.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
        hoveredElement = null;
      }
    }
  }

  // ============================================================================
  // FUNCIÓN: onMouseOut
  // OBJETIVO: Limpiar el resaltado visual cuando el ratón sale del elemento inspeccionado.
  // PARÁMETROS:
  //   - e: Evento nativo MouseEvent.
  // ============================================================================
  function onMouseOut(e) {
    if (!isPickingField && !isPickingSaveButton && !isPickingForm && !isPickingReopenStep) return;
    if (e.target === hoveredElement) {
      e.target.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
      hoveredElement = null;
      if (tooltipEl) tooltipEl.style.display = 'none';
    }
  }

  // ============================================================================
  // FUNCIÓN: onClick
  // OBJETIVO: Interceptar el clic del usuario en la fase de captura, impidiendo
  //           la navegación o envío por defecto, y capturando el elemento objetivo.
  // PARÁMETROS:
  //   - e: Evento nativo MouseEvent.
  // ============================================================================
  function onClick(e) {
    if (!isPickingField && !isPickingSaveButton && !isPickingForm && !isPickingReopenStep) return;
    const target = e.target;
    // Si el usuario hace clic dentro de la barra superior de instrucciones, no hacer nada
    if (target === bannerEl || bannerEl?.contains(target)) return;

    // PREVENCIÓN CRUCIAL: Detener la acción nativa del navegador y evitar propagación
    e.preventDefault();
    e.stopPropagation();

    // Procesar la selección según el modo actualmente encendido
    if (isPickingReopenStep) {
      selectReopenStep(target);
    } else if (isPickingForm) {
      const formTarget = target.closest('form, [role="form"], .modal, .card, .section, fieldset') || (isTestableField(target) ? (target.form || target.closest('form') || target) : target);
      if (formTarget) {
        selectFormElement(formTarget);
      }
    } else if (isPickingSaveButton && isClickableButton(target)) {
      selectSaveButton(target);
    } else if (isPickingField && isTestableField(target)) {
      selectTargetElement(target);
    }

    // Finalizar el modo picker una vez seleccionado el objetivo
    stopPicking();
  }

  // ============================================================================
  // FUNCIÓN: onKeyDown
  // OBJETIVO: Detectar si el usuario presiona la tecla Escape para cancelar la selección.
  // PARÁMETROS:
  //   - e: Evento nativo KeyboardEvent.
  // ============================================================================
  function onKeyDown(e) {
    if ((isPickingField || isPickingSaveButton || isPickingForm || isPickingReopenStep) && e.key === 'Escape') {
      stopPicking();
      // Notificar al panel lateral que la selección fue abortada por el usuario
      chrome.runtime.sendMessage({ action: 'PICKING_CANCELLED' });
    }
  }

  // ============================================================================
  // FUNCIÓN: selectReopenStep
  // OBJETIVO: Registrar un elemento interactivo como paso de reapertura, emitir
  //           un destello visual verde y enviar sus datos al panel lateral.
  // PARÁMETROS:
  //   - el: Elemento HTML seleccionado.
  // ============================================================================
  function selectReopenStep(el) {
    // Aplicamos una clase CSS temporal con animación de resaltado verde
    el.classList.add('qa-picker-selected-highlight');
    setTimeout(() => el?.classList.remove('qa-picker-selected-highlight'), 1800);

    const rawText = el.innerText?.trim() || el.getAttribute('aria-label') || el.value || el.tagName.toLowerCase();
    const text = rawText.split('\n')[0].trim().slice(0, 35) || 'Elemento';

    const stepData = {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      text: text,
      selector: getUniqueSelector(el)
    };

    // Enviar mensaje al panel lateral con los datos del paso
    chrome.runtime.sendMessage({
      action: 'REOPEN_STEP_PICKED',
      data: stepData
    });
  }

  // ============================================================================
  // FUNCIÓN: selectFormElement
  // OBJETIVO: Registrar un contenedor de formulario completo, escanear todos
  //           sus campos auditables y transmitirlos en lote al panel lateral.
  // PARÁMETROS:
  //   - formEl: Contenedor HTML del formulario seleccionado.
  // ============================================================================
  function selectFormElement(formEl) {
    formEl.classList.add('qa-picker-selected-highlight');
    setTimeout(() => formEl?.classList.remove('qa-picker-selected-highlight'), 1800);

    // Mapear metadatos de todos los campos dentro del formulario
    const rawInputs = Array.from(formEl.querySelectorAll('input, textarea, select, [contenteditable]'));
    const testable = rawInputs.filter(isTestableField);
    const fieldsData = testable.map(el => getElementMetadata(el));
    const autoBtn = autoDetectSaveButton(testable[0] || formEl);

    if (autoBtn) {
      saveButtonElement = autoBtn;
    }

    const formData = {
      id: formEl.id || '',
      title: getFormTitle(formEl),
      selector: getUniqueSelector(formEl),
      fields: fieldsData,
      fieldsCount: fieldsData.length,
      saveButton: autoBtn ? getButtonMetadata(autoBtn) : null
    };

    chrome.runtime.sendMessage({
      action: 'FORM_SELECTED',
      data: formData
    });
  }

  // ============================================================================
  // FUNCIÓN: selectTargetElement
  // OBJETIVO: Registrar un campo individual seleccionado como objetivo de la prueba.
  // PARÁMETROS:
  //   - el: Campo interactivo HTML seleccionado.
  // ============================================================================
  function selectTargetElement(el) {
    if (targetElement) {
      targetElement.classList.remove('qa-picker-selected-highlight');
    }
    targetElement = el;
    targetElement.classList.add('qa-picker-selected-highlight');
    setTimeout(() => targetElement?.classList.remove('qa-picker-selected-highlight'), 1800);

    const metadata = getElementMetadata(targetElement);

    // Intentamos descubrir automáticamente el botón de guardado asociado a este campo
    const autoBtn = autoDetectSaveButton(targetElement);
    if (autoBtn) {
      saveButtonElement = autoBtn;
      metadata.autoSaveButton = getButtonMetadata(autoBtn);
    }

    chrome.runtime.sendMessage({
      action: 'ELEMENT_SELECTED',
      data: metadata
    });
  }

  // ============================================================================
  // FUNCIÓN: selectSaveButton
  // OBJETIVO: Registrar manualmente un botón seleccionado como botón de guardado.
  // PARÁMETROS:
  //   - btnEl: Botón interactivo HTML seleccionado.
  // ============================================================================
  function selectSaveButton(btnEl) {
    saveButtonElement = btnEl;
    saveButtonElement.classList.add('qa-picker-selected-highlight');
    setTimeout(() => saveButtonElement?.classList.remove('qa-picker-selected-highlight'), 1800);

    chrome.runtime.sendMessage({
      action: 'SAVE_BUTTON_SELECTED',
      data: getButtonMetadata(saveButtonElement)
    });
  }

  // ============================================================================
  // FUNCIÓN: findInShadowRoots
  // OBJETIVO: Buscar recursivamente un elemento dentro de árboles Shadow DOM abiertos.
  // PARÁMETROS:
  //   - rootNode: Nodo raíz de inicio (Document o ShadowRoot).
  //   - queryFn: Función predicado que recibe un contexto de búsqueda (Document/ShadowRoot).
  // RETORNO: El HTMLElement encontrado o null.
  // ============================================================================
  function findInShadowRoots(rootNode, queryFn) {
    if (!rootNode) return null;
    try {
      const found = queryFn(rootNode);
      if (found) return found;
    } catch (e) {}

    const allElements = rootNode.querySelectorAll ? rootNode.querySelectorAll('*') : [];
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.shadowRoot) {
        const inShadow = findInShadowRoots(el.shadowRoot, queryFn);
        if (inShadow) return inShadow;
      }
    }
    return null;
  }

  // ============================================================================
  // FUNCIÓN: resolveFieldElement
  // OBJETIVO: Re-localizar un campo en el DOM a partir de sus metadatos guardados,
  //           soportando tanto el documento principal como componentes encapsulados
  //           en árboles Shadow DOM abiertos.
  // PARÁMETROS:
  //   - fieldInfo: Objeto con { id, selector, name }.
  // RETORNO: El HTMLElement localizado o targetElement como respaldo.
  // ============================================================================
  function resolveFieldElement(fieldInfo) {
    if (!fieldInfo) return targetElement;
    // Búsqueda por ID en el árbol principal
    if (fieldInfo.id) {
      const byId = document.getElementById(fieldInfo.id);
      if (byId) return byId;
    }
    // Búsqueda por selector CSS en el árbol principal
    if (fieldInfo.selector) {
      try {
        const bySel = document.querySelector(fieldInfo.selector);
        if (bySel) return bySel;
      } catch (e) {
        console.warn('Selector error:', e);
      }
    }
    // Búsqueda por atributo name en el árbol principal
    if (fieldInfo.name) {
      try {
        const byName = document.querySelector(`[name="${CSS.escape(fieldInfo.name)}"]`);
        if (byName) return byName;
      } catch (e) {}
    }

    // Búsqueda recursiva en componentes con Shadow DOM abierto (SEC2-H17):
    if (fieldInfo.id) {
      const byShadowId = findInShadowRoots(document, root => {
        try {
          return root.querySelector(`#${CSS.escape(fieldInfo.id)}`);
        } catch (e) {
          return null;
        }
      });
      if (byShadowId) return byShadowId;
    }

    if (fieldInfo.selector) {
      const byShadowSel = findInShadowRoots(document, root => {
        try {
          return root.querySelector(fieldInfo.selector);
        } catch (e) {
          return null;
        }
      });
      if (byShadowSel) return byShadowSel;
    }

    if (fieldInfo.name) {
      const byShadowName = findInShadowRoots(document, root => {
        try {
          return root.querySelector(`[name="${CSS.escape(fieldInfo.name)}"]`);
        } catch (e) {
          return null;
        }
      });
      if (byShadowName) return byShadowName;
    }

    // Respaldo
    return targetElement;
  }

  // ============================================================================
  // FUNCIÓN: setFieldValueSafely
  // OBJETIVO: Asignar un valor a cualquier campo (input, textarea, select, contenteditable)
  //           asegurando que los frameworks modernos reactivos (React, Angular, Vue, Svelte)
  //           detecten el cambio en su estado interno (state management / synthetic events).
  // PARÁMETROS:
  //   - el: Elemento HTML a modificar.
  //   - val: Valor que se inyectará en el campo.
  // ============================================================================
  function setFieldValueSafely(el, val) {
    if (!el) return;
    try {
      // CASO 1: Selector desplegable (<select>)
      if (el instanceof HTMLSelectElement) {
        el.value = val;
        // Si el valor asignado no coincide con ningún value interno de los <option>,
        // intentamos buscar una opción cuyo texto visible coincida con 'val'
        if (el.value !== val) {
          const opt = Array.from(el.options).find(o => o.text.trim() === String(val).trim());
          if (opt) el.value = opt.value;
        }
      // CASO 2: Elemento enriquecido editable (contenteditable = "true")
      } else if (el.isContentEditable) {
        el.focus();
        el.innerText = val;
        el.textContent = val;
      // CASO 3: Campos estándar de texto, numéricos o áreas de texto (<input>, <textarea>)
      } else {
        // ENGAÑO VITAL PARA REACT:
        // React rastrea los cambios de los inputs comparando el valor actual con una
        // propiedad interna llamada '_valueTracker'. Si se modifica 'el.value' directamente,
        // React asume que no hubo cambio de usuario y descarta el evento onChange.
        // Al llamar a tracker.setValue(''), forzamos a React a detectar la nueva entrada.
        const tracker = el._valueTracker;
        if (tracker) {
          tracker.setValue('');
        }

        // Accedemos directamente al prototipo nativo del navegador para invocar el setter original,
        // saltándonos cualquier 'override' o getter/setter interceptado por frameworks
        const proto = el instanceof HTMLTextAreaElement 
          ? HTMLTextAreaElement.prototype 
          : (el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLElement.prototype);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
          desc.set.call(el, val);
        } else {
          el.value = val;
        }
      }
    } catch {
      // Respaldo de asignación simple en caso de cualquier excepción
      el.value = val;
    }

    // Disparamos los eventos sintácticos estándar del DOM:
    // 'input': Evento en tiempo real (con 'composed: true' para atravesar Shadow DOM)
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    // 'change': Evento de confirmación de cambio de valor
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ============================================================================
  // FUNCIÓN: getActiveErrors
  // OBJETIVO: Inspeccionar el DOM circundante para recopilar todos los mensajes
  //           de error visuales, clases de advertencia e indicadores de accesibilidad.
  // PARÁMETROS:
  //   - el: Campo del formulario evaluado.
  // RETORNO: Arreglo de cadenas de texto con los mensajes de error activos.
  // ============================================================================
  function getActiveErrors(el) {
    const errorMessages = [];

    // 1. Detección por accesibilidad WAI-ARIA (aria-invalid="true")
    if (el && el.getAttribute('aria-invalid') === 'true') {
      const errId = el.getAttribute('aria-errormessage') || el.getAttribute('aria-describedby');
      if (errId) {
        const errEl = document.getElementById(errId);
        if (errEl && errEl.innerText.trim()) {
          errorMessages.push(errEl.innerText.trim());
        }
      }
      if (errorMessages.length === 0) {
        errorMessages.push('El campo activó aria-invalid="true"');
      }
    }

    // 2. Selectores CSS estándar de mensajes de validación (Bootstrap, Tailwind, Bulma, etc.)
    const scope = el?.form || el?.closest('.form, .modal, [role="dialog"], .card, .section, main');
    const selectors = [
      '[role="alert"]',
      '.invalid-feedback',
      '.error-message',
      '.field-error',
      '.error-text',
      '.alert-danger',
      '.text-danger',
      '.toast-error',
      '.swal2-html-container',
      '.notification.is-danger',
      'div[class*="error"]:not(:empty)'
    ];

    if (scope) {
      for (const sel of selectors) {
        const nodes = scope.querySelectorAll(sel);
        for (const node of nodes) {
          // Solo consideramos errores que estén efectivamente renderizados y visibles (offset > 0)
          if (node.offsetHeight > 0 && node.offsetWidth > 0) {
            const txt = node.innerText?.trim();
            if (txt && txt.length > 2 && !errorMessages.includes(txt)) {
              errorMessages.push(txt);
            }
          }
        }
      }
    } else {
      // Si no hay contenedor de formulario amplio, inspeccionamos el contenedor directo del input
      const parentContainer = el?.closest('.form-group, .form-field, .input-container, .has-error, .is-invalid, fieldset') || el?.parentElement;
      if (parentContainer) {
        for (const sel of selectors) {
          const nodes = parentContainer.querySelectorAll(sel);
          for (const node of nodes) {
            if (node.offsetHeight > 0 && node.offsetWidth > 0) {
              const txt = node.innerText?.trim();
              if (txt && txt.length > 2 && !errorMessages.includes(txt)) {
                errorMessages.push(txt);
              }
            }
          }
        }
      }
    }

    // 3. Verificación de grupos con clase 'has-error'
    const parentGroup = el?.closest('.form-group, .form-field, .input-container, .has-error, .is-invalid');
    if (parentGroup && parentGroup.classList.contains('has-error')) {
      const errSpan = parentGroup.querySelector('.error-text, .help-block, span, p');
      if (errSpan && errSpan.innerText.trim() && !errorMessages.includes(errSpan.innerText.trim())) {
        errorMessages.push(errSpan.innerText.trim());
      }
    }

    return errorMessages;
  }

  // ============================================================================
  // FUNCIÓN: fillMandatoryFormRequirements
  // OBJETIVO: Rellenar automáticamente los campos hermanos obligatorios (required)
  //           del mismo formulario con datos sintácticamente válidos para que la
  //           validación HTML5 no bloquee la prueba sobre el campo objetivo.
  // PARÁMETROS:
  //   - targetEl: Campo que estamos auditando (no se sobreescribe).
  //   - explicitFillers: Valores configurados manualmente por el usuario en el panel.
  // ============================================================================
  function fillMandatoryFormRequirements(targetEl, explicitFillers = []) {
    if (!targetEl) return;

    // 1. Aplicar primero cualquier valor explícito configurado por el usuario
    const filledElements = new Set();
    if (Array.isArray(explicitFillers) && explicitFillers.length > 0) {
      for (const item of explicitFillers) {
        const sibEl = resolveFieldElement(item.fieldInfo);
        if (sibEl && sibEl !== targetEl) {
          setFieldValueSafely(sibEl, item.value);
          filledElements.add(sibEl);
        }
      }
    }

    // 2. Localizar el formulario o contenedor padre del campo
    const parentForm = targetEl.form || targetEl.closest('form, [role="form"], .modal, .card, .section');
    if (!parentForm) return;

    // 3. Inspeccionar todos los controles interactivos dentro del contenedor
    const controls = Array.from(parentForm.querySelectorAll('input, select, textarea'));
    for (const ctrl of controls) {
      // Ignorar el campo bajo prueba, los ya completados, o los que estén deshabilitados/readonly
      if (ctrl === targetEl || filledElements.has(ctrl)) continue;
      if (ctrl.disabled || ctrl.readOnly) continue;

      const tag = ctrl.tagName.toLowerCase();
      const type = (ctrl.getAttribute('type') || '').toLowerCase();
      const isReq = ctrl.required || 
                    ctrl.hasAttribute('required') || 
                    ctrl.getAttribute('aria-required') === 'true' ||
                    ctrl.closest('.form-group, .form-field')?.classList.contains('required');

      // Si es un <select> obligatorio y está vacío, seleccionar una opción válida
      if (tag === 'select' && ctrl instanceof HTMLSelectElement) {
        if (isReq || !ctrl.value || ctrl.value.trim() === '') {
          const val = generateSmartDummyValue(ctrl);
          if (val) {
            ctrl.value = val;
            ctrl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        continue;
      }

      // Si es una casilla de verificación (checkbox) obligatoria, marcarla
      if (type === 'checkbox') {
        if (isReq && !ctrl.checked) {
          ctrl.checked = true;
          ctrl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        continue;
      }

      // Si es un botón de opción (radio button) obligatorio, marcar el primero del grupo
      if (type === 'radio') {
        if (isReq) {
          const groupName = ctrl.name;
          const anyChecked = groupName ? parentForm.querySelector(`input[type="radio"][name="${CSS.escape(groupName)}"]:checked`) : ctrl.checked;
          if (!anyChecked) {
            ctrl.checked = true;
            ctrl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        continue;
      }

      // Si es un campo de texto, número o fecha obligatorio que esté vacío, rellenarlo con dato dummy
      if (isReq) {
        const currVal = ctrl.value !== undefined ? ctrl.value : '';
        if (currVal.trim() === '') {
          const dummyVal = generateSmartDummyValue(ctrl);
          setFieldValueSafely(ctrl, dummyVal);
        }
      }
    }
  }

  // ============================================================================
  // MOTOR DE EJECUCIÓN ASÍNCRONO: runSinglePayload
  // OBJETIVO: Ejecutar una prueba individual inyectando un payload específico en
  //           el campo objetivo, gestionando la apertura de modales, el relleno
  //           de campos hermanos, la captura de errores y el disparo controlado
  //           del botón de guardado sin provocar recargas de página.
  // PARÁMETROS:
  //   - options: Objeto de configuración con:
  //       * fieldInfo: Metadatos del campo a auditar.
  //       * payload: Texto o caracteres maliciosos/límite a inyectar.
  //       * triggerSave: Booleano para simular el guardado tras la inyección.
  //       * submitWaitMs: Milisegundos de espera tras el guardado para evaluar respuestas.
  //       * siblingFillers: Arreglo de valores para campos hermanos obligatorios.
  //       * reopenConfig: Pasos y reglas para re-abrir modales colapsados.
  //       * saveButton: Metadatos del botón de guardado a presionar.
  // RETORNO: Objeto con el resultado detallado de la prueba y métricas de riesgo.
  // ============================================================================
  async function runSinglePayload(options) {
    try {
      const reopenConfig = options.reopenConfig;
      // Re-localizamos el campo objetivo en el árbol actual del DOM
      let el = resolveFieldElement(options.fieldInfo);

      // FASE 0: RE-APERTURA AUTOMÁTICA DEL FORMULARIO / MODAL
      // Si el campo no es visible o si la regla exige reabrir en cada prueba (alwaysReopen)
      const isVis = isElementVisible(el);
      const shouldReopen = !isVis || (reopenConfig && reopenConfig.alwaysReopen === true);
      if (reopenConfig && reopenConfig.enabled && Array.isArray(reopenConfig.steps) && reopenConfig.steps.length > 0) {
        if (shouldReopen) {
          // Ejecutamos la secuencia de clics que reabren el modal
          await executeReopenSequence(reopenConfig.steps, reopenConfig.waitMs || 400);
          // Esperamos asíncronamente a que el campo termine su animación y sea visible
          el = await waitForElementVisible(options.fieldInfo, 1800);
        }
      } else if (!isVis) {
        // Sondeo corto por si el elemento estaba en transición de carga
        el = await waitForElementVisible(options.fieldInfo, 500);
      }

      // Si tras la reapertura el campo sigue inaccesible, abortar con error explicativo
      if (!el || !isElementVisible(el)) {
        return {
          error: 'FORM_CLOSED',
          message: 'El formulario o modal se encuentra cerrado y no se pudo acceder al campo para la prueba.'
        };
      }

      const payload = options.payload !== undefined ? options.payload : '';
      const triggerSave = !!options.triggerSave;
      const submitWaitMs = options.submitWaitMs || 400;
      const siblingFillers = options.siblingFillers || [];

      // FASE 1: PRE-RELLENO DE CAMPOS HERMANOS OBLIGATORIOS
      // Garantiza que otros campos requeridos no impidan probar el campo actual
      fillMandatoryFormRequirements(el, siblingFillers);

      // Reseteamos el interceptor de ventanas de alerta nativas del sitio
      lastCapturedAlert = null;
      // Registramos los errores presentes antes de interactuar con el campo
      const initialErrors = getActiveErrors(el);

      // FASE 2: INYECCIÓN CONTROLADA DEL PAYLOAD EN EL CAMPO OBJETIVO
      try {
        el.focus();
        el.dispatchEvent(new Event('focus', { bubbles: true }));
      } catch (e) {}

      // Limpiamos primero el campo para evitar que valores previos alteren la prueba
      setFieldValueSafely(el, '');
      // Inyectamos el valor de prueba
      setFieldValueSafely(el, payload);
      try {
        // Disparamos blur (pérdida de foco) para activar validaciones 'onBlur'
        el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      } catch (e) {}

      // Pausa técnica para permitir que los scripts de validación del cliente procesen el evento
      await new Promise((r) => setTimeout(r, 60));

      // Extraemos el valor resultante que el campo efectivamente conservó (detecta truncamientos)
      const resultingValue = el.value !== undefined ? el.value : (el.isContentEditable ? (el.innerText || el.textContent || '') : '');
      const resultingLength = resultingValue.length;
      const payloadLength = payload.length;

      // Evaluamos el estado nativo de validación de HTML5 (Constraint Validation API)
      const validityState = el.validity ? {
        valid: el.validity.valid,
        badInput: el.validity.badInput,
        customError: el.validity.customError,
        patternMismatch: el.validity.patternMismatch,
        rangeOverflow: el.validity.rangeOverflow,
        rangeUnderflow: el.validity.rangeUnderflow,
        stepMismatch: el.validity.stepMismatch,
        tooLong: el.validity.tooLong,
        tooShort: el.validity.tooShort,
        typeMismatch: el.validity.typeMismatch,
        valueMissing: el.validity.valueMissing
      } : null;

      const validationMsg = el.validationMessage || '';
      const postInputErrors = getActiveErrors(el);

      // FASE 3: DISPARO CONTROLADO DE LA ACCIÓN DE GUARDAR / ENVIAR
      let saveAttempted = false;
      let saveBlocked = false;
      let postSubmitErrors = [];
      let saveErrorMessage = '';

      if (triggerSave) {
        saveAttempted = true;
        lastCapturedAlert = null;

        // Determinamos con exactitud qué botón presionar
        let btnToClick = null;

        // 3.1. Botón explícito configurado por el usuario para este formulario
        const targetBtnMeta = options.saveButton || options.fieldInfo?.saveButton;
        if (targetBtnMeta) {
          const resolvedBtn = resolveSaveButton(targetBtnMeta, el);
          if (resolvedBtn && isElementVisible(resolvedBtn)) {
            btnToClick = resolvedBtn;
          }
        }

        // 3.2. Botón global guardado en memoria
        if (!btnToClick && saveButtonElement && isElementVisible(saveButtonElement)) {
          btnToClick = saveButtonElement;
        }

        // 3.3. Detección heurística automática de proximidad
        if (!btnToClick) {
          const localBtn = autoDetectSaveButton(el, true);
          if (localBtn && isElementVisible(localBtn)) {
            btnToClick = localBtn;
          }
        }

        // PREVENCIÓN CRÍTICA DE RECARGA DE PÁGINA:
        // Instalamos un interceptor temporal en fase de captura del evento 'submit'.
        // Si el formulario intentara realizar una recarga completa del navegador,
        // preventDefault() anulará la navegación, manteniendo la extensión y el test en curso.
        const activeForm = el.form || (btnToClick ? btnToClick.closest('form') : null);
        const preventDefaultNavigation = (e) => {
          e.preventDefault();
        };

        if (activeForm) {
          activeForm.addEventListener('submit', preventDefaultNavigation, { capture: true });
        }
        window.addEventListener('submit', preventDefaultNavigation, { capture: true });

        // Simulación del clic de envío
        try {
          if (btnToClick && typeof btnToClick.click === 'function') {
            btnToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            btnToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            btnToClick.click();
          } else if (activeForm) {
            // Envío programático del formulario respetando validaciones
            if (typeof activeForm.requestSubmit === 'function') {
              activeForm.requestSubmit();
            } else {
              activeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          } else {
            // Simular pulsación de la tecla Enter en el input
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
        } catch (submitErr) {
          console.warn('Click on save button threw error:', submitErr);
        }

        // Espera asíncrona para dar tiempo a que el servidor o frontend responda
        await new Promise((r) => setTimeout(r, submitWaitMs));

        // Desinstalamos inmediatamente el interceptor de navegación
        if (activeForm) {
          activeForm.removeEventListener('submit', preventDefaultNavigation, { capture: true });
        }
        window.removeEventListener('submit', preventDefaultNavigation, { capture: true });

        // Evaluamos si surgieron nuevos mensajes de error tras presionar Guardar
        postSubmitErrors = getActiveErrors(el);
        const newErrors = postSubmitErrors.filter(err => !initialErrors.includes(err));

        // Determinamos si el guardado fue bloqueado por validaciones
        if (lastCapturedAlert) {
          saveBlocked = true;
          saveErrorMessage = `Alerta del sitio (alert): "${lastCapturedAlert}"`;
        } else if (newErrors.length > 0) {
          saveBlocked = true;
          saveErrorMessage = newErrors.join(' | ');
        } else if (el.validity && !el.validity.valid) {
          saveBlocked = true;
          saveErrorMessage = el.validationMessage || 'Validación HTML5 impidió el guardado';
        } else if (el.form && typeof el.form.checkValidity === 'function' && !el.form.checkValidity()) {
          saveBlocked = true;
          saveErrorMessage = 'El formulario indicó estado inválido al guardar';
        }
      }

      // FASE 4: CONSTRUCCIÓN DEL REPORTE DETALLADO DE RESULTADOS
      return {
        success: true,
        resultingValue,
        resultingLength,
        payloadLength,
        validity: validityState,
        validationMessage: validationMsg,
        postInputErrors,
        saveAttempted,
        saveBlocked,
        saveErrorMessage,
        capturedAlert: lastCapturedAlert
      };
    } catch (err) {
      console.error('Fatal execution error in runSinglePayload:', err);
      return {
        success: false,
        error: 'PAYLOAD_EXECUTION_ERROR',
        message: err?.message || String(err),
        resultingValue: '',
        resultingLength: 0,
        payloadLength: 0,
        saveAttempted: false,
        saveBlocked: false,
        saveErrorMessage: `Excepción en la ejecución: ${err?.message || err}`
      };
    }
  }

  // ============================================================================
  // FUNCIÓN: restoreValue
  // OBJETIVO: Restaurar el valor inicial original que tenía el campo antes de
  //           comenzar la batería de pruebas, devolviendo el sitio a su estado normal.
  // PARÁMETROS:
  //   - fieldInfo: Metadatos del campo.
  //   - initialValue: Valor previo capturado al inicio.
  // ============================================================================
  function restoreValue(fieldInfo, initialValue) {
    const el = resolveFieldElement(fieldInfo);
    if (!el) return;
    setFieldValueSafely(el, initialValue);
  }

  // ============================================================================
  // ENRUTADOR DE COMUNICACIÓN INTER-PROCESOS (IPC): chrome.runtime.onMessage
  // OBJETIVO: Escuchar y responder a las peticiones enviadas desde el panel
  //           lateral (sidepanel) o el service-worker en segundo plano.
  // PARÁMETROS:
  //   - message: Carga útil con la instrucción { action, ...datos }.
  //   - sender: Información del emisor del mensaje en la extensión.
  //   - sendResponse: Función callback para enviar una respuesta de vuelta.
  // RETORNO: Booleano true si la respuesta se enviará de forma asíncrona,
  //          o false si la respuesta es sincrónica/inmediata.
  // ============================================================================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ACCIÓN: PING
    // Verifica si el script de contenido (picker.js) ya fue inyectado y está listo en la pestaña
    if (message.action === 'PING') {
      sendResponse({ status: 'PONG' });
      return false; // Respuesta sincrónica inmediata
    }

    // ACCIÓN: START_PICKING
    // Enciende el HUD interactivo para que el usuario seleccione un campo individual
    if (message.action === 'START_PICKING') {
      startPicking('field');
      sendResponse({ status: 'PICKING_STARTED' });
      return false;
    }

    // ACCIÓN: START_PICKING_BUTTON
    // Enciende el HUD interactivo para que el usuario señale el botón de Guardar
    if (message.action === 'START_PICKING_BUTTON') {
      startPicking('button', message.formTitle || '');
      sendResponse({ status: 'BUTTON_PICKING_STARTED' });
      return false;
    }

    // ACCIÓN: START_PICKING_FORM
    // Enciende el HUD interactivo para seleccionar un bloque o formulario completo
    if (message.action === 'START_PICKING_FORM') {
      startPicking('form');
      sendResponse({ status: 'FORM_PICKING_STARTED' });
      return false;
    }

    // ACCIÓN: START_PICKING_REOPEN_STEP
    // Enciende el HUD interactivo para grabar un paso de reapertura de modales
    if (message.action === 'START_PICKING_REOPEN_STEP') {
      startPicking('reopen_step');
      sendResponse({ status: 'REOPEN_STEP_PICKING_STARTED' });
      return false;
    }

    // ACCIÓN: EXECUTE_REOPEN_STEPS
    // Ejecuta de forma asíncrona la secuencia de clics grabados para abrir un modal
    if (message.action === 'EXECUTE_REOPEN_STEPS') {
      executeReopenSequence(message.steps || [], message.waitMs || 400)
        .then(() => {
          sendResponse({ status: 'REOPEN_EXECUTED' });
        })
        .catch((err) => {
          console.error('executeReopenSequence error:', err);
          sendResponse({ status: 'REOPEN_ERROR', error: err?.message || String(err) });
        });
      return true; // Obligatorio 'true' para mantener el canal abierto asíncronamente
    }

    // ACCIÓN: CANCEL_PICKING
    // Apaga el modo interactivo de selección y desmonta el banner
    if (message.action === 'CANCEL_PICKING') {
      stopPicking();
      sendResponse({ status: 'PICKING_STOPPED' });
      return false;
    }

    // ACCIÓN: DETECT_ALL_PAGE_FORMS / DETECT_SINGLE_FORM
    // Descubre automáticamente el formulario activo y mapea todos sus campos y botón
    if (message.action === 'DETECT_ALL_PAGE_FORMS' || message.action === 'DETECT_SINGLE_FORM' || message.action === 'DETECT_ALL_FORM_FIELDS') {
      try {
        const formData = detectSingleForm(targetElement);
        sendResponse({
          success: true,
          title: formData.title,
          fields: formData.fields,
          fieldsCount: formData.fieldsCount,
          saveButton: formData.saveButton
        });
      } catch (err) {
        console.error('DETECT_SINGLE_FORM error:', err);
        sendResponse({ success: false, fields: [], error: err?.message });
      }
      return false;
    }

    // ACCIÓN: AUTO_DETECT_SAVE_BUTTON
    // Búsqueda heurística automática del botón de guardado en el DOM
    if (message.action === 'AUTO_DETECT_SAVE_BUTTON') {
      try {
        const btn = autoDetectSaveButton(targetElement);
        if (btn) {
          saveButtonElement = btn;
          sendResponse({ found: true, button: getButtonMetadata(btn) });
        } else {
          sendResponse({ found: false });
        }
      } catch (err) {
        sendResponse({ found: false, error: err?.message });
      }
      return false;
    }

    // ACCIÓN: FILL_SIBLING_FIELDS
    // Rellena un lote de campos hermanos con valores dados
    if (message.action === 'FILL_SIBLING_FIELDS') {
      try {
        const fields = message.fields || [];
        fields.forEach(item => {
          const el = resolveFieldElement(item.fieldInfo);
          if (el) setFieldValueSafely(el, item.value);
        });
        sendResponse({ status: 'FIELDS_FILLED' });
      } catch (err) {
        sendResponse({ status: 'ERROR', error: err?.message });
      }
      return false;
    }

    // ACCIÓN: GENERATE_NEW_DUMMY
    // Genera un nuevo dato ficticio válido para un campo específico
    if (message.action === 'GENERATE_NEW_DUMMY') {
      try {
        const el = resolveFieldElement(message.fieldInfo);
        const val = generateSmartDummyValue(el);
        sendResponse({ value: val });
      } catch (err) {
        sendResponse({ value: 'Dato Válido QA' });
      }
      return false;
    }

    // ACCIÓN: SELECT_CONTEXT_TARGET
    // Selecciona como objetivo el campo sobre el cual se hizo clic derecho
    if (message.action === 'SELECT_CONTEXT_TARGET') {
      try {
        if (lastRightClickedElement && isTestableField(lastRightClickedElement)) {
          selectTargetElement(lastRightClickedElement);
          sendResponse({ status: 'TARGET_SELECTED' });
        } else {
          sendResponse({ status: 'NO_VALID_TARGET' });
        }
      } catch (err) {
        sendResponse({ status: 'ERROR', error: err?.message });
      }
      return false;
    }

    // ACCIÓN: RUN_SINGLE_PAYLOAD
    // Inyecta un caso de prueba individual y evalúa la respuesta del sistema
    if (message.action === 'RUN_SINGLE_PAYLOAD') {
      try {
        runSinglePayload(message)
          .then((result) => {
            try {
              sendResponse(result || { success: false, error: 'NO_RESPONSE' });
            } catch (rErr) {
              console.warn('sendResponse failed:', rErr);
            }
          })
          .catch((err) => {
            console.error('runSinglePayload promise rejected:', err);
            try {
              sendResponse({
                success: false,
                error: 'PAYLOAD_PROMISE_REJECTED',
                message: err?.message || String(err)
              });
            } catch (rErr) {}
          });
      } catch (syncErr) {
        console.error('runSinglePayload sync error:', syncErr);
        sendResponse({
          success: false,
          error: 'PAYLOAD_SYNC_ERROR',
          message: syncErr?.message || String(syncErr)
        });
        return false;
      }
      return true; // Mantener canal abierto para respuesta asíncrona Promise
    }

    // ACCIÓN: RESTORE_INITIAL_VALUE
    // Devuelve el campo a su valor original de antes de iniciar los tests
    if (message.action === 'RESTORE_INITIAL_VALUE') {
      restoreValue(message.fieldInfo, message.value || '');
      sendResponse({ status: 'RESTORED' });
      return false;
    }

    // ACCIÓN: HIGHLIGHT_TARGET
    // Produce un parpadeo visual verde sobre el campo objetivo para ubicarlo visualmente
    if (message.action === 'HIGHLIGHT_TARGET') {
      const el = resolveFieldElement(message.fieldInfo);
      if (el) {
        el.classList.add('qa-picker-selected-highlight');
        setTimeout(() => el?.classList.remove('qa-picker-selected-highlight'), 1200);
      }
      sendResponse({ status: 'HIGHLIGHTED' });
      return false;
    }

    // ACCIÓN: HIGHLIGHT_SAVE_BUTTON
    // Desplaza la vista suavemente hasta el botón de guardado y emite un destello verde
    if (message.action === 'HIGHLIGHT_SAVE_BUTTON') {
      let btn = null;
      if (message.saveButtonInfo) {
        btn = resolveFieldElement(message.saveButtonInfo) || resolveElementByStep(message.saveButtonInfo);
      }
      if (!btn && saveButtonElement) {
        btn = saveButtonElement;
      }
      if (btn) {
        try {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
        btn.classList.add('qa-picker-selected-highlight');
        setTimeout(() => btn?.classList.remove('qa-picker-selected-highlight'), 1400);
      }
      sendResponse({ status: 'HIGHLIGHTED' });
      return false;
    }

    return false;
  });
})();
