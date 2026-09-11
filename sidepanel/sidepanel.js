// QA Form Field Validator - Side Panel Controller
// Compatible with Microsoft Edge, Brave, and Google Chrome
// Supports Multi-Field Testing, Auto-Form Detection, Dual-Phase Save Auditing, and Notion Export

document.addEventListener('DOMContentLoaded', async () => {
  // State
  let selectedFields = [];
  let currentSaveButton = null;
  let activeTabId = null;
  let isPickingFieldActive = false;
  let isPickingButtonActive = false;
  let isPickingFormActive = false;
  let isPickingReopenStepActive = false;
  let detectedPageForms = [];
  let reopenSteps = [];
  let currentCategory = 'all';
  let activeFilter = 'all';
  let activeFieldFilter = 'all';
  let customPayloads = [];
  let testResults = [];
  let currentDepthTier = 'normal';
  let activePickingFormId = null;

  const TIER_HIERARCHY = {
    simple: 1,
    normal: 2,
    advanced: 3,
    total: 4
  };

  const TIER_DESCRIPTIONS = {
    simple: 'Simple (~13 pruebas rápidas)',
    normal: 'Normal (~29 pruebas estándar)',
    advanced: 'Avanzado (~43 pruebas de calidad)',
    total: 'Total (~51 pruebas exhaustivas)'
  };

  // Default Test Suites with Depth Tiers (simple, normal, advanced, total)
  const defaultSuites = [
    // TEXTO Y LONGITUD
    {
      id: 'txt_normal',
      category: 'text',
      tier: 'simple',
      name: 'Texto común',
      payload: 'Prueba de validación QA',
      desc: 'Texto alfabético estándar',
      isInvalidCase: false
    },
    {
      id: 'txt_spaces',
      category: 'text',
      tier: 'normal',
      name: 'Espacios alrededor',
      payload: '   Texto con espacios al inicio y final   ',
      desc: 'Verificar trim / recorte de espacios en blanco',
      isInvalidCase: false
    },
    {
      id: 'txt_only_spaces',
      category: 'text',
      tier: 'normal',
      name: 'Solo espacios en blanco',
      payload: '       ',
      desc: 'Comprobar si permite campos vacíos mediante espacios',
      isInvalidCase: true
    },
    {
      id: 'txt_zero_width',
      category: 'text',
      tier: 'advanced',
      name: 'Espacios de ancho cero (Zero-width)',
      payload: 'Texto\u200Bcon\u200Cespa\u200Dcios\uFEFFocultos',
      desc: 'Caracteres invisibles Unicode que alteran validaciones',
      isInvalidCase: true
    },
    {
      id: 'txt_15_digits',
      category: 'text',
      tier: 'normal',
      name: 'Cadena de 15 dígitos (ej. Tel/ID)',
      payload: '123456789012345',
      desc: '15 dígitos continuos para probar límites de teléfonos/identificaciones',
      isInvalidCase: true
    },
    {
      id: 'txt_50',
      category: 'text',
      tier: 'simple',
      name: 'Longitud moderada (50 chars)',
      payload: 'A'.repeat(50),
      desc: '50 caracteres exactos',
      isInvalidCase: false
    },
    {
      id: 'txt_255',
      category: 'text',
      tier: 'normal',
      name: 'Límite estándar DB (255 chars)',
      payload: 'B'.repeat(255),
      desc: '255 caracteres exactos (límite común de VARCHAR)',
      isInvalidCase: false
    },
    {
      id: 'txt_1000',
      category: 'text',
      tier: 'advanced',
      name: 'Texto extenso (1,000 chars)',
      payload: 'C'.repeat(1000),
      desc: 'Cadena de 1,000 caracteres para prueba de desbordamiento',
      isInvalidCase: true
    },
    {
      id: 'txt_5000',
      category: 'text',
      tier: 'total',
      name: 'Sobrecarga de texto (5,000 chars)',
      payload: 'D'.repeat(5000),
      desc: 'Sobrecarga extrema para evaluar límite o lag de UI',
      isInvalidCase: true
    },
    {
      id: 'txt_multiline',
      category: 'text',
      tier: 'advanced',
      name: 'Saltos de línea y tabuladores',
      payload: 'Línea 1\nLínea 2\r\nLínea 3\tTab',
      desc: 'Caracteres de control multilínea',
      isInvalidCase: false
    },

    // UNICODE & SÍMBOLOS
    {
      id: 'emo_standard',
      category: 'emoji',
      tier: 'simple',
      name: 'Emojis comunes (4 bytes UTF-8)',
      payload: '😀 🎉 🔥 🚀',
      desc: 'Validar soporte UTF8mb4 en base de datos',
      isInvalidCase: false
    },
    {
      id: 'emo_compound',
      category: 'emoji',
      tier: 'advanced',
      name: 'Emoji compuesto con ZWJ',
      payload: '👩‍👩‍👦‍👦 👨‍💻',
      desc: 'Secuencias compuestas (Zero-Width Joiner)',
      isInvalidCase: false
    },
    {
      id: 'emo_flags',
      category: 'emoji',
      tier: 'advanced',
      name: 'Banderas regionales',
      payload: '🇪🇸 🇲🇽 🇨🇱 🇦🇷 🇺🇸',
      desc: 'Unicode Regional Indicator Symbols',
      isInvalidCase: false
    },
    {
      id: 'sym_specials',
      category: 'emoji',
      tier: 'normal',
      name: 'Caracteres especiales de teclado',
      payload: '!@#$%^&*()_+-=[]{}|;:\'",./<>?~`',
      desc: 'Símbolos tipográficos y de puntuación',
      isInvalidCase: false
    },
    {
      id: 'sym_quotes',
      category: 'emoji',
      tier: 'advanced',
      name: 'Comillas y apóstrofes variados',
      payload: '\' " ` ‘ ’ “ ” « »',
      desc: 'Comillas rectas, curvas y tipográficas',
      isInvalidCase: false
    },
    {
      id: 'uni_accents',
      category: 'emoji',
      tier: 'simple',
      name: 'Acentos y diacríticos (Español)',
      payload: 'áéíóú ÁÉÍÓÚ ñ Ñ ü Ü ç Ç',
      desc: 'Caracteres lingüísticos válidos en español',
      isInvalidCase: false
    },
    {
      id: 'uni_foreign',
      category: 'emoji',
      tier: 'total',
      name: 'Alfabetos Cirílico y CJK',
      payload: 'Привет мир / 測試 / こんにちは',
      desc: 'Caracteres internacionales no latinos',
      isInvalidCase: false
    },
    {
      id: 'uni_rtl',
      category: 'emoji',
      tier: 'total',
      name: 'Texto bidireccional / RTL',
      payload: 'مرحبا بالعالم - שלום',
      desc: 'Árabe y Hebreo (direccionalidad derecha a izquierda)',
      isInvalidCase: false
    },

    // NÚMEROS
    {
      id: 'num_positive',
      category: 'number',
      tier: 'simple',
      name: 'Entero positivo',
      payload: '42',
      desc: 'Número entero estándar',
      isInvalidCase: false
    },
    {
      id: 'num_zero',
      category: 'number',
      tier: 'simple',
      name: 'Cero (0)',
      payload: '0',
      desc: 'Valor cero exacto',
      isInvalidCase: false
    },
    {
      id: 'num_negative',
      category: 'number',
      tier: 'normal',
      name: 'Número negativo',
      payload: '-50',
      desc: 'Valor con signo negativo',
      isInvalidCase: true
    },
    {
      id: 'num_decimal',
      category: 'number',
      tier: 'normal',
      name: 'Decimal estándar',
      payload: '99.99',
      desc: 'Número con punto decimal',
      isInvalidCase: false
    },
    {
      id: 'num_scientific',
      category: 'number',
      tier: 'advanced',
      name: 'Notación científica',
      payload: '1e5',
      desc: 'Formato exponencial (100,000)',
      isInvalidCase: true
    },
    {
      id: 'num_overflow',
      category: 'number',
      tier: 'advanced',
      name: 'Desbordamiento numérico',
      payload: '99999999999999999999',
      desc: 'Número que supera límites de enteros de 32/64 bits',
      isInvalidCase: true
    },
    {
      id: 'num_non_numeric',
      category: 'number',
      tier: 'simple',
      name: 'Texto en campo numérico',
      payload: 'abcDEF',
      desc: 'Letras donde solo se esperan dígitos',
      isInvalidCase: true
    },
    {
      id: 'num_symbols',
      category: 'number',
      tier: 'normal',
      name: 'Símbolos en campo numérico',
      payload: '+ - . , $ € %',
      desc: 'Signos de puntuación o divisas',
      isInvalidCase: true
    },
    {
      id: 'num_leading_zeros',
      category: 'number',
      tier: 'total',
      name: 'Ceros a la izquierda',
      payload: '00075',
      desc: 'Número con ceros precedentes',
      isInvalidCase: false
    },

    // FECHAS
    {
      id: 'date_valid',
      category: 'date',
      tier: 'simple',
      name: 'Fecha ISO válida',
      payload: '2024-05-15',
      desc: 'Formato estándar AAAA-MM-DD',
      isInvalidCase: false
    },
    {
      id: 'date_leap_valid',
      category: 'date',
      tier: 'normal',
      name: '29 de Febrero (Año bisiesto 2024)',
      payload: '2024-02-29',
      desc: 'Día bisiesto en año bisiesto válido',
      isInvalidCase: false
    },
    {
      id: 'date_leap_invalid',
      category: 'date',
      tier: 'advanced',
      name: '29 de Febrero (No bisiesto 2023)',
      payload: '2023-02-29',
      desc: 'Fecha imposible en el calendario gregoriano',
      isInvalidCase: true
    },
    {
      id: 'date_day_32',
      category: 'date',
      tier: 'normal',
      name: 'Día 32 inexistente',
      payload: '2024-01-32',
      desc: 'Día fuera de rango calendario',
      isInvalidCase: true
    },
    {
      id: 'date_month_13',
      category: 'date',
      tier: 'normal',
      name: 'Mes 13 inexistente',
      payload: '2024-13-10',
      desc: 'Mes superior a 12',
      isInvalidCase: true
    },
    {
      id: 'date_boundary_past',
      category: 'date',
      tier: 'total',
      name: 'Fecha límite pasada (1899-12-31)',
      payload: '1899-12-31',
      desc: 'Fecha histórica extrema',
      isInvalidCase: true
    },
    {
      id: 'date_boundary_future',
      category: 'date',
      tier: 'total',
      name: 'Fecha límite futura (2099-12-31)',
      payload: '2099-12-31',
      desc: 'Fecha a muy largo plazo',
      isInvalidCase: true
    },
    {
      id: 'date_reversed',
      category: 'date',
      tier: 'advanced',
      name: 'Formato invertido (31/12/2024)',
      payload: '31/12/2024',
      desc: 'Formato DD/MM/AAAA común en habla hispana',
      isInvalidCase: false
    },
    {
      id: 'date_free_text',
      category: 'date',
      tier: 'simple',
      name: 'Texto libre en campo de fecha',
      payload: 'ayer por la tarde',
      desc: 'Cadena arbitraria en selector de fecha',
      isInvalidCase: true
    },

    // SEGURIDAD E INYECCIÓN
    {
      id: 'sec_script',
      category: 'security',
      tier: 'simple',
      name: 'Etiqueta <script> (XSS básico)',
      payload: '<script>alert("XSS")</script>',
      desc: 'Intento de inyección de script ejecutable',
      isInvalidCase: true
    },
    {
      id: 'sec_img_onerror',
      category: 'security',
      tier: 'normal',
      name: 'Etiqueta <img> con onerror (XSS)',
      payload: '<img src="x" onerror="alert(1)">',
      desc: 'Vector XSS por manejo de errores en atributos',
      isInvalidCase: true
    },
    {
      id: 'sec_html_tags',
      category: 'security',
      tier: 'advanced',
      name: 'Etiquetas HTML de formato (<b>, <h1>)',
      payload: '<b>Texto en Negrita</b> <h1>Título</h1>',
      desc: 'Inyección de marcado enriquecido',
      isInvalidCase: true
    },
    {
      id: 'sec_sql_basic',
      category: 'security',
      tier: 'normal',
      name: 'Patrón SQL Injection básico',
      payload: '\' OR \'1\'=\'1\' --',
      desc: 'Bypass clásico de autenticación o consulta',
      isInvalidCase: true
    },
    {
      id: 'sec_null_byte',
      category: 'security',
      tier: 'total',
      name: 'Null byte (%00)',
      payload: 'archivo.pdf\u0000.exe',
      desc: 'Inyección de terminador de cadena en C/sistemas operativos',
      isInvalidCase: true
    },
    // PRUEBAS DE URL Y ENLACES
    {
      id: 'url_valid_https',
      category: 'url',
      tier: 'simple',
      name: 'URL HTTPS válida estándar',
      payload: 'https://qa.ejemplo.com/recurso-valido',
      desc: 'Formato canónico completo con esquema seguro, host y ruta',
      isInvalidCase: false
    },
    {
      id: 'url_missing_scheme',
      category: 'url',
      tier: 'simple',
      name: 'URL sin protocolo (falta https://)',
      payload: 'www.ejemplo.com/recurso',
      desc: 'Verificar si el sistema auto-completa o rechaza URLs sin protocolo',
      isInvalidCase: true
    },
    {
      id: 'url_xss_javascript',
      category: 'url',
      tier: 'simple',
      name: 'Esquema peligroso javascript: (XSS)',
      payload: 'javascript:alert("XSS")',
      desc: 'Inyección de pseudoprotocolo para ejecución de script en enlaces',
      isInvalidCase: true
    },
    {
      id: 'url_valid_query',
      category: 'url',
      tier: 'normal',
      name: 'URL con query parameters y puerto',
      payload: 'https://api.ejemplo.com:8080/v1/items?id=123&status=ok',
      desc: 'Estructura URL avanzada con puerto explícito y parámetros GET',
      isInvalidCase: false
    },
    {
      id: 'url_unencoded_spaces',
      category: 'url',
      tier: 'normal',
      name: 'URL con espacios no codificados',
      payload: 'https://ejemplo.com/ruta con espacios',
      desc: 'Violación RFC 3986 por falta de percent-encoding (%20)',
      isInvalidCase: true
    },
    {
      id: 'url_invalid_domain',
      category: 'url',
      tier: 'normal',
      name: 'Dominio/Host malformado con puntos dobles',
      payload: 'https://dominio..ejemplo.com/item',
      desc: 'Hostname inválido según sintaxis RFC 1123',
      isInvalidCase: true
    },
    {
      id: 'url_protocol_relative',
      category: 'url',
      tier: 'advanced',
      name: 'URL relativa de protocolo (//ejemplo.com)',
      payload: '//ejemplo.com/recurso',
      desc: 'Verificar si acepta o resuelve enlaces dependientes de protocolo',
      isInvalidCase: true
    },
    {
      id: 'url_internal_ssrf',
      category: 'url',
      tier: 'advanced',
      name: 'Host local / Intranet (Riesgo SSRF)',
      payload: 'http://127.0.0.1:8080/admin',
      desc: 'Destino a interfaz loopback o infraestructura interna no restringida',
      isInvalidCase: true
    },
    {
      id: 'url_data_scheme',
      category: 'url',
      tier: 'advanced',
      name: 'Esquema data: con HTML/script',
      payload: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      desc: 'Esquema URI peligroso capaz de generar contexto de ejecución arbitrario',
      isInvalidCase: true
    },
    {
      id: 'url_excessive_length',
      category: 'url',
      tier: 'total',
      name: 'URL extremadamente larga (>2000 chars)',
      payload: 'https://ejemplo.com/' + 'a'.repeat(2000),
      desc: 'Verificar tolerancia a límites de URI en navegadores y servidores (2048)',
      isInvalidCase: true
    }
  ];

  // DOM Elements
  const btnPickField = document.getElementById('btn-pick-field');
  const pickBtnText = document.getElementById('pick-btn-text');
  const btnAutoDetectForm = document.getElementById('btn-auto-detect-form');
  const fieldsCountBadge = document.getElementById('fields-count-badge');
  const fieldEmptyState = document.getElementById('field-empty-state');
  const selectedFieldsList = document.getElementById('selected-fields-list');
  const formsSelectorWrap = document.getElementById('forms-selector-wrap');
  const pageFormsSelect = document.getElementById('page-forms-select');
  const btnPickFormClick = document.getElementById('btn-pick-form-click');
  const btnResetAll = document.getElementById('btn-reset-all');

  // Save Button Section DOM
  const saveButtonBox = document.getElementById('save-button-box');
  const saveFormsList = document.getElementById('save-forms-list');

  // Sibling Fillers DOM
  const siblingFillersBox = document.getElementById('sibling-fillers-box');
  const checkEnableSiblingFillers = document.getElementById('check-enable-sibling-fillers');
  const siblingFillersList = document.getElementById('sibling-fillers-list');

  // Re-open Flow DOM
  const reopenFlowBox = document.getElementById('reopen-flow-box');
  const checkEnableReopen = document.getElementById('check-enable-reopen');
  const reopenStepsContent = document.getElementById('reopen-steps-content');
  const reopenStepsList = document.getElementById('reopen-steps-list');
  const btnAddReopenStep = document.getElementById('btn-add-reopen-step');
  const btnTestReopen = document.getElementById('btn-test-reopen');

  // Suites and Payloads DOM
  const depthButtons = document.querySelectorAll('.depth-btn');
  const depthDescBadge = document.getElementById('depth-desc-badge');
  const categoryTabs = document.querySelectorAll('.tab-btn');
  const checkSelectAll = document.getElementById('check-select-all');
  const btnOpenCustomModal = document.getElementById('btn-open-custom-modal');
  const payloadsContainer = document.getElementById('payloads-container');
  const selectedCountBadge = document.getElementById('selected-count-badge');

  // Execution DOM
  const checkTriggerSave = document.getElementById('check-trigger-save');
  const executionSpeedSelect = document.getElementById('execution-speed');
  const submitWaitTimeSelect = document.getElementById('submit-wait-time');
  const checkRestoreValue = document.getElementById('check-restore-value');
  const btnRunTests = document.getElementById('btn-run-tests');
  const runBtnText = document.getElementById('run-btn-text');
  const progressContainer = document.getElementById('progress-container');
  const progressLabel = document.getElementById('progress-label');
  const progressPercent = document.getElementById('progress-percent');
  const progressBarFill = document.getElementById('progress-bar-fill');

  // Results DOM
  const resultsCard = document.getElementById('results-card');
  const btnClearResults = document.getElementById('btn-clear-results');
  const kpiTotal = document.getElementById('kpi-total');
  const kpiRestricted = document.getElementById('kpi-restricted');
  const kpiConforme = document.getElementById('kpi-conforme');
  const kpiRisk = document.getElementById('kpi-risk');
  const resultsFilterChips = document.querySelectorAll('.filter-chip');
  const filterFieldSelect = document.getElementById('filter-field-select');
  const resultsTbody = document.getElementById('results-tbody');

  // Export DOM
  const btnCopyNotion = document.getElementById('btn-copy-notion');
  const btnCopyMarkdown = document.getElementById('btn-copy-markdown');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnPrintReport = document.getElementById('btn-print-report');

  // Custom Modal DOM
  const customModal = document.getElementById('custom-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelCustom = document.getElementById('btn-cancel-custom');
  const btnSaveCustom = document.getElementById('btn-save-custom');
  const customName = document.getElementById('custom-name');
  const customCategory = document.getElementById('custom-category');
  const customValue = document.getElementById('custom-value');
  const customDesc = document.getElementById('custom-desc');
  const customIsInvalid = document.getElementById('custom-is-invalid');

  // Viewer Modal DOM
  const payloadViewerModal = document.getElementById('payload-viewer-modal');
  const btnCloseViewer = document.getElementById('btn-close-viewer');
  const btnDismissViewer = document.getElementById('btn-dismiss-viewer');
  const btnCopyViewer = document.getElementById('btn-copy-viewer');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerContent = document.getElementById('viewer-content');

  // Load Custom Payloads from storage
  async function loadCustomPayloads() {
    try {
      const stored = await chrome.storage.local.get('qa_custom_payloads');
      if (stored && Array.isArray(stored.qa_custom_payloads)) {
        customPayloads = stored.qa_custom_payloads;
      }
    } catch (e) {
      console.warn('Error loading custom payloads:', e);
    }
  }

  async function saveCustomPayloads() {
    try {
      await chrome.storage.local.set({ qa_custom_payloads: customPayloads });
    } catch (e) {
      console.warn('Error saving custom payloads:', e);
    }
  }

  // Get active tab
  async function getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (e) {
      console.warn('Error fetching active tab:', e);
      return null;
    }
  }

  // Ensure content script injected
  async function ensureContentScriptInjected(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'PING' });
      return true;
    } catch {
      try {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['content-scripts/picker.css']
        });
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/picker.js']
        });
        return true;
      } catch (err) {
        console.error('Failed to inject content script:', err);
        return false;
      }
    }
  }

  // Payloads management
  function getAllPayloads() {
    return [...defaultSuites, ...customPayloads];
  }

  function renderPayloads() {
    const all = getAllPayloads();
    const filtered = all.filter(p => currentCategory === 'all' || p.category === currentCategory);

    payloadsContainer.innerHTML = '';

    if (filtered.length === 0) {
      payloadsContainer.innerHTML = `
        <div class="empty-notice" style="margin: 10px;">
          No hay entradas en esta categoría. Puedes añadir una personalizada con "+ Añadir Input".
        </div>
      `;
      updateSelectedCount();
      return;
    }

    filtered.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'payload-item';
      item.dataset.id = p.id;

      const isChecked = p.selected !== false;

      let displayPreview = p.payload;
      if (displayPreview.length > 25) {
        displayPreview = displayPreview.slice(0, 22) + '...';
      }

      item.innerHTML = `
        <div class="payload-main">
          <input type="checkbox" class="payload-checkbox" data-id="${p.id}" ${isChecked ? 'checked' : ''}>
          <div>
            <span class="payload-label">${escapeHtml(p.name)}</span>
            <span class="payload-preview" title="Clic para ver completo" data-viewer-id="${p.id}">${escapeHtml(displayPreview)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          ${!p.isCustom ? `<span class="tier-pill tier-${p.tier || 'normal'}">${p.tier === 'simple' ? 'Simple' : (p.tier === 'normal' ? 'Normal' : (p.tier === 'advanced' ? 'Avanzado' : 'Total'))}</span>` : ''}
          <span class="payload-tag">${p.category}</span>
          ${p.isCustom ? `<button class="btn-subtle btn-delete-custom" data-id="${p.id}" title="Eliminar input">&times;</button>` : ''}
        </div>
      `;

      payloadsContainer.appendChild(item);
    });

    payloadsContainer.querySelectorAll('.payload-preview').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.viewerId;
        const targetPayload = all.find(p => p.id === id);
        if (targetPayload) {
          showViewerModal(targetPayload.name, targetPayload.payload);
        }
      });
    });

    payloadsContainer.querySelectorAll('.payload-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const item = all.find(p => p.id === id);
        if (item) item.selected = e.target.checked;
        updateSelectedCount();
      });
    });

    payloadsContainer.querySelectorAll('.btn-delete-custom').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        customPayloads = customPayloads.filter(p => p.id !== id);
        await saveCustomPayloads();
        renderPayloads();
      });
    });

    updateSelectedCount();
  }

  function updateSelectedCount() {
    const all = getAllPayloads();
    const count = all.filter(p => p.selected !== false).length;
    selectedCountBadge.innerText = `${count} pruebas activas`;
    btnRunTests.disabled = selectedFields.length === 0 || count === 0;
    if (selectedFields.length > 0) {
      runBtnText.innerText = `Iniciar Verificación (${selectedFields.length} campo${selectedFields.length > 1 ? 's' : ''})`;
    } else {
      runBtnText.innerText = 'Iniciar Verificación de Campos';
    }
  }

  // Depth Tier Management (Simple, Normal, Avanzado, Total)
  function applyDepthTier(tier) {
    if (!TIER_HIERARCHY[tier]) tier = 'normal';
    currentDepthTier = tier;
    const targetLevel = TIER_HIERARCHY[tier];

    depthButtons.forEach(btn => {
      if (btn.dataset.depth === tier) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (depthDescBadge) {
      depthDescBadge.innerText = TIER_DESCRIPTIONS[tier] || tier;
    }

    defaultSuites.forEach(p => {
      const pLevel = TIER_HIERARCHY[p.tier] || 2;
      p.selected = pLevel <= targetLevel;
    });

    // Keep custom payloads active if user created any
    customPayloads.forEach(c => {
      if (c.selected === undefined) c.selected = true;
    });

    renderPayloads();
  }

  depthButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      applyDepthTier(btn.dataset.depth);
    });
  });

  // Category Tab Switching
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      renderPayloads();
    });
  });

  checkSelectAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const all = getAllPayloads();
    all.forEach(p => {
      if (currentCategory === 'all' || p.category === currentCategory) {
        p.selected = isChecked;
      }
    });
    renderPayloads();
  });

  // MULTI-FIELD MANAGEMENT
  function renderSelectedFields() {
    if (selectedFields.length === 0) {
      fieldEmptyState.style.display = 'block';
      selectedFieldsList.style.display = 'none';
      saveButtonBox.style.display = 'none';
      fieldsCountBadge.className = 'badge badge-idle';
      fieldsCountBadge.innerText = '0 campos';
      updateSelectedCount();
      updateFilterFieldSelect();
      return;
    }

    fieldEmptyState.style.display = 'none';
    selectedFieldsList.style.display = 'flex';
    saveButtonBox.style.display = 'flex';
    fieldsCountBadge.className = 'badge badge-active';
    fieldsCountBadge.innerText = `${selectedFields.length} campo${selectedFields.length > 1 ? 's' : ''}`;

    selectedFieldsList.innerHTML = '';
    selectedFields.forEach((field, index) => {
      const chip = document.createElement('div');
      chip.className = 'field-chip-item';
      chip.innerHTML = `
        <div class="field-chip-info">
          <span class="field-chip-type">${escapeHtml(field.type)}</span>
          <span class="field-chip-name" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
        </div>
        <div class="field-chip-actions">
          <button class="btn-subtle btn-inspect-field" data-index="${index}" title="Resaltar en página"><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg></button>
          <button class="field-chip-remove" data-index="${index}" title="Quitar campo">&times;</button>
        </div>
      `;
      selectedFieldsList.appendChild(chip);
    });

    selectedFieldsList.querySelectorAll('.btn-inspect-field').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const f = selectedFields[idx];
        if (f && activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { action: 'HIGHLIGHT_TARGET', fieldInfo: f });
        }
      });
    });

    selectedFieldsList.querySelectorAll('.field-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        selectedFields.splice(idx, 1);
        renderSelectedFields();
      });
    });

    updateSelectedCount();
    updateFilterFieldSelect();
    renderSiblingFillers();
    renderSaveButtonsList();
  }

  // Render Sibling Fillers for Required/Auxiliary Fields
  function renderSiblingFillers() {
    if (!siblingFillersBox) return;

    if (selectedFields.length <= 1) {
      siblingFillersBox.style.display = 'none';
      return;
    }

    siblingFillersBox.style.display = 'flex';
    siblingFillersList.innerHTML = '';

    selectedFields.forEach((field, index) => {
      const item = document.createElement('div');
      item.className = 'sibling-filler-item';

      const isReq = field.required !== false;
      const currentVal = field.fillerValue !== undefined ? field.fillerValue : (field.suggestedFillerValue || 'Dato Válido QA');

      item.innerHTML = `
        <label class="checkbox-inline" style="font-size: 10px;" title="Marcar si este campo es obligatorio en el formulario">
          <input type="checkbox" class="sibling-req-toggle" data-index="${index}" ${isReq ? 'checked' : ''}>
          <span style="font-size: 9px; text-transform: uppercase; font-weight: bold; color: ${isReq ? '#34d399' : '#94a3b8'};">
            ${isReq ? 'Obligatorio' : 'Opcional'}
          </span>
        </label>
        <span class="sibling-filler-name" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
        <input type="text" class="sibling-filler-input" data-index="${index}" value="${escapeHtml(currentVal)}" title="Valor válido asignado para cuando se prueben otros campos">
        <button class="btn-subtle btn-random-filler" data-index="${index}" title="Generar nuevo valor aleatorio acorde a las reglas"><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg></button>
      `;
      siblingFillersList.appendChild(item);
    });

    // Wire listeners
    siblingFillersList.querySelectorAll('.sibling-req-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (selectedFields[idx]) {
          selectedFields[idx].required = e.target.checked;
          renderSiblingFillers();
        }
      });
    });

    siblingFillersList.querySelectorAll('.sibling-filler-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (selectedFields[idx]) {
          selectedFields[idx].fillerValue = e.target.value;
        }
      });
    });

    siblingFillersList.querySelectorAll('.btn-random-filler').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const f = selectedFields[idx];
        if (f && activeTabId) {
          try {
            const res = await chrome.tabs.sendMessage(activeTabId, { action: 'GENERATE_NEW_DUMMY', fieldInfo: f });
            if (res && res.value) {
              f.fillerValue = res.value;
              renderSiblingFillers();
            }
          } catch {
            const isUrl = !!f.isUrlField || f.type === 'url' || /\b(url|link|enlace|sitio|website|web|endpoint|slug|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(`${f.name || ''} ${f.id || ''} ${f.label || ''} ${f.placeholder || ''}`);
            const isSlug = /\bslug\b/i.test(`${f.name || ''} ${f.id || ''} ${f.label || ''} ${f.placeholder || ''}`);
            if (isSlug) {
              f.fillerValue = 'recurso-qa-valido-' + Math.floor(100 + Math.random() * 900);
            } else if (isUrl) {
              f.fillerValue = 'https://qa.ejemplo.com/recurso-' + Math.floor(100 + Math.random() * 900);
            } else {
              f.fillerValue = 'Dato ' + Math.floor(1000 + Math.random() * 9000);
            }
            renderSiblingFillers();
          }
        }
      });
    });
  }

  // RENDER REOPEN STEPS FOR COLLAPSIBLE / MODAL FORMS
  function renderReopenSteps() {
    if (!reopenStepsList) return;
    if (reopenSteps.length === 0) {
      reopenStepsList.innerHTML = '<div class="sub-desc" style="font-style: italic; font-size: 10px; padding: 4px 0;">Aún no has añadido pasos. Haz clic en "Apuntar paso de clic" para seleccionar la tarjeta del cliente o el botón editar.</div>';
      return;
    }

    reopenStepsList.innerHTML = '';
    reopenSteps.forEach((step, idx) => {
      const chip = document.createElement('div');
      chip.className = 'reopen-step-chip';
      chip.innerHTML = `
        <div class="reopen-step-info">
          <span class="reopen-step-num">Paso ${idx + 1}</span>
          <span class="reopen-step-name" title="${escapeHtml(step.text || step.selector)}">${escapeHtml(step.text || step.selector)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn-subtle btn-inspect-step" data-index="${idx}" title="Resaltar elemento en página"><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg></button>
          <button class="btn-subtle btn-remove-step" data-index="${idx}" title="Eliminar paso" style="color: #f87171;">&times;</button>
        </div>
      `;
      reopenStepsList.appendChild(chip);
    });

    reopenStepsList.querySelectorAll('.btn-inspect-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const s = reopenSteps[idx];
        if (s && activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { action: 'HIGHLIGHT_TARGET', fieldInfo: s });
        }
      });
    });

    reopenStepsList.querySelectorAll('.btn-remove-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        reopenSteps.splice(idx, 1);
        renderReopenSteps();
      });
    });
  }

  if (checkEnableReopen) {
    checkEnableReopen.addEventListener('change', (e) => {
      if (reopenStepsContent) {
        reopenStepsContent.style.display = e.target.checked ? 'block' : 'none';
      }
      renderReopenSteps();
    });
  }

  if (btnAddReopenStep) {
    btnAddReopenStep.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) {
        alert('Por favor abre una página web válida en el navegador.');
        return;
      }
      activeTabId = tab.id;
      await ensureContentScriptInjected(tab.id);

      if (isPickingReopenStepActive) {
        chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
        setReopenStepPickingState(false);
      } else {
        chrome.tabs.sendMessage(tab.id, { action: 'START_PICKING_REOPEN_STEP' });
        setReopenStepPickingState(true);
      }
    });
  }

  function setReopenStepPickingState(active) {
    isPickingReopenStepActive = active;
    if (!btnAddReopenStep) return;
    if (active) {
      btnAddReopenStep.innerText = 'Cancelar (ESC)';
      btnAddReopenStep.classList.add('btn-outline');
    } else {
      btnAddReopenStep.innerHTML = '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Apuntar paso de clic';
      btnAddReopenStep.classList.remove('btn-outline');
    }
  }

  if (btnTestReopen) {
    btnTestReopen.addEventListener('click', async () => {
      if (reopenSteps.length === 0) {
        alert('Por favor añade al menos un paso de clic con "Apuntar paso de clic" antes de probar.');
        return;
      }
      const tab = await getActiveTab();
      if (!tab?.id) return;
      activeTabId = tab.id;
      await ensureContentScriptInjected(tab.id);

      btnTestReopen.innerText = 'Abriendo...';
      btnTestReopen.disabled = true;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'EXECUTE_REOPEN_STEPS',
          steps: reopenSteps,
          waitMs: 450
        });
        btnTestReopen.innerHTML = '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> ¡Abierto!';
        setTimeout(() => {
          btnTestReopen.innerHTML = '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Probar apertura';
          btnTestReopen.disabled = false;
        }, 1500);
      } catch (err) {
        console.warn('Error testing reopen:', err);
        btnTestReopen.innerHTML = '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Error';
        btnTestReopen.disabled = false;
      }
    });
  }

  function addField(fieldData) {
    // Avoid duplicate selection
    const exists = selectedFields.some(f => 
      (f.id && f.id === fieldData.id) || 
      (f.selector && f.selector === fieldData.selector) ||
      (f.name && f.name === fieldData.name && f.type === fieldData.type)
    );

    if (!exists) {
      if (fieldData.fillerValue === undefined) {
        fieldData.fillerValue = fieldData.suggestedFillerValue || 'Dato Válido QA';
      }
      selectedFields.push(fieldData);
    } else {
      // Visual feedback that the field is already in the list
      const existingIdx = selectedFields.findIndex(f => 
        (f.id && f.id === fieldData.id) || 
        (f.selector && f.selector === fieldData.selector) ||
        (f.name && f.name === fieldData.name && f.type === fieldData.type)
      );
      if (existingIdx !== -1) {
        const chips = selectedFieldsList.querySelectorAll('.field-chip-item');
        if (chips[existingIdx]) {
          chips[existingIdx].classList.add('field-chip-active');
          setTimeout(() => chips[existingIdx]?.classList.remove('field-chip-active'), 1200);
        }
      }
    }

    if (fieldData.autoSaveButton) {
      handleSaveButtonSelected(fieldData.autoSaveButton, true);
    }

    renderSelectedFields();
  }

  // Update Field Dropdown in Results Filter
  function updateFilterFieldSelect() {
    filterFieldSelect.innerHTML = '<option value="all">Todos los campos</option>';
    selectedFields.forEach((f, i) => {
      const opt = document.createElement('option');
      const key = f.id || f.selector || f.name || `field_${i}`;
      opt.value = key;
      opt.innerText = f.label ? `${f.label.slice(0, 26)} (${f.type})` : `Campo ${i + 1}`;
      filterFieldSelect.appendChild(opt);
    });
  }

  // Pick Field button
  btnPickField.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) {
      alert('Por favor abre una página web válida en el navegador.');
      return;
    }
    activeTabId = tab.id;
    const ready = await ensureContentScriptInjected(tab.id);
    if (!ready) {
      alert('No se pudo conectar a la página activa.');
      return;
    }

    if (isPickingFieldActive) {
      chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
      setFieldPickingState(false);
    } else {
      chrome.tabs.sendMessage(tab.id, { action: 'START_PICKING' });
      setFieldPickingState(true);
    }
  });

  function setFieldPickingState(active) {
    isPickingFieldActive = active;
    if (active) {
      btnPickField.classList.remove('btn-primary');
      btnPickField.classList.add('btn-secondary');
      pickBtnText.innerText = 'Cancelar selección (ESC)';
    } else {
      btnPickField.classList.remove('btn-secondary');
      btnPickField.classList.add('btn-primary');
      pickBtnText.innerText = 'Añadir campo en la página';
    }
  }

  // Helper to update the form selector dropdown
  function updatePageFormsDropdown() {
    if (!formsSelectorWrap || !pageFormsSelect) return;
    if (detectedPageForms.length === 0) {
      formsSelectorWrap.style.display = 'none';
      return;
    }

    formsSelectorWrap.style.display = 'flex';
    pageFormsSelect.innerHTML = '';

    detectedPageForms.forEach((formItem, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.innerText = `${formItem.title} (${formItem.fieldsCount} campo${formItem.fieldsCount > 1 ? 's' : ''})`;
      pageFormsSelect.appendChild(opt);
    });
  }

  function selectFormByIndex(index) {
    const formItem = detectedPageForms[index];
    if (!formItem) return;

    formItem.fields.forEach(f => {
      if (f.fillerValue === undefined) {
        f.fillerValue = f.suggestedFillerValue || 'Dato Válido QA';
      }
    });

    selectedFields = [...formItem.fields];
    if (formItem.formIndex === 'all') {
      currentSaveButton = null;
    } else {
      currentSaveButton = formItem.saveButton || null;
    }

    renderSelectedFields();
    renderSaveButtonsList();
    if (pageFormsSelect) {
      pageFormsSelect.value = String(index);
    }
  }

  if (pageFormsSelect) {
    pageFormsSelect.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      selectFormByIndex(idx);
    });
  }

  // Point-and-click Form / Sector Picker
  if (btnPickFormClick) {
    btnPickFormClick.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      activeTabId = tab.id;
      await ensureContentScriptInjected(tab.id);

      if (isPickingFormActive) {
        chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
        setFormPickingState(false);
      } else {
        chrome.tabs.sendMessage(tab.id, { action: 'START_PICKING_FORM' });
        setFormPickingState(true);
      }
    });
  }

  function setFormPickingState(active) {
    isPickingFormActive = active;
    if (!btnPickFormClick) return;
    if (active) {
      btnPickFormClick.innerText = 'Cancelar (ESC)';
      btnPickFormClick.classList.add('btn-outline');
    } else {
      btnPickFormClick.innerHTML = '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg> Apuntar sector';
      btnPickFormClick.classList.remove('btn-outline');
    }
  }

  // Auto-detect all forms / modules across the page
  btnAutoDetectForm.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    activeTabId = tab.id;
    await ensureContentScriptInjected(tab.id);

    try {
      const originalText = btnAutoDetectForm.innerHTML;
      btnAutoDetectForm.innerText = 'Detectando...';
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_ALL_PAGE_FORMS' });
      btnAutoDetectForm.innerHTML = originalText;

      if (res && res.forms && res.forms.length > 0) {
        detectedPageForms = res.forms;
        updatePageFormsDropdown();
        selectFormByIndex(0);
      } else {
        // Fallback to basic single container detection
        const fallback = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_ALL_FORM_FIELDS' });
        if (fallback && fallback.fields && fallback.fields.length > 0) {
          fallback.fields.forEach(f => {
            if (f.fillerValue === undefined) {
              f.fillerValue = f.suggestedFillerValue || 'Dato Válido QA';
            }
          });
          selectedFields = fallback.fields;
          if (fallback.saveButton) {
            handleSaveButtonSelected(fallback.saveButton, true);
          }
          renderSelectedFields();
        } else {
          alert('No se encontraron formularios ni campos en la página activa.');
        }
      }
    } catch (e) {
      console.warn('Error auto-detecting forms:', e);
      btnAutoDetectForm.innerHTML = '<svg class="ui-icon ui-icon-sm" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="11" y2="17"></line></svg> Detectar formularios';
      alert('Asegúrate de que la página tenga formularios con campos de entrada.');
    }
  });

  // Multi-Form and Single-Form Save Buttons Logic
  function setButtonPickingState(active) {
    isPickingButtonActive = active;
    if (!active) {
      activePickingFormId = null;
    }
    renderSaveButtonsList();
  }

  function handleSaveButtonSelected(btnData, isAuto = false, targetFormId = null) {
    const targetKey = targetFormId !== null ? targetFormId : activePickingFormId;

    if (targetKey && targetKey !== 'general' && detectedPageForms.length > 0) {
      const targetForm = detectedPageForms.find(f => (f.id && f.id === targetKey) || String(f.formIndex) === targetKey);
      if (targetForm) {
        targetForm.saveButton = btnData;
        // Sync with all fields associated with this form
        selectedFields.forEach(field => {
          if (field.formSelector === targetForm.selector || targetForm.fields?.some(tf => tf.selector === field.selector)) {
            field.saveButton = btnData;
          }
        });
        // If this form is currently selected, also update currentSaveButton
        const currentSelectVal = pageFormsSelect ? pageFormsSelect.value : '0';
        if (detectedPageForms[currentSelectVal] === targetForm) {
          currentSaveButton = btnData;
        }
      }
    } else {
      currentSaveButton = btnData;
      // If there is an active single form in dropdown, assign to it as well
      const currentSelectVal = pageFormsSelect ? pageFormsSelect.value : '0';
      const activeForm = detectedPageForms[currentSelectVal];
      if (activeForm && activeForm.formIndex !== 'all') {
        activeForm.saveButton = btnData;
      }
      // Assign to all currently selected fields
      selectedFields.forEach(f => {
        f.saveButton = btnData;
      });
    }

    renderSaveButtonsList();
  }

  function renderSaveButtonsList() {
    if (!saveButtonBox || !saveFormsList) return;

    if (selectedFields.length === 0) {
      saveButtonBox.style.display = 'none';
      saveFormsList.innerHTML = '';
      return;
    }

    saveButtonBox.style.display = 'block';
    saveFormsList.innerHTML = '';

    const nonAllForms = detectedPageForms.filter(f => f.formIndex !== 'all');
    const currentSelectVal = pageFormsSelect ? pageFormsSelect.value : '0';
    const isAllSelected = detectedPageForms[currentSelectVal]?.formIndex === 'all';

    let formsToShow = [];
    if (nonAllForms.length > 0) {
      if (isAllSelected) {
        formsToShow = nonAllForms;
      } else {
        const currentForm = detectedPageForms[currentSelectVal];
        formsToShow = currentForm ? [currentForm] : nonAllForms;
      }
    }

    if (formsToShow.length === 0) {
      // Manual field picking or single container fallback
      const row = document.createElement('div');
      const isPickingThis = activePickingFormId === 'general';
      row.className = `save-form-row ${isPickingThis ? 'picking-active' : ''}`;
      const btnText = currentSaveButton ? (currentSaveButton.text || currentSaveButton.value || 'Botón Guardar') : 'Auto / No asignado';
      const isConfigured = !!currentSaveButton;

      row.innerHTML = `
        <div class="save-form-row-header">
          <span class="save-form-name">
            <svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="11" y2="17"></line></svg>
            Formulario Activo
          </span>
          <span class="save-form-count">${selectedFields.length} campos</span>
        </div>
        <div class="save-form-row-body">
          <span class="pill ${isConfigured ? 'pill-save' : 'pill-idle'}" title="${escapeHtml(btnText)}">
            ${escapeHtml(btnText)}
          </span>
          <div class="save-form-actions">
            <button class="btn-sm btn-subtle btn-inspect-save" data-target="general" ${!isConfigured ? 'disabled style="display:none;"' : ''} title="Resaltar botón en la página">
              <svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="3"></circle></svg>Ver
            </button>
            <button class="btn-sm btn-outline btn-change-save" data-target="general" title="Seleccionar botón haciendo clic en la página">
              <svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>${isPickingThis ? 'Cancelar (ESC)' : 'Cambiar botón'}
            </button>
          </div>
        </div>
      `;
      saveFormsList.appendChild(row);
    } else {
      formsToShow.forEach((form, idx) => {
        const formKey = form.id ? form.id : (form.formIndex !== undefined ? String(form.formIndex) : String(idx));
        const isPickingThis = activePickingFormId === formKey;
        const row = document.createElement('div');
        row.className = `save-form-row ${isPickingThis ? 'picking-active' : ''}`;

        const formSaveBtn = form.saveButton || null;
        const btnText = formSaveBtn ? (formSaveBtn.text || formSaveBtn.value || 'Botón Guardar') : 'No asignado (Auto)';
        const isConfigured = !!formSaveBtn;
        const fieldCount = form.fieldsCount || (form.fields ? form.fields.length : 0);

        row.innerHTML = `
          <div class="save-form-row-header">
            <span class="save-form-name" title="${escapeHtml(form.title)}">
              <svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="11" y2="17"></line></svg>
              ${escapeHtml(form.title)}
            </span>
            <span class="save-form-count">${fieldCount} campos</span>
          </div>
          <div class="save-form-row-body">
            <span class="pill ${isConfigured ? 'pill-save' : 'pill-idle'}" title="${escapeHtml(btnText)}">
              ${escapeHtml(btnText)}
            </span>
            <div class="save-form-actions">
              <button class="btn-sm btn-subtle btn-inspect-save" data-target="${escapeHtml(formKey)}" ${!isConfigured ? 'disabled style="display:none;"' : ''} title="Resaltar botón en la página">
                <svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="3"></circle></svg>Ver
              </button>
              <button class="btn-sm btn-outline btn-change-save" data-target="${escapeHtml(formKey)}" title="Seleccionar botón para este formulario">
                <svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>${isPickingThis ? 'Cancelar (ESC)' : 'Cambiar botón'}
              </button>
            </div>
          </div>
        `;
        saveFormsList.appendChild(row);
      });
    }

    // Attach inspect listeners
    saveFormsList.querySelectorAll('.btn-inspect-save').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget.dataset.target;
        let saveBtnData = null;
        if (target === 'general') {
          saveBtnData = currentSaveButton;
        } else {
          const form = detectedPageForms.find(f => (f.id && f.id === target) || String(f.formIndex) === target);
          saveBtnData = form ? form.saveButton : currentSaveButton;
        }

        const tab = await getActiveTab();
        if (tab?.id && saveBtnData) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'HIGHLIGHT_SAVE_BUTTON',
            saveButtonInfo: saveBtnData
          });
        }
      });
    });

    // Attach change button listeners
    saveFormsList.querySelectorAll('.btn-change-save').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget.dataset.target;
        let formTitle = '';
        if (target !== 'general') {
          const form = detectedPageForms.find(f => (f.id && f.id === target) || String(f.formIndex) === target);
          if (form) formTitle = form.title || '';
        }

        if (isPickingButtonActive && activePickingFormId === target) {
          setButtonPickingState(false);
          const tab = await getActiveTab();
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
          }
        } else {
          activePickingFormId = target;
          setButtonPickingState(true);
          const tab = await getActiveTab();
          if (tab?.id) {
            activeTabId = tab.id;
            await ensureContentScriptInjected(tab.id);
            chrome.tabs.sendMessage(tab.id, {
              action: 'START_PICKING_BUTTON',
              formTitle: formTitle
            });
          }
        }
      });
    });
  }

  // Receive message from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'ELEMENT_SELECTED') {
      setFieldPickingState(false);
      addField(message.data);
    } else if (message.action === 'FORM_SELECTED') {
      setFormPickingState(false);
      const formData = message.data;
      if (formData && formData.fields && formData.fields.length > 0) {
        formData.fields.forEach(f => {
          if (f.fillerValue === undefined) {
            f.fillerValue = f.suggestedFillerValue || 'Dato Válido QA';
          }
        });
        selectedFields = [...formData.fields];
        if (formData.saveButton) {
          handleSaveButtonSelected(formData.saveButton, true, formData.id || 'general');
        }
        renderSelectedFields();

        // Add to detectedPageForms if not present
        const existsIdx = detectedPageForms.findIndex(f => f.title === formData.title && f.fieldsCount === formData.fieldsCount);
        if (existsIdx === -1) {
          detectedPageForms.push(formData);
          updatePageFormsDropdown();
          if (pageFormsSelect) pageFormsSelect.value = String(detectedPageForms.length - 1);
        } else {
          updatePageFormsDropdown();
          if (pageFormsSelect) pageFormsSelect.value = String(existsIdx);
        }
        renderSaveButtonsList();
      } else {
        alert('El sector seleccionado no contiene campos de formulario válidos.');
      }
    } else if (message.action === 'SAVE_BUTTON_SELECTED') {
      const targetFormId = activePickingFormId;
      setButtonPickingState(false);
      handleSaveButtonSelected(message.data, false, targetFormId);
    } else if (message.action === 'REOPEN_STEP_PICKED') {
      setReopenStepPickingState(false);
      if (message.data) {
        reopenSteps.push(message.data);
        renderReopenSteps();
      }
    } else if (message.action === 'PICKING_CANCELLED') {
      setFieldPickingState(false);
      setFormPickingState(false);
      setReopenStepPickingState(false);
      setButtonPickingState(false);
    }
  });

  // Reset Everything
  btnResetAll.addEventListener('click', () => {
    if (confirm('¿Deseas reiniciar la lista de campos y los resultados?')) {
      selectedFields = [];
      detectedPageForms = [];
      reopenSteps = [];
      currentSaveButton = null;
      if (formsSelectorWrap) formsSelectorWrap.style.display = 'none';
      if (checkEnableReopen) checkEnableReopen.checked = false;
      if (reopenStepsContent) reopenStepsContent.style.display = 'none';
      renderSelectedFields();
      renderReopenSteps();
      resultsCard.style.display = 'none';
      testResults = [];
      applyDepthTier('normal');
      updateSelectedCount();
    }
  });

  // EXECUTION ENGINE: TYPE-AWARE TESTING ACROSS ALL SELECTED FIELDS
  btnRunTests.addEventListener('click', async () => {
    if (selectedFields.length === 0 || !activeTabId) {
      alert('Por favor selecciona al menos un campo antes de iniciar.');
      return;
    }

    const all = getAllPayloads();
    const selectedPayloads = all.filter(p => p.selected !== false);
    if (selectedPayloads.length === 0) {
      alert('No hay entradas seleccionadas para probar.');
      return;
    }

    // Build test tasks mapped by field type
    const testQueue = [];
    selectedFields.forEach(field => {
      const fType = (field.type || 'text').toLowerCase();
      let applicable = [];

      const isUrl = !!field.isUrlField || fType === 'url' || /\b(url|link|enlace|sitio|website|web|endpoint|slug|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);

      if (isUrl) {
        applicable = selectedPayloads.filter(p => p.category === 'url' || p.id === 'sec_null_byte' || p.id === 'sec_script' || p.id === 'txt_spaces' || p.id === 'txt_only_spaces');
      } else if (fType === 'number') {
        applicable = selectedPayloads.filter(p => p.category === 'number' || p.id === 'sec_null_byte');
      } else if (fType === 'date' || fType === 'datetime-local' || fType === 'month') {
        applicable = selectedPayloads.filter(p => p.category === 'date');
      } else {
        // Text, Textarea, Email, Tel, etc.
        applicable = selectedPayloads.filter(p => p.category === 'text' || p.category === 'emoji' || p.category === 'security');
      }

      // If no category matched (e.g. custom), include them
      const customs = selectedPayloads.filter(p => p.isCustom);
      customs.forEach(c => {
        if (!applicable.includes(c)) applicable.push(c);
      });

      applicable.forEach(testItem => {
        testQueue.push({ field, testItem });
      });
    });

    if (testQueue.length === 0) {
      alert('No se encontraron pruebas aplicables para los tipos de campo seleccionados.');
      return;
    }

    if (checkEnableReopen && checkEnableReopen.checked && reopenSteps.length === 0) {
      const proceed = confirm('Has activado "Auto re-abrir formulario" pero aún no has grabado ningún paso de clic.\n\n¿Deseas ejecutar las pruebas sin re-apertura automática? (Presiona Cancelar para apuntar los pasos antes de iniciar)');
      if (!proceed) return;
    }

    // Lock UI
    btnRunTests.disabled = true;
    btnPickField.disabled = true;
    btnAutoDetectForm.disabled = true;
    if (saveFormsList) saveFormsList.querySelectorAll('button').forEach(b => b.disabled = true);
    runBtnText.innerText = 'Ejecutando pruebas...';
    progressContainer.style.display = 'flex';
    resultsCard.style.display = 'block';
    resultsTbody.innerHTML = '';
    testResults = [];

    const delayMs = parseInt(executionSpeedSelect.value, 10) || 150;
    const submitWaitMs = parseInt(submitWaitTimeSelect.value, 10) || 500;
    const triggerSave = checkTriggerSave.checked;
    const shouldRestore = checkRestoreValue.checked;
    const shouldFillSiblings = checkEnableSiblingFillers && checkEnableSiblingFillers.checked;

    let completed = 0;
    for (const task of testQueue) {
      completed++;
      const pct = Math.round((completed / testQueue.length) * 100);
      progressPercent.innerText = `${pct}%`;
      progressBarFill.style.width = `${pct}%`;
      progressContainer.setAttribute('aria-valuenow', String(pct));
      progressLabel.innerText = `(${completed}/${testQueue.length}) [${task.field.label}]: ${task.testItem.name}...`;

      // Highlight the chip of the field currently being tested
      const currentFieldIndex = selectedFields.indexOf(task.field);
      const chips = selectedFieldsList.querySelectorAll('.field-chip-item');
      chips.forEach((c, idx) => {
        if (idx === currentFieldIndex) {
          c.classList.add('field-chip-active');
        } else {
          c.classList.remove('field-chip-active');
        }
      });

      try {
        // Pre-fill valid dummy data in all other sibling fields so they don't block the save!
        const siblingFields = selectedFields.filter(f => f !== task.field);
        const siblingFillers = shouldFillSiblings ? siblingFields.map(f => ({
          fieldInfo: f,
          value: (f.fillerValue !== undefined ? f.fillerValue : f.suggestedFillerValue) || 'Dato Válido QA'
        })) : [];

        // Dynamically resolve save button for the task's field / form
        let fieldSaveButton = task.field.saveButton || null;
        if (!fieldSaveButton && detectedPageForms.length > 0) {
          const matchedForm = detectedPageForms.find(df => df.selector && df.selector === task.field.formSelector);
          if (matchedForm && matchedForm.saveButton) {
            fieldSaveButton = matchedForm.saveButton;
          }
        }
        const targetSaveButton = fieldSaveButton || currentSaveButton || null;

        const res = await chrome.tabs.sendMessage(activeTabId, {
          action: 'RUN_SINGLE_PAYLOAD',
          fieldInfo: task.field,
          payload: task.testItem.payload,
          triggerSave: triggerSave,
          saveButton: targetSaveButton,
          submitWaitMs: submitWaitMs,
          siblingFillers: siblingFillers,
          reopenConfig: {
            enabled: !!(checkEnableReopen && checkEnableReopen.checked),
            steps: reopenSteps,
            waitMs: 450
          }
        });

        const evaluation = evaluateTestResult(task.field, task.testItem, res, triggerSave);
        testResults.push(evaluation);
        appendResultRow(evaluation);
        updateKPICounters();
      } catch (err) {
        console.error('Error running payload:', task.testItem.name, err);
        const errMsg = String(err?.message || '');
        const isTabFatal = errMsg.includes('Receiving end does not exist') || 
                           errMsg.includes('No tab with id') || 
                           errMsg.includes('tab was closed') || 
                           errMsg.includes('Frame was removed');

        const errorEval = {
          fieldName: task.field.label || task.field.selector,
          fieldKey: task.field.id || task.field.selector || task.field.name || task.field.label,
          fieldType: task.field.type,
          testItem: task.testItem,
          input: task.testItem.payload,
          status: 'error',
          badgeText: 'Error de Ejecución',
          badgeClass: 'res-error',
          detail: `Fallo de comunicación: ${errMsg || 'Pestaña inaccesible'}`,
          recommendation: 'Verificar que la pestaña esté activa y no haya navegado a otra URL.'
        };
        testResults.push(errorEval);
        appendResultRow(errorEval);
        updateKPICounters();

        if (isTabFatal) {
          progressLabel.innerText = 'Pestaña cerrada o desconectada. Pruebas detenidas.';
          selectedFieldsList.querySelectorAll('.field-chip-item').forEach(c => c.classList.remove('field-chip-active'));
          btnRunTests.disabled = false;
          btnPickField.disabled = false;
          btnAutoDetectForm.disabled = false;
          if (saveFormsList) saveFormsList.querySelectorAll('button').forEach(b => b.disabled = false);
          runBtnText.innerText = `Reanudar Verificación (${selectedFields.length} campos)`;
          alert('Se perdió la conexión con la página web bajo prueba. El ciclo de verificación ha sido detenido.');
          return;
        }
      }

      await new Promise(r => setTimeout(r, delayMs));
    }

    selectedFieldsList.querySelectorAll('.field-chip-item').forEach(c => c.classList.remove('field-chip-active'));

    // Restore initial values if checked
    if (shouldRestore) {
      for (const field of selectedFields) {
        try {
          await chrome.tabs.sendMessage(activeTabId, {
            action: 'RESTORE_INITIAL_VALUE',
            fieldInfo: field,
            value: field.initialValue || ''
          });
        } catch (e) {
          console.warn('Could not restore value for field:', field.label, e);
        }
      }
    }

    progressLabel.innerText = `¡Pruebas completadas (${testQueue.length} casos)!`;
    btnRunTests.disabled = false;
    btnPickField.disabled = false;
    btnAutoDetectForm.disabled = false;
    if (saveFormsList) saveFormsList.querySelectorAll('button').forEach(b => b.disabled = false);
    runBtnText.innerText = `Volver a Iniciar (${selectedFields.length} campos)`;
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 2500);
  });

  // EVALUATION & RECOMMENDATION ENGINE
  function evaluateTestResult(field, testItem, res, triggerSave) {
    const payload = testItem.payload;

    // 0. FORM CLOSED / DRAWER COLLAPSED (Explicit detection)
    if (res && (res.error === 'FORM_CLOSED' || res.error === 'ELEMENT_NOT_VISIBLE')) {
      return {
        fieldName: field.label || field.selector,
        fieldKey: field.id || field.selector || field.name || field.label,
        fieldType: field.type,
        testItem: testItem,
        input: payload,
        status: 'error',
        badgeText: 'Formulario Cerrado',
        badgeClass: 'res-error',
        detail: 'El formulario o modal se cerró tras la acción de guardar anterior y el campo ya no estuvo accesible en pantalla.',
        recommendation: 'Activa la opción "Auto re-abrir formulario antes de cada prueba" en el paso 1 y graba los clics (ej. Clic en Cliente -> Clic en Editar) para que la herramienta reabra el formulario automáticamente.'
      };
    }

    if (!res || res.error) {
      return {
        fieldName: field.label || field.selector,
        fieldKey: field.id || field.selector || field.name || field.label,
        fieldType: field.type,
        testItem: testItem,
        input: payload,
        status: 'error',
        badgeText: 'Error de Ejecución',
        badgeClass: 'res-error',
        detail: `Fallo durante la prueba: ${res?.message || res?.error || 'Sin respuesta de la pestaña'}.`,
        recommendation: 'Verifica que el campo permanezca visible y la página no se haya recargado.'
      };
    }

    const resVal = res.resultingValue !== undefined ? res.resultingValue : '';
    const resLen = res.resultingLength !== undefined ? res.resultingLength : resVal.length;
    const payLen = payload.length;

    let status = 'conforme'; // 'restricted_save' | 'restricted_field' | 'truncated' | 'conforme' | 'risk' | 'error'
    let badgeText = 'Conforme (Guardado)';
    let badgeClass = 'res-conforme';
    let detail = '';
    let recommendation = '';

    const validity = res.validity;
    const hasHTML5Error = validity && !validity.valid;
    const saveBlocked = !!res.saveBlocked;
    const saveErrorMessage = res.saveErrorMessage || '';

    // 1. TRUNCATED IN FIELD (maxlength)
    if (resLen < payLen && payLen > 1) {
      status = 'truncated';
      badgeText = 'Truncado en Campo';
      badgeClass = 'res-truncated';
      detail = `El input de ${payLen} caracteres se recortó automáticamente a ${resLen} caracteres antes de guardar.`;
      if (field.maxLength && field.maxLength === resLen) {
        detail += ` (Coincide con maxlength="${field.maxLength}").`;
        recommendation = 'Excelente: El límite maxlength del campo previene el ingreso de datos excesivos en el frontend. Asegurar que el backend mantenga la misma longitud.';
      } else {
        recommendation = 'Recortado en frontend mediante script/máscara. Verificar si la regla es intencional.';
      }
    }
    // 2. REJECTED DIRECTLY BY FIELD (cleared input, e.g. non-digits in number)
    else if (resVal === '' && payload !== '' && payload.trim() !== '') {
      status = 'restricted_field';
      badgeText = 'Restringido en Campo';
      badgeClass = 'res-restricted-field';
      detail = 'El campo rechazó por completo el valor, impidiendo la escritura o limpiándolo inmediatamente.';
      if (testItem.category === 'number') {
        recommendation = 'Excelente: El campo no permite el ingreso de caracteres no numéricos.';
      } else {
        recommendation = 'Excelente: El campo aplica validación o filtrado estricto en tiempo real.';
      }
    }
    // 3. EMOJIS STRIPPED IN FIELD
    else if (testItem.category === 'emoji' && resVal !== payload && resLen < payLen) {
      status = 'restricted_field';
      badgeText = 'Restringido en Campo';
      badgeClass = 'res-restricted-field';
      detail = `Los emojis o símbolos fueron filtrados o eliminados del campo automáticamente. (Recibido: "${resVal.slice(0, 15)}...").`;
      recommendation = 'Comportamiento esperado si el campo prohíbe caracteres especiales. Si se esperan nombres internacionales, verificar soporte UTF-8.';
    }
    // 4. BLOCKED UPON SAVE / SUBMIT
    else if (triggerSave && saveBlocked) {
      status = 'restricted_save';
      badgeText = 'Restringido al Guardar';
      badgeClass = 'res-restricted-save';
      detail = `El campo aceptó ${resLen} caracteres inicialmente, pero al presionar Guardar el sitio bloqueó la acción y mostró: "${saveErrorMessage}".`;
      
      if (testItem.id === 'txt_15_digits' || testItem.id === 'txt_1000' || testItem.id === 'txt_5000') {
        recommendation = 'El sitio valida correctamente al guardar. Recomendación UX: Configurar el atributo maxlength o una máscara en el campo para evitar que el usuario ingrese más caracteres de los permitidos y se frustre al enviar.';
      } else if (testItem.category === 'date') {
        recommendation = 'El validador del formulario o servidor rechazó la fecha inválida al guardar. Recomendación: Asegurar que el calendario no permita seleccionar fechas inexistentes.';
      } else if (testItem.category === 'number') {
        recommendation = 'El sitio validó el límite o tipo numérico al enviar. Recomendación: Bloquear teclas no numéricas directamente en el evento keydown.';
      } else if (testItem.category === 'url') {
        recommendation = 'El sitio validó la sintaxis o esquema de la URL al enviar. Recomendación UX: Proporcionar validación en tiempo real en el evento blur para advertir al usuario sobre protocolos faltantes o caracteres inválidos.';
      } else {
        recommendation = 'El servidor o formulario contiene validación de negocio activa al enviar. Se recomienda sincronizar la validación en tiempo real.';
      }
    }
    // 5. CLIENT-SIDE HTML5 ERROR OR VISIBLE DOM ERROR (WITHOUT SAVE)
    else if (hasHTML5Error || (res.postInputErrors && res.postInputErrors.length > 0)) {
      status = 'restricted_field';
      badgeText = 'Restringido en Campo';
      badgeClass = 'res-restricted-field';
      const msgList = [];
      if (res.validationMessage) msgList.push(`HTML5: "${res.validationMessage}"`);
      if (res.postInputErrors?.length > 0) msgList.push(`Alerta: "${res.postInputErrors[0]}"`);
      detail = `El sitio detectó la irregularidad: ${msgList.join(' | ') || 'Validación activa'}.`;
      recommendation = 'Correcto: El campo avisa de inmediato al usuario que el valor no es válido.';
    }
    // 6. ACCEPTED / SAVED (NO ERROR)
    else {
      // Distinguish between genuine risk vs normal expected test
      if (testItem.isInvalidCase) {
        // Detailed domain-specific evaluation
        if (testItem.id === 'txt_only_spaces' || (typeof payload === 'string' && payload.length > 0 && payload.trim() === '')) {
          status = 'warning';
          badgeText = 'Defecto de Formato (Espacios)';
          badgeClass = 'res-logic';
          detail = `Se ingresó una cadena compuesta únicamente por espacios en blanco (${payLen} caracteres). El formulario permitió guardarla sin recortar ni requerir texto visible, generando registros vacíos o invisibles.`;
          recommendation = 'Aplicar .trim() obligatorio en frontend y backend antes de evaluar minLength > 0 para impedir el almacenamiento de registros vacíos.';
        } else if (testItem.id === 'txt_zero_width' || (typeof payload === 'string' && /[\u200B-\u200D\uFEFF]/.test(payload))) {
          status = 'warning';
          badgeText = 'Riesgo de Integridad (Spoofing)';
          badgeClass = 'res-integrity';
          detail = `El campo aceptó ${resLen} caracteres incluyendo caracteres invisibles de control Unicode (\\u200B-\\u200D, \\uFEFF). Esto puede facilitar la suplantación visual de identidad o evasión de filtros.`;
          recommendation = 'Filtrar caracteres de control y formato Unicode (rangos \\u200B-\\u200D, \\uFEFF) mediante expresión regular o normalización previa al almacenamiento.';
        } else if (testItem.id === 'txt_15_digits' || (typeof payload === 'string' && /^\d{10,}$/.test(payload) && field.type !== 'number' && field.type !== 'tel')) {
          status = 'warning';
          badgeText = 'Regla de Negocio (Formato)';
          badgeClass = 'res-format';
          detail = `Se ingresó una cadena de ${payLen} dígitos numéricos ('${payload}'). El formulario la aceptó en un campo textual sin verificar regla alfabética ni restricción de tipo de dato.`;
          recommendation = 'Validar formato con expresión regular que restrinja dígitos y exija caracteres alfabéticos para nombres personales o campos lingüísticos.';
        } else if (testItem.id === 'txt_1000' || testItem.id === 'txt_5000' || payLen >= 1000) {
          status = 'risk';
          badgeText = 'Riesgo de Capacidad (DoS / Búfer)';
          badgeClass = 'res-capacity';
          detail = `El formulario aceptó y guardó una carga extensa de ${resLen} caracteres sin aplicar límite maxlength ni validación de longitud máxima en frontend o backend.`;
          recommendation = 'Definir atributo maxlength en HTML y restringir rígidamente en el backend (ej. máximo 100-150 caracteres para nombres o datos breves) para mitigar desbordamientos y denegación de servicio.';
        } else if (testItem.id === 'sec_script' || testItem.id === 'sec_img_onerror' || testItem.id === 'sec_html_tags' || (testItem.category === 'security' && /<[a-z][\s\S]*>/i.test(payload))) {
          status = 'risk';
          badgeText = 'Falta de Filtrado (Riesgo XSS)';
          badgeClass = 'res-risk';
          const sample = payload.length > 32 ? payload.slice(0, 30) + '...' : payload;
          detail = `El campo guardó sintaxis HTML/JavaScript ('${sample}') sin validación de lista blanca (allowlist). Nota técnica: La aceptación en el input no implica XSS ejecutable automático; el riesgo real surge si la aplicación renderiza este contenido en el navegador sin escapado contextual (output encoding).`;
          recommendation = 'Validar caracteres permitidos en el input mediante lista blanca (allowlist) y garantizar sanitización y escapado HTML context-aware al renderizar los datos en el navegador.';
        } else if (testItem.id === 'sec_sql_basic' || (testItem.category === 'security' && /('|--|\bOR\b|\bAND\b)/i.test(payload))) {
          status = 'risk';
          badgeText = 'Falta de Filtrado (Sintaxis SQL)';
          badgeClass = 'res-risk';
          detail = `El formulario aceptó caracteres de sintaxis SQL ('${payload}'). Nota técnica: Aceptar sintaxis SQL en la entrada no implica inyección ejecutable por sí sola; el riesgo existe únicamente si la capa de persistencia concatena sentencias sin consultas preparadas.`;
          recommendation = 'Implementar sentencias preparadas (parameterized queries) o uso estricto de ORM en backend; restringir caracteres de sintaxis SQL innecesarios en la capa de entrada.';
        } else if (testItem.id === 'sec_null_byte' || (typeof payload === 'string' && payload.includes('\u0000'))) {
          status = 'risk';
          badgeText = 'Falta de Filtrado (Null Byte)';
          badgeClass = 'res-risk';
          detail = `El campo aceptó el carácter de terminación nula (\\0). Aunque JavaScript maneja cadenas con terminador nulo, puede truncar cadenas al interactuar con librerías nativas C/C++ o rutas del sistema de archivos en el backend.`;
          recommendation = 'Rechazar o filtrar caracteres de control ASCII (código 0 / \\0) en la capa de validación de entrada antes de procesar o persistir.';
        } else if (testItem.category === 'date') {
          status = 'warning';
          badgeText = 'Fecha Inválida Aceptada';
          badgeClass = 'res-format';
          detail = `El formulario permitió ingresar y guardar la fecha '${payload}', la cual no corresponde a un día o mes válido en el calendario o se encuentra fuera del rango de negocio.`;
          recommendation = 'Utilizar un control nativo con tipo date o implementar validación estricta de calendario (año bisiesto, 28-31 días, meses 1-12) en frontend y backend.';
        } else if (testItem.category === 'number') {
          status = 'warning';
          badgeText = 'Dato No Numérico Aceptado';
          badgeClass = 'res-format';
          detail = `El campo numérico aceptó el valor '${payload}' sin forzar formato numérico ni validar límites.`;
          recommendation = 'Configurar el atributo type="number" o regex de validación numérica, y validar estrictamente en el backend.';
        } else if (testItem.id === 'url_missing_scheme') {
          status = 'warning';
          badgeText = 'Defecto de Formato (Sin Protocolo)';
          badgeClass = 'res-format';
          detail = `Se ingresó la URL '${payload}' sin especificar protocolo (http:// o https://). El sitio la aceptó y guardó directamente.`;
          recommendation = 'Exigir protocolo obligatorio en frontend/backend (ej. https://) o anteponerlo automáticamente antes de guardar para evitar enlaces relativos rotos en la interfaz.';
        } else if (testItem.id === 'url_unencoded_spaces') {
          status = 'warning';
          badgeText = 'Defecto de Sintaxis (RFC 3986)';
          badgeClass = 'res-format';
          detail = `El campo aceptó la dirección '${payload}' con espacios en blanco sin codificar, violando la especificación estándar de URIs RFC 3986.`;
          recommendation = 'Rechazar URLs con espacios o aplicar percent-encoding (%20) automático antes de procesar o almacenar el recurso.';
        } else if (testItem.id === 'url_invalid_domain') {
          status = 'warning';
          badgeText = 'Hostname Malformado';
          badgeClass = 'res-format';
          detail = `El formulario aceptó la dirección '${payload}' con un nombre de host inválido (etiquetas vacías o puntos consecutivos).`;
          recommendation = 'Validar la estructura del hostname mediante el constructor estándar URL o expresiones regulares basadas en RFC 1123.';
        } else if (testItem.id === 'url_xss_javascript' || testItem.id === 'url_data_scheme') {
          status = 'risk';
          badgeText = 'Riesgo de Seguridad (Esquema Peligroso)';
          badgeClass = 'res-risk';
          detail = `El campo aceptó el esquema no seguro ('${payload.slice(0, 20)}...'). Si este enlace es renderizado en una etiqueta <a> o iframe sin filtrado, puede provocar ejecución de scripts (XSS).`;
          recommendation = 'Implementar una lista blanca estricta de esquemas permitidos (únicamente http: y https:) y rechazar explícitamente esquemas como javascript:, data:, vbscript: o file:.';
        } else if (testItem.id === 'url_protocol_relative') {
          status = 'warning';
          badgeText = 'URL Relativa de Protocolo';
          badgeClass = 'res-format';
          detail = `El campo aceptó la sintaxis dependiente de protocolo ('${payload}'). Dependiendo del contexto, puede heredar esquemas inesperados o conectar a destinos imprevistos.`;
          recommendation = 'Normalizar la URL forzando esquema explícito seguro https://.';
        } else if (testItem.id === 'url_internal_ssrf') {
          status = 'warning';
          badgeText = 'Riesgo Potencial SSRF (Host Interno)';
          badgeClass = 'res-capacity';
          detail = `El formulario aceptó una dirección dirigida a la interfaz loopback local o red privada ('${payload}'). Si el backend consulta o descarga recursos de esta URL, existe riesgo de Server-Side Request Forgery (SSRF).`;
          recommendation = 'Si el servidor realiza peticiones fetch/webhook hacia las URLs guardadas, validar y bloquear resolución a IPs locales (127.0.0.1, localhost) y rangos privados RFC 1918.';
        } else if (testItem.id === 'url_excessive_length') {
          status = 'risk';
          badgeText = 'Riesgo de Capacidad (URL Extensa)';
          badgeClass = 'res-capacity';
          detail = `El campo aceptó una URL extensa de ${resLen} caracteres sin aplicar límite razonable de longitud.`;
          recommendation = 'Definir atributo maxlength="2048" en el campo HTML y validar en backend el límite estándar de navegadores y servidores web.';
        } else {
          status = 'risk';
          badgeText = 'Riesgo: Sin Restricción';
          badgeClass = 'res-risk';
          detail = triggerSave 
            ? `El formulario guardó ${resLen} caracteres anómalos ('${payload.slice(0, 25)}...') sin disparar alertas ni validaciones.`
            : `Aceptó ${resLen} caracteres anómalos en el campo sin recortar ni validar.`;
          recommendation = 'Definir reglas de validación en frontend y backend para delimitar los valores permitidos según las especificaciones del campo.';
        }
      } else {
        // Normal, benign, valid test input
        status = 'conforme';
        badgeText = triggerSave ? 'Conforme (Guardado)' : 'Conforme (Aceptado)';
        badgeClass = 'res-conforme';
        detail = `Valor válido aceptado y guardado correctamente por el formulario (${resLen} caracteres).`;
        recommendation = 'Comportamiento estándar y conforme según las reglas de negocio del formulario.';
      }
    }

    return {
      fieldName: field.label || field.selector,
      fieldKey: field.id || field.selector || field.name || field.label,
      fieldType: field.type,
      testItem: testItem,
      input: payload,
      resultingValue: resVal,
      status: status,
      badgeText: badgeText,
      badgeClass: badgeClass,
      detail: detail,
      recommendation: recommendation
    };
  }

  // APPEND ROW TO RESULTS TABLE
  function appendResultRow(result) {
    const tr = document.createElement('tr');
    tr.dataset.status = result.status;
    tr.dataset.fieldName = result.fieldName;
    tr.dataset.fieldKey = result.fieldKey || result.fieldName;

    let displayInput = result.input;
    if (displayInput.length > 28) {
      displayInput = displayInput.slice(0, 25) + '...';
    }

    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(result.fieldName)}</strong>
        <div style="font-size: 9px; color: #94a3b8;">${escapeHtml(result.fieldType)}</div>
      </td>
      <td>
        <div>${escapeHtml(result.testItem.name)}</div>
        <code class="payload-preview" title="Clic para ver completo" style="cursor: pointer;">${escapeHtml(displayInput)}</code>
      </td>
      <td>
        <span class="res-badge ${result.badgeClass}">${escapeHtml(result.badgeText)}</span>
      </td>
      <td class="tech-detail">${escapeHtml(result.detail)}</td>
      <td class="tech-recommendation">${escapeHtml(result.recommendation)}</td>
    `;

    const codeEl = tr.querySelector('code');
    if (codeEl) {
      codeEl.addEventListener('click', () => {
        showViewerModal(result.testItem.name, result.input);
      });
    }

    resultsTbody.appendChild(tr);
    try {
      tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {}
    applyResultsFilter();
  }

  // KPI Counters
  function updateKPICounters() {
    const total = testResults.length;
    const restricted = testResults.filter(r => r.status === 'restricted_save' || r.status === 'restricted_field').length;
    const conforme = testResults.filter(r => r.status === 'conforme').length;
    const risk = testResults.filter(r => r.status === 'risk' || r.status === 'warning').length;

    kpiTotal.innerText = total;
    kpiRestricted.innerText = restricted;
    kpiConforme.innerText = conforme;
    kpiRisk.innerText = risk;
  }

  // Filter results table
  resultsFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      resultsFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      applyResultsFilter();
    });
  });

  filterFieldSelect.addEventListener('change', (e) => {
    activeFieldFilter = e.target.value;
    applyResultsFilter();
  });

  function applyResultsFilter() {
    const rows = resultsTbody.querySelectorAll('tr');
    rows.forEach(r => {
      const status = r.dataset.status;
      const fieldName = r.dataset.fieldName;
      const fieldKey = r.dataset.fieldKey;

      const matchesStatus = 
        activeFilter === 'all' ||
        (activeFilter === 'restricted' && (status === 'restricted_save' || status === 'restricted_field')) ||
        (activeFilter === 'conforme' && status === 'conforme') ||
        (activeFilter === 'truncated' && status === 'truncated') ||
        (activeFilter === 'risk' && (status === 'risk' || status === 'warning'));

      const matchesField = 
        activeFieldFilter === 'all' || 
        fieldName === activeFieldFilter ||
        fieldKey === activeFieldFilter;

      if (matchesStatus && matchesField) {
        r.style.display = '';
      } else {
        r.style.display = 'none';
      }
    });
  }

  btnClearResults.addEventListener('click', () => {
    resultsTbody.innerHTML = '';
    testResults = [];
    updateKPICounters();
    resultsCard.style.display = 'none';
  });

  // EXPORT ENGINE (INCLUDING NOTION READY FORMAT)

  // 1. NOTION NATIVE TABLE CLIPBOARD EXPORT
  btnCopyNotion.addEventListener('click', async () => {
    if (testResults.length === 0) {
      alert('No hay resultados para copiar.');
      return;
    }

    // Build rich HTML table that Notion understands natively
    let htmlTable = `<table><thead><tr>`;
    htmlTable += `<th>Campo</th>`;
    htmlTable += `<th>Tipo</th>`;
    htmlTable += `<th>Prueba / Input</th>`;
    htmlTable += `<th>Resultado</th>`;
    htmlTable += `<th>Detalle del Sitio</th>`;
    htmlTable += `<th>Recomendación</th>`;
    htmlTable += `</tr></thead><tbody>`;

    testResults.forEach(r => {
      const safeInput = r.input.length > 40 ? r.input.slice(0, 37) + '...' : r.input;
      htmlTable += `<tr>`;
      htmlTable += `<td><strong>${escapeHtml(r.fieldName)}</strong></td>`;
      htmlTable += `<td>${escapeHtml(r.fieldType)}</td>`;
      htmlTable += `<td>${escapeHtml(r.testItem.name)}: <code>${escapeHtml(safeInput)}</code></td>`;
      htmlTable += `<td>${escapeHtml(r.badgeText)}</td>`;
      htmlTable += `<td>${escapeHtml(r.detail)}</td>`;
      htmlTable += `<td>${escapeHtml(r.recommendation)}</td>`;
      htmlTable += `</tr>`;
    });

    htmlTable += `</tbody></table>`;

    // Plain text / markdown fallback
    let plainText = `Campo\tTipo\tPrueba / Input\tResultado\tDetalle\tRecomendación\n`;
    testResults.forEach(r => {
      plainText += `${r.fieldName}\t${r.fieldType}\t${r.testItem.name} (${r.input})\t${r.badgeText}\t${r.detail}\t${r.recommendation}\n`;
    });

    try {
      const blobHtml = new Blob([htmlTable], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const clipboardItem = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });

      await navigator.clipboard.write([clipboardItem]);
      alert('¡Tabla formateada copiada con éxito!\n\nVe a tu página en NOTION y presiona Ctrl + V para pegarla como tabla.');
    } catch (err) {
      console.warn('ClipboardItem error, fallback to plain text copy:', err);
      try {
        await navigator.clipboard.writeText(plainText);
        alert('Tabla copiada al portapapeles. Puedes pegarla en Notion con Ctrl + V.');
      } catch (e) {
        prompt('Copia manualmente:', plainText);
      }
    }
  });

  // 2. Markdown Export
  btnCopyMarkdown.addEventListener('click', async () => {
    if (testResults.length === 0) {
      alert('No hay resultados para copiar.');
      return;
    }

    let md = `## Reporte de Validación Multi-Campo Web\n\n`;
    md += `**Campos auditados:** ${selectedFields.map(f => f.label).join(', ')}\n`;
    if (detectedPageForms.length > 1) {
      const nonAll = detectedPageForms.filter(f => f.formIndex !== 'all');
      const formButtons = nonAll.map(f => `${f.title}: ${f.saveButton ? f.saveButton.text : 'Envío nativo'}`).join(' | ');
      md += `**Botones Guardar:** ${formButtons}\n`;
    } else {
      md += `**Botón Guardar:** ${currentSaveButton ? currentSaveButton.text : 'Envío nativo'}\n`;
    }
    md += `**Fecha:** ${new Date().toLocaleString()}\n\n`;
    md += `| Campo | Tipo | Input / Prueba | Resultado | Detalle Observado | Recomendación |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    testResults.forEach(r => {
      const safeInput = r.input.length > 30 ? r.input.slice(0, 27) + '...' : r.input;
      const cleanInput = safeInput.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const cleanDetail = r.detail.replace(/\|/g, '\\|');
      const cleanRec = r.recommendation.replace(/\|/g, '\\|');
      md += `| ${r.fieldName} | ${r.fieldType} | **${r.testItem.name}**: \`${cleanInput}\` | ${r.badgeText} | ${cleanDetail} | ${cleanRec} |\n`;
    });

    try {
      await navigator.clipboard.writeText(md);
      alert('¡Tabla en formato Markdown copiada al portapapeles!');
    } catch (e) {
      prompt('Copia manualmente:', md);
    }
  });

  // 3. CSV Export
  btnExportCsv.addEventListener('click', () => {
    if (testResults.length === 0) {
      alert('No hay resultados para exportar.');
      return;
    }

    const headers = ['Campo', 'Tipo de Campo', 'Prueba', 'Input Probado', 'Resultado', 'Detalle del Sitio', 'Recomendación'];
    const rows = testResults.map(r => [
      `"${r.fieldName.replace(/"/g, '""')}"`,
      `"${(r.fieldType || '').replace(/"/g, '""')}"`,
      `"${r.testItem.name.replace(/"/g, '""')}"`,
      `"${r.input.replace(/"/g, '""').replace(/\n/g, '\\n')}"`,
      `"${r.badgeText.replace(/"/g, '""')}"`,
      `"${r.detail.replace(/"/g, '""')}"`,
      `"${r.recommendation.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_qa_multicampo_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // 4. Printable HTML Report / PDF
  btnPrintReport.addEventListener('click', () => {
    if (testResults.length === 0) {
      alert('No hay resultados para imprimir.');
      return;
    }

    const total = testResults.length;
    const restricted = testResults.filter(r => r.status === 'restricted_save' || r.status === 'restricted_field').length;
    const conforme = testResults.filter(r => r.status === 'conforme').length;
    const risk = testResults.filter(r => r.status === 'risk' || r.status === 'warning').length;

    let rowsHtml = '';
    testResults.forEach(r => {
      const badgeCls = r.badgeClass || 'res-conforme';
      rowsHtml += `
        <tr>
          <td class="col-field">
            <strong>${escapeHtml(r.fieldName)}</strong>
            <div class="field-sub">${escapeHtml(r.fieldType)}</div>
          </td>
          <td class="col-test">
            <div class="test-name">${escapeHtml(r.testItem.name)}</div>
            <code class="payload-code">${escapeHtml(r.input.length > 70 ? r.input.slice(0, 67) + '...' : r.input)}</code>
          </td>
          <td class="col-status">
            <span class="res-badge ${badgeCls}">${escapeHtml(r.badgeText)}</span>
          </td>
          <td class="col-detail">${escapeHtml(r.detail)}</td>
          <td class="col-rec">${escapeHtml(r.recommendation)}</td>
        </tr>
      `;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Informe de Validación QA Multi-Campo</title>
        <style>
          :root {
            --bg-page: #0f172a;
            --bg-card: #1e293b;
            --bg-hover: #273549;
            --border: #334155;
            --text-main: #f8fafc;
            --text-sub: #cbd5e1;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --primary-hover: #2563eb;
          }

          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-page);
            color: var(--text-main);
            line-height: 1.5;
            padding: 28px 24px;
          }

          .report-container {
            max-width: 1200px;
            margin: 0 auto;
          }

          .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
            gap: 16px;
          }

          h1 {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 6px;
          }

          .meta {
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.6;
          }
          .meta strong { color: var(--text-sub); }

          .btn-print {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 9px 18px;
            background: var(--primary);
            color: #ffffff;
            border: 1px solid #60a5fa;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.15s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            white-space: nowrap;
          }
          .btn-print:hover {
            background: var(--primary-hover);
          }
          .btn-print svg {
            width: 15px;
            height: 15px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
          }

          .kpis {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
          }

          .kpi {
            background: var(--bg-card);
            border: 1px solid var(--border);
            padding: 14px 16px;
            border-radius: 8px;
            text-align: center;
          }
          .kpi-val {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 2px;
            color: var(--text-main);
          }
          .kpi-desc {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
          }

          .kpi-restricted {
            border-color: rgba(16, 185, 129, 0.4);
            background: rgba(16, 185, 129, 0.08);
          }
          .kpi-restricted .kpi-val { color: #34d399; }

          .kpi-conforme {
            border-color: rgba(2, 132, 199, 0.4);
            background: rgba(2, 132, 199, 0.08);
          }
          .kpi-conforme .kpi-val { color: #38bdf8; }

          .kpi-risk {
            border-color: rgba(239, 68, 68, 0.4);
            background: rgba(239, 68, 68, 0.08);
          }
          .kpi-risk .kpi-val { color: #f87171; }

          .table-wrap {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            text-align: left;
          }

          thead {
            background: rgba(15, 23, 42, 0.85);
          }

          th {
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
          }

          td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
            color: var(--text-sub);
            line-height: 1.45;
          }

          tr:last-child td {
            border-bottom: none;
          }

          tbody tr:hover {
            background: var(--bg-hover);
          }

          .col-field strong { color: var(--text-main); font-size: 12px; }
          .field-sub { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
          .test-name { font-weight: 600; color: var(--text-main); margin-bottom: 4px; }
          
          .payload-code {
            display: inline-block;
            background: #0f172a;
            border: 1px solid var(--border);
            color: #93c5fd;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            word-break: break-all;
            max-width: 280px;
          }

          .col-rec {
            color: #60a5fa;
            font-size: 11px;
          }

          .res-badge {
            display: inline-flex;
            align-items: center;
            font-size: 10px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 4px;
            white-space: nowrap;
          }

          .res-conforme {
            background: rgba(2, 132, 199, 0.2);
            color: #38bdf8;
            border: 1px solid rgba(2, 132, 199, 0.4);
          }
          .res-restricted-save {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.5);
          }
          .res-restricted-field {
            background: rgba(5, 150, 105, 0.2);
            color: #6ee7b7;
            border: 1px solid rgba(5, 150, 105, 0.5);
          }
          .res-truncated, .res-logic, .res-format {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.45);
          }
          .res-integrity {
            background: rgba(249, 115, 22, 0.2);
            color: #fb923c;
            border: 1px solid rgba(249, 115, 22, 0.45);
          }
          .res-capacity {
            background: rgba(225, 29, 72, 0.2);
            color: #fb7185;
            border: 1px solid rgba(225, 29, 72, 0.45);
          }
          .res-risk {
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.5);
          }
          .res-error {
            background: rgba(168, 85, 247, 0.15);
            color: #c084fc;
            border: 1px solid rgba(168, 85, 247, 0.4);
          }

          /* PRINT MEDIA: PURE WHITE CLEAN THEME FOR PRINT / PDF DOWNLOAD */
          @media print {
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              padding: 0 !important;
            }
            .report-container {
              max-width: 100% !important;
            }
            .no-print, .btn-print {
              display: none !important;
            }
            .report-header {
              border-bottom: 2px solid #cbd5e1 !important;
              margin-bottom: 16px !important;
              padding-bottom: 12px !important;
            }
            h1 {
              color: #0f172a !important;
              font-size: 18px !important;
            }
            .meta {
              color: #475569 !important;
              font-size: 11px !important;
            }
            .meta strong {
              color: #0f172a !important;
            }
            .kpis {
              gap: 8px !important;
              margin-bottom: 16px !important;
            }
            .kpi {
              background: #ffffff !important;
              border: 1px solid #cbd5e1 !important;
              padding: 8px 12px !important;
            }
            .kpi-val {
              color: #0f172a !important;
              font-size: 18px !important;
            }
            .kpi-desc {
              color: #475569 !important;
            }
            .kpi-restricted .kpi-val { color: #15803d !important; }
            .kpi-conforme .kpi-val { color: #0284c7 !important; }
            .kpi-risk .kpi-val { color: #b91c1c !important; }
            .table-wrap {
              border: 1px solid #cbd5e1 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }
            thead {
              background: #f8fafc !important;
            }
            th {
              background: #f8fafc !important;
              border-bottom: 1px solid #cbd5e1 !important;
              color: #334155 !important;
              font-size: 10px !important;
            }
            td {
              border-bottom: 1px solid #e2e8f0 !important;
              color: #1e293b !important;
              font-size: 11px !important;
              padding: 8px 10px !important;
            }
            .col-field strong { color: #0f172a !important; }
            .test-name { color: #0f172a !important; }
            .payload-code {
              background: #f8fafc !important;
              border: 1px solid #cbd5e1 !important;
              color: #1e293b !important;
            }
            .col-rec {
              color: #1d4ed8 !important;
            }
            .res-badge {
              border: 1px solid #94a3b8 !important;
            }
            .res-conforme {
              background: #f0f9ff !important;
              color: #0369a1 !important;
              border-color: #7dd3fc !important;
            }
            .res-restricted-save, .res-restricted-field {
              background: #f0fdf4 !important;
              color: #15803d !important;
              border-color: #86efac !important;
            }
            .res-truncated, .res-logic, .res-format {
              background: #fffbeb !important;
              color: #b45309 !important;
              border-color: #fde68a !important;
            }
            .res-integrity {
              background: #fff7ed !important;
              color: #c2410c !important;
              border-color: #fed7aa !important;
            }
            .res-capacity, .res-risk {
              background: #fef2f2 !important;
              color: #b91c1c !important;
              border-color: #fca5a5 !important;
            }
            .res-error {
              background: #faf5ff !important;
              color: #7e22ce !important;
              border-color: #d8b4fe !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="report-header">
            <div>
              <h1>Informe de Auditoría Multi-Campo</h1>
              <div class="meta">
                <strong>Campos auditados:</strong> ${escapeHtml(selectedFields.map(f => f.label).join(', '))}<br>
                <strong>Fecha de generación:</strong> ${new Date().toLocaleString()}
              </div>
            </div>
            <button onclick="window.print()" class="btn-print no-print">
              <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Imprimir / Guardar PDF
            </button>
          </div>

          <div class="kpis">
            <div class="kpi">
              <div class="kpi-val">${total}</div>
              <div class="kpi-desc">Total Pruebas</div>
            </div>
            <div class="kpi kpi-restricted">
              <div class="kpi-val">${restricted}</div>
              <div class="kpi-desc">Restringidas</div>
            </div>
            <div class="kpi kpi-conforme">
              <div class="kpi-val">${conforme}</div>
              <div class="kpi-desc">Conformes</div>
            </div>
            <div class="kpi kpi-risk">
              <div class="kpi-val">${risk}</div>
              <div class="kpi-desc">Con Riesgo / Observación</div>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Prueba / Input</th>
                  <th>Resultado</th>
                  <th>Detalle del Sitio</th>
                  <th>Recomendación Técnica</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  });

  // CUSTOM PAYLOAD MODAL HANDLERS
  let lastFocusedElement = null;

  function trapFocus(modalEl, e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modalEl.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Global escape key listener for open modals in sidepanel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (customModal && customModal.style.display === 'flex') {
        closeCustomModal();
      } else if (payloadViewerModal && payloadViewerModal.style.display === 'flex') {
        closeViewerModal();
      }
    }
  });

  function openCustomModal() {
    lastFocusedElement = document.activeElement;
    customName.value = '';
    customValue.value = '';
    customDesc.value = '';
    customIsInvalid.checked = true;
    customModal.style.display = 'flex';
    customName.focus();
  }

  function closeCustomModal() {
    customModal.style.display = 'none';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  customModal.addEventListener('keydown', (e) => trapFocus(customModal, e));
  btnOpenCustomModal.addEventListener('click', openCustomModal);
  btnCloseModal.addEventListener('click', closeCustomModal);
  btnCancelCustom.addEventListener('click', closeCustomModal);

  btnSaveCustom.addEventListener('click', async () => {
    const name = customName.value.trim();
    const val = customValue.value;
    const cat = customCategory.value;
    const desc = customDesc.value.trim() || 'Prueba personalizada';
    const isInv = customIsInvalid.checked;

    if (!name || val === undefined) {
      alert('Por favor ingresa un nombre y un valor para la prueba.');
      return;
    }

    const newPayload = {
      id: `custom_${Date.now()}`,
      category: cat,
      name: name,
      payload: val,
      desc: desc,
      isInvalidCase: isInv,
      isCustom: true,
      selected: true
    };

    customPayloads.push(newPayload);
    await saveCustomPayloads();
    closeCustomModal();

    renderPayloads();
  });

  // VIEWER MODAL
  function showViewerModal(title, content) {
    lastFocusedElement = document.activeElement;
    viewerTitle.innerText = title;
    viewerContent.innerText = content;
    payloadViewerModal.style.display = 'flex';
    btnCloseViewer.focus();
  }

  function closeViewerModal() {
    payloadViewerModal.style.display = 'none';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  payloadViewerModal.addEventListener('keydown', (e) => trapFocus(payloadViewerModal, e));
  btnCloseViewer.addEventListener('click', closeViewerModal);
  btnDismissViewer.addEventListener('click', closeViewerModal);

  btnCopyViewer.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(viewerContent.innerText);
      alert('¡Valor copiado al portapapeles!');
    } catch {
      prompt('Copia manualmente:', viewerContent.innerText);
    }
  });

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  await loadCustomPayloads();
  applyDepthTier('normal');
  renderSelectedFields();
});
