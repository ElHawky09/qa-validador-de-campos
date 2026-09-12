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
  let activeFormTitle = '';
  let reopenSteps = [];
  let currentCategory = 'all';
  let activeFilter = 'all';
  let activeFieldFilter = 'all';
  let customPayloads = [];
  let testResults = [];
  let currentDepthTier = 'normal';

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
  const btnPickFormClick = document.getElementById('btn-pick-form-click');
  const pickFormBtnText = document.getElementById('pick-form-btn-text');
  const btnResetAll = document.getElementById('btn-reset-all');

  // Save Button Section DOM
  const saveButtonBox = document.getElementById('save-button-box');
  const saveBtnPill = document.getElementById('save-btn-pill');
  const btnInspectSave = document.getElementById('btn-inspect-save');
  const btnChangeSave = document.getElementById('btn-change-save');
  const changeSaveBtnText = document.getElementById('change-save-btn-text');

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

  // View Toggle and Dashboard DOM
  const btnViewTable = document.getElementById('btn-view-table');
  const btnViewDashboard = document.getElementById('btn-view-dashboard');
  const tableViewContainer = document.getElementById('table-view-container');
  const dashboardViewContainer = document.getElementById('dashboard-view-container');
  const dashboardRiskLevelBadge = document.getElementById('dashboard-risk-level-badge');
  const dashboardScoreVal = document.getElementById('dashboard-score-val');
  const dashboardSummaryMsg = document.getElementById('dashboard-summary-msg');
  const statCriticalCount = document.getElementById('stat-critical-count');
  const statHighCount = document.getElementById('stat-high-count');
  const statMediumCount = document.getElementById('stat-medium-count');
  const statSafeCount = document.getElementById('stat-safe-count');
  const dashboardDistBar = document.getElementById('dashboard-dist-bar');
  const dashboardRiskGroups = document.getElementById('dashboard-risk-groups');

  // Export DOM
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
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
    renderSaveButton();
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
      if (!currentSaveButton && (fieldData.saveButton || fieldData.autoSaveButton)) {
        currentSaveButton = fieldData.saveButton || fieldData.autoSaveButton;
      }
      fieldData.saveButton = currentSaveButton;
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

  // Point-and-click Form Picker (Single Form)
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
      if (pickFormBtnText) pickFormBtnText.innerText = 'Cancelar (ESC)';
      btnPickFormClick.classList.add('btn-outline');
    } else {
      btnPickFormClick.innerHTML = '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg> <span id="pick-form-btn-text">Apuntar formulario</span>';
      btnPickFormClick.classList.remove('btn-outline');
    }
  }

  // Auto-detect single form across the page
  btnAutoDetectForm.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    activeTabId = tab.id;
    await ensureContentScriptInjected(tab.id);

    try {
      const originalText = btnAutoDetectForm.innerHTML;
      btnAutoDetectForm.innerText = 'Detectando...';
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_SINGLE_FORM' });
      btnAutoDetectForm.innerHTML = originalText;

      if (res && res.fields && res.fields.length > 0) {
        activeFormTitle = res.title || 'Formulario';
        res.fields.forEach(f => {
          if (f.fillerValue === undefined) {
            f.fillerValue = f.suggestedFillerValue || 'Dato Válido QA';
          }
        });
        selectedFields = res.fields;
        currentSaveButton = res.saveButton || null;
        renderSelectedFields();
      } else {
        alert('No se encontraron campos de entrada en el formulario de la página activa.');
      }
    } catch (e) {
      console.warn('Error auto-detecting form:', e);
      btnAutoDetectForm.innerHTML = '<svg class="ui-icon ui-icon-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> <span>Detectar formulario</span>';
      alert('Asegúrate de que la página tenga un formulario con campos de entrada.');
    }
  });


  // Single-Form Save Button Logic
  function setButtonPickingState(active) {
    isPickingButtonActive = active;
    renderSaveButton();
  }

  function handleSaveButtonSelected(btnData) {
    currentSaveButton = btnData;
    selectedFields.forEach(f => {
      f.saveButton = btnData;
    });
    renderSaveButton();
  }

  function renderSaveButton() {
    if (!saveButtonBox) return;

    if (selectedFields.length === 0) {
      saveButtonBox.style.display = 'none';
      return;
    }

    saveButtonBox.style.display = 'block';

    if (saveBtnPill) {
      if (currentSaveButton) {
        const text = currentSaveButton.text || currentSaveButton.value || 'Botón Guardar';
        saveBtnPill.className = 'pill pill-save';
        saveBtnPill.innerText = text;
        saveBtnPill.title = text;
      } else {
        saveBtnPill.className = 'pill pill-idle';
        saveBtnPill.innerText = 'Auto / No asignado';
        saveBtnPill.title = 'Se detectará automáticamente al iniciar pruebas o haz clic en "Cambiar botón"';
      }
    }

    if (btnInspectSave) {
      if (currentSaveButton) {
        btnInspectSave.disabled = false;
        btnInspectSave.style.display = 'inline-flex';
      } else {
        btnInspectSave.disabled = true;
        btnInspectSave.style.display = 'none';
      }
    }

    if (btnChangeSave) {
      if (isPickingButtonActive) {
        btnChangeSave.classList.add('btn-primary');
        btnChangeSave.classList.remove('btn-outline');
        if (changeSaveBtnText) changeSaveBtnText.innerText = 'Cancelar (ESC)';
      } else {
        btnChangeSave.classList.remove('btn-primary');
        btnChangeSave.classList.add('btn-outline');
        if (changeSaveBtnText) changeSaveBtnText.innerText = 'Cambiar botón';
      }
    }
  }

  if (btnInspectSave) {
    btnInspectSave.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (tab?.id && currentSaveButton) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'HIGHLIGHT_SAVE_BUTTON',
          saveButtonInfo: currentSaveButton
        });
      }
    });
  }

  if (btnChangeSave) {
    btnChangeSave.addEventListener('click', async () => {
      if (isPickingButtonActive) {
        setButtonPickingState(false);
        const tab = await getActiveTab();
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
        }
      } else {
        setButtonPickingState(true);
        const tab = await getActiveTab();
        if (tab?.id) {
          activeTabId = tab.id;
          await ensureContentScriptInjected(tab.id);
          chrome.tabs.sendMessage(tab.id, {
            action: 'START_PICKING_BUTTON',
            formTitle: activeFormTitle || 'Formulario'
          });
        }
      }
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
        activeFormTitle = formData.title || 'Formulario';
        formData.fields.forEach(f => {
          if (f.fillerValue === undefined) {
            f.fillerValue = f.suggestedFillerValue || 'Dato Válido QA';
          }
        });
        selectedFields = [...formData.fields];
        currentSaveButton = formData.saveButton || null;
        renderSelectedFields();
      } else {
        alert('El formulario o sector seleccionado no contiene campos válidos.');
      }
    } else if (message.action === 'SAVE_BUTTON_SELECTED') {
      setButtonPickingState(false);
      handleSaveButtonSelected(message.data);
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
      activeFormTitle = '';
      reopenSteps = [];
      currentSaveButton = null;
      if (checkEnableReopen) checkEnableReopen.checked = false;
      if (reopenStepsContent) reopenStepsContent.style.display = 'none';
      renderSelectedFields();
      renderReopenSteps();
      resultsCard.style.display = 'none';
      testResults = [];
      resetDashboardState();
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

    btnRunTests.disabled = true;
    btnPickField.disabled = true;
    btnAutoDetectForm.disabled = true;
    if (btnChangeSave) btnChangeSave.disabled = true;
    if (btnInspectSave) btnInspectSave.disabled = true;
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
      const formPrefix = task.field.formTitle ? `[${task.field.formTitle}] ` : '';
      progressLabel.innerText = `(${completed}/${testQueue.length}) ${formPrefix}[${task.field.label}]: ${task.testItem.name}...`;

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
        // Pre-fill valid dummy data in sibling fields so they don't block the save!
        const siblingFields = selectedFields.filter(f => f !== task.field);
        const siblingFillers = shouldFillSiblings ? siblingFields.map(f => ({
          fieldInfo: f,
          value: (f.fillerValue !== undefined ? f.fillerValue : f.suggestedFillerValue) || 'Dato Válido QA'
        })) : [];

        const targetSaveButton = currentSaveButton || task.field.saveButton || null;


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
          if (btnChangeSave) btnChangeSave.disabled = false;
          if (btnInspectSave) btnInspectSave.disabled = !currentSaveButton;
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
    if (btnChangeSave) btnChangeSave.disabled = false;
    if (btnInspectSave) btnInspectSave.disabled = !currentSaveButton;
    runBtnText.innerText = `Volver a Iniciar (${selectedFields.length} campos)`;
    renderDashboardView();
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
      formTitle: field.formTitle || '',
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
        <div style="font-size: 9px; color: #94a3b8;">${result.formTitle ? `${escapeHtml(result.formTitle)} • ` : ''}${escapeHtml(result.fieldType)}</div>
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
    resetDashboardState();
    resultsCard.style.display = 'none';
  });

  // =========================================================================
  // RISK TAXONOMY & DASHBOARD ENGINE
  // =========================================================================

  function categorizeTestRisk(r) {
    const item = r.testItem || {};
    const itemId = item.id || '';
    const itemCat = item.category || '';
    const payload = typeof r.input === 'string' ? r.input : String(r.input || '');
    const isAnomalous = r.status === 'risk' || r.status === 'warning' || r.status === 'error';

    // If result was restricted, truncated, or conforme, it belongs to Effective Defenses
    if (!isAnomalous) {
      return {
        key: 'conforme',
        title: 'Validaciones Efectivas y Casos Conformes',
        severity: 'SEGURO',
        severityClass: 'cat-safe',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        desc: 'Validaciones donde el campo o el servidor demostraron defensas activas (bloqueo al guardar, recorte por longitud o procesamiento conforme).'
      };
    }

    // 1. Seguridad e Inyecciones (Crítico / Alto)
    if (
      itemCat === 'security' ||
      itemId === 'url_xss_javascript' ||
      itemId === 'url_data_scheme' ||
      itemId === 'sec_script' ||
      itemId === 'sec_img_onerror' ||
      itemId === 'sec_html_tags' ||
      itemId === 'sec_sql_basic' ||
      itemId === 'sec_null_byte' ||
      /<[a-z][\s\S]*>/i.test(payload) ||
      payload.includes('\u0000') ||
      r.badgeClass === 'res-risk'
    ) {
      return {
        key: 'security',
        title: 'Seguridad e Inyecciones',
        severity: 'CRÍTICO',
        severityClass: 'cat-critical',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
        desc: 'Vectores de XSS, sintaxis SQL, caracteres nulos o esquemas ejecutables aceptados sin lista blanca ni filtrado.'
      };
    }

    // 2. Capacidad y Resistencia DoS (Alto)
    if (
      itemId === 'txt_1000' ||
      itemId === 'txt_5000' ||
      itemId === 'url_excessive_length' ||
      r.badgeClass === 'res-capacity' ||
      payload.length >= 1000
    ) {
      return {
        key: 'capacity',
        title: 'Capacidad y Resistencia DoS',
        severity: 'ALTO',
        severityClass: 'cat-high',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
        desc: 'Cargas masivas de texto y URLs de longitud excesiva sin límite maxlength ni control de tamaño en el backend.'
      };
    }

    // 3. Integridad y Spoofing Unicode (Medio)
    if (
      itemId === 'txt_zero_width' ||
      itemId.startsWith('emo_') ||
      itemId.startsWith('uni_') ||
      r.badgeClass === 'res-integrity' ||
      /[\u200B-\u200D\uFEFF]/.test(payload)
    ) {
      return {
        key: 'integrity',
        title: 'Integridad y Spoofing Unicode',
        severity: 'MEDIO',
        severityClass: 'cat-medium',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
        desc: 'Caracteres invisibles Unicode o de control capaces de evadir validaciones visuales o propiciar suplantación.'
      };
    }

    // 4. Lógica de Negocio y Reglas de Formato (Medio / Bajo)
    return {
      key: 'format_logic',
      title: 'Lógica de Negocio y Formato',
      severity: 'MEDIO',
      severityClass: 'cat-medium',
      iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
      desc: 'Omisión de recorte de espacios (trim), formato alfabético, calendarios de fecha o sintaxis estándar RFC.'
    };
  }

  function renderDashboardView() {
    if (!dashboardViewContainer || !dashboardRiskGroups) return;
    if (testResults.length === 0) {
      dashboardRiskGroups.innerHTML = `
        <div class="empty-notice" style="margin: 10px 0;">
          No hay resultados evaluados aún. Ejecuta la verificación para generar el dashboard.
        </div>
      `;
      if (dashboardScoreVal) dashboardScoreVal.innerText = '--%';
      if (dashboardRiskLevelBadge) {
        dashboardRiskLevelBadge.className = 'badge badge-idle';
        dashboardRiskLevelBadge.innerText = 'Sin pruebas';
      }
      return;
    }

    const total = testResults.length;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let safeCount = 0;

    const grouped = {
      security: [],
      capacity: [],
      integrity: [],
      format_logic: [],
      conforme: []
    };

    testResults.forEach(r => {
      const cat = categorizeTestRisk(r);
      grouped[cat.key].push(r);

      if (cat.key === 'security') criticalCount++;
      else if (cat.key === 'capacity') highCount++;
      else if (cat.key === 'integrity' || cat.key === 'format_logic') mediumCount++;
      else if (cat.key === 'conforme') safeCount++;
    });

    const score = Math.max(0, Math.min(100, Math.round((safeCount / total) * 100)));

    if (dashboardScoreVal) {
      dashboardScoreVal.innerText = `${score}%`;
    }

    if (dashboardRiskLevelBadge) {
      if (criticalCount > 0) {
        dashboardRiskLevelBadge.className = 'badge badge-danger';
        dashboardRiskLevelBadge.innerText = 'Riesgo Crítico';
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#f87171';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `Se detectaron <strong>${criticalCount} anomalía(s) de seguridad</strong>. Requiere revisión prioritaria de filtrado y escapado.`;
        }
      } else if (highCount > 0) {
        dashboardRiskLevelBadge.className = 'badge badge-warning';
        dashboardRiskLevelBadge.innerText = 'Riesgo Alto (DoS)';
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#fb7185';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `El formulario admitió sobrecargas extensas sin límite maxlength. Riesgo de degradación o desbordamiento.`;
        }
      } else if (mediumCount > 0) {
        dashboardRiskLevelBadge.className = 'badge badge-warning';
        dashboardRiskLevelBadge.innerText = 'Riesgo Moderado';
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#fbbf24';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `Validaciones funcionales incompletas (espacios en blanco, formato numérico o caracteres Unicode).`;
        }
      } else {
        dashboardRiskLevelBadge.className = 'badge badge-active';
        dashboardRiskLevelBadge.innerText = 'Formulario Robusto';
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#34d399';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `¡Excelente! Todas las pruebas evaluadas fueron restringidas al guardar o cumplieron el comportamiento esperado.`;
        }
      }
    }

    if (statCriticalCount) statCriticalCount.innerText = `${criticalCount} Críticos`;
    if (statHighCount) statHighCount.innerText = `${highCount} Altos`;
    if (statMediumCount) statMediumCount.innerText = `${mediumCount} Medios`;
    if (statSafeCount) statSafeCount.innerText = `${safeCount} Seguros`;

    if (dashboardDistBar) {
      const pCrit = total > 0 ? (criticalCount / total) * 100 : 0;
      const pHigh = total > 0 ? (highCount / total) * 100 : 0;
      const pMed = total > 0 ? (mediumCount / total) * 100 : 0;
      const pSafe = total > 0 ? (safeCount / total) * 100 : 0;

      const segCrit = dashboardDistBar.querySelector('.seg-critical');
      const segHigh = dashboardDistBar.querySelector('.seg-high');
      const segMed = dashboardDistBar.querySelector('.seg-medium');
      const segSafe = dashboardDistBar.querySelector('.seg-safe');

      if (segCrit) { segCrit.style.width = `${pCrit}%`; segCrit.title = `Seguridad: ${criticalCount} (${Math.round(pCrit)}%)`; }
      if (segHigh) { segHigh.style.width = `${pHigh}%`; segHigh.title = `Capacidad DoS: ${highCount} (${Math.round(pHigh)}%)`; }
      if (segMed) { segMed.style.width = `${pMed}%`; segMed.title = `Integridad/Formato: ${mediumCount} (${Math.round(pMed)}%)`; }
      if (segSafe) { segSafe.style.width = `${pSafe}%`; segSafe.title = `Conformes: ${safeCount} (${Math.round(pSafe)}%)`; }
    }

    dashboardRiskGroups.innerHTML = '';

    const categoriesDef = [
      { key: 'security', title: '1. Seguridad e Inyecciones', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>', severity: 'CRÍTICO', severityClass: 'cat-critical' },
      { key: 'capacity', title: '2. Capacidad y Resistencia DoS', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>', severity: 'ALTO', severityClass: 'cat-high' },
      { key: 'integrity', title: '3. Integridad y Spoofing Unicode', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', severity: 'MEDIO', severityClass: 'cat-medium' },
      { key: 'format_logic', title: '4. Lógica de Negocio y Formato', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>', severity: 'MEDIO', severityClass: 'cat-medium' },
      { key: 'conforme', title: '5. Validaciones Efectivas y Conformes', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>', severity: 'SEGURO', severityClass: 'cat-safe' }
    ];

    categoriesDef.forEach(catDef => {
      const items = grouped[catDef.key] || [];
      const count = items.length;
      if (count === 0 && catDef.key !== 'conforme') return;

      const card = document.createElement('div');
      const shouldAutoExpand = count > 0 && catDef.key !== 'conforme';
      card.className = `risk-category-card ${catDef.severityClass} ${shouldAutoExpand ? 'expanded' : ''}`;

      let findingsHtml = '';
      if (count === 0) {
        findingsHtml = `<div style="font-size: 10px; color: var(--text-muted); font-style: italic;">Sin incidencias registradas en esta categoría.</div>`;
      } else {
        items.forEach(r => {
          const safeInput = r.input.length > 55 ? r.input.slice(0, 52) + '...' : r.input;
          findingsHtml += `
            <div class="risk-finding-item">
              <div class="finding-field-row">
                <span class="finding-field-name">${escapeHtml(r.fieldName)} <span style="font-size: 9px; color: var(--text-muted);">(${escapeHtml(r.fieldType)})</span></span>
                <span class="res-badge ${r.badgeClass}">${escapeHtml(r.badgeText)}</span>
              </div>
              <div style="margin: 2px 0;">
                <span style="font-size: 9px; color: var(--text-muted); font-weight: 600;">Prueba:</span>
                <code class="finding-payload" title="${escapeHtml(r.input)}">${escapeHtml(safeInput)}</code>
              </div>
              <div class="finding-detail">${escapeHtml(r.detail)}</div>
              <div class="finding-rec">
                <strong>Recomendación:</strong> ${escapeHtml(r.recommendation)}
              </div>
            </div>
          `;
        });
      }

      card.innerHTML = `
        <div class="risk-category-header" role="button" tabindex="0" aria-expanded="${shouldAutoExpand}">
          <div class="risk-cat-title-wrap">
            ${catDef.icon}
            <span>${escapeHtml(catDef.title)}</span>
          </div>
          <div class="risk-cat-badges">
            <span class="mini-tag tag-${catDef.severity === 'CRÍTICO' ? 'critical' : catDef.severity === 'ALTO' ? 'high' : catDef.severity === 'MEDIO' ? 'medium' : 'safe'}">
              ${count} ${catDef.key === 'conforme' ? 'conformes' : count === 1 ? 'incidencia' : 'incidencias'}
            </span>
            <span class="risk-cat-chevron">&#9660;</span>
          </div>
        </div>
        <div class="risk-category-body">
          ${findingsHtml}
        </div>
      `;

      const header = card.querySelector('.risk-category-header');
      header.addEventListener('click', () => {
        const isExp = card.classList.toggle('expanded');
        header.setAttribute('aria-expanded', String(isExp));
      });

      dashboardRiskGroups.appendChild(card);
    });

    const structuredData = getStructuredAuditData();
    if (structuredData && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ qa_audit_dashboard_data: structuredData });
    }
  }

  function resetDashboardState() {
    switchResultsView('table');
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove(['qa_audit_dashboard_data']);
    }
    if (dashboardRiskGroups) dashboardRiskGroups.innerHTML = '';
    if (dashboardDistBar) {
      dashboardDistBar.querySelectorAll('.dist-seg').forEach(s => s.style.width = '0%');
    }
    if (dashboardScoreVal) dashboardScoreVal.innerText = '--%';
    if (dashboardRiskLevelBadge) {
      dashboardRiskLevelBadge.className = 'badge badge-idle';
      dashboardRiskLevelBadge.innerText = 'Sin pruebas';
    }
    if (statCriticalCount) statCriticalCount.innerText = '0 Críticos';
    if (statHighCount) statHighCount.innerText = '0 Altos';
    if (statMediumCount) statMediumCount.innerText = '0 Medios';
    if (statSafeCount) statSafeCount.innerText = '0 Seguros';
    if (dashboardSummaryMsg) {
      dashboardSummaryMsg.innerText = 'Inicia las pruebas para ver el análisis de riesgo estructurado.';
    }
    if (dashboardScoreVal?.parentElement) {
      dashboardScoreVal.parentElement.style.borderColor = 'var(--primary)';
    }
  }

  function switchResultsView(viewMode) {
    if (viewMode === 'dashboard') {
      if (btnViewTable) {
        btnViewTable.classList.remove('active');
        btnViewTable.setAttribute('aria-selected', 'false');
      }
      if (btnViewDashboard) {
        btnViewDashboard.classList.add('active');
        btnViewDashboard.setAttribute('aria-selected', 'true');
      }
      if (tableViewContainer) tableViewContainer.style.display = 'none';
      if (dashboardViewContainer) dashboardViewContainer.style.display = 'block';
      renderDashboardView();
    } else {
      if (btnViewDashboard) {
        btnViewDashboard.classList.remove('active');
        btnViewDashboard.setAttribute('aria-selected', 'false');
      }
      if (btnViewTable) {
        btnViewTable.classList.add('active');
        btnViewTable.setAttribute('aria-selected', 'true');
      }
      if (dashboardViewContainer) dashboardViewContainer.style.display = 'none';
      if (tableViewContainer) tableViewContainer.style.display = 'block';
      applyResultsFilter();
    }
  }

  if (btnViewTable) {
    btnViewTable.addEventListener('click', () => switchResultsView('table'));
  }
  if (btnViewDashboard) {
    btnViewDashboard.addEventListener('click', () => switchResultsView('dashboard'));
  }

  // Helper to extract structured audit data for the Dashboard & Storage
  function getStructuredAuditData() {
    if (testResults.length === 0) return null;

    const total = testResults.length;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let safeCount = 0;

    const grouped = {
      security: [],
      capacity: [],
      integrity: [],
      format_logic: [],
      conforme: []
    };

    testResults.forEach(r => {
      const cat = categorizeTestRisk(r);
      grouped[cat].push(r);
      if (r.status === 'conforme' || r.status === 'restricted_save' || r.status === 'restricted_field') {
        safeCount++;
      } else if (cat === 'security') {
        criticalCount++;
      } else if (cat === 'capacity') {
        highCount++;
      } else {
        mediumCount++;
      }
    });

    const penalty = (criticalCount * 25) + (highCount * 15) + (mediumCount * 5);
    const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / (total || 1)) * 20)));

    let overallLevel = 'Saludable';
    let overallMessage = 'El formulario cuenta con defensas preventivas efectivas ante la mayoría de pruebas.';
    if (criticalCount > 0) {
      overallLevel = 'Riesgo Crítico';
      overallMessage = 'Se detectaron fallos críticos de validación en la capa de entrada (inyección de scripts/SQL/nulos).';
    } else if (highCount > 0) {
      overallLevel = 'Riesgo Alto';
      overallMessage = 'El formulario admitió entradas masivas sin maxlength preventivo ni control de longitud. Riesgo DoS.';
    } else if (mediumCount > 0) {
      overallLevel = 'Riesgo Moderado';
      overallMessage = 'Se observaron inconsistencias en recorte de espacios, sintaxis o reglas de formato.';
    }

    const pCrit = total > 0 ? Number(((criticalCount / total) * 100).toFixed(1)) : 0;
    const pHigh = total > 0 ? Number(((highCount / total) * 100).toFixed(1)) : 0;
    const pMed = total > 0 ? Number(((mediumCount / total) * 100).toFixed(1)) : 0;
    const pSafe = total > 0 ? Number(((safeCount / total) * 100).toFixed(1)) : 0;

    const categoriesDef = [
      { key: 'security', title: '1. Seguridad e Inyecciones', desc: 'Vectores de XSS, inyección SQL, terminación nula y esquemas ejecutables.', severity: 'CRÍTICO', color: '#f87171', borderLeft: '#f87171' },
      { key: 'capacity', title: '2. Capacidad y Resistencia DoS', desc: 'Sobrecargas masivas de texto y URLs de longitud excesiva sin maxlength.', severity: 'ALTO', color: '#fb7185', borderLeft: '#fb7185' },
      { key: 'integrity', title: '3. Integridad y Spoofing Unicode', desc: 'Caracteres invisibles de ancho cero, secuencias compuestas y evasión de filtros.', severity: 'MEDIO', color: '#fbbf24', borderLeft: '#fbbf24' },
      { key: 'format_logic', title: '4. Lógica de Negocio y Formato', desc: 'Recorte de espacios, validación numérica, calendarios y sintaxis RFC.', severity: 'MEDIO', color: '#fbbf24', borderLeft: '#fbbf24' },
      { key: 'conforme', title: '5. Validaciones Efectivas y Conformes', desc: 'Casos rechazados con éxito por el validador, truncados por límite o datos conformes.', severity: 'SEGURO', color: '#34d399', borderLeft: '#34d399' }
    ];

    return {
      formulario: activeFormTitle || 'Formulario Principal',
      fecha: new Date().toISOString(),
      fechaFormateada: new Date().toLocaleString(),
      camposAuditados: selectedFields.map(f => ({ label: f.label, type: f.type, name: f.name })),
      totalPruebas: total,
      robustezScore: score,
      overallLevel: overallLevel,
      overallMessage: overallMessage,
      metricas: {
        criticos: criticalCount,
        altos: highCount,
        medios: mediumCount,
        seguros: safeCount
      },
      porcentajes: {
        criticos: pCrit,
        altos: pHigh,
        medios: pMed,
        seguros: pSafe
      },
      categorias: categoriesDef.map(cat => ({
        key: cat.key,
        title: cat.title,
        desc: cat.desc,
        severity: cat.severity,
        color: cat.color,
        borderLeft: cat.borderLeft,
        findings: (grouped[cat.key] || []).map(r => ({
          fieldName: r.fieldName,
          fieldType: r.fieldType,
          testName: r.testItem?.name || 'Prueba',
          input: r.input,
          badgeText: r.badgeText,
          badgeClass: r.badgeClass,
          status: r.status,
          detail: r.detail,
          recommendation: r.recommendation
        }))
      })),
      resultados: testResults.map(r => ({
        fieldName: r.fieldName,
        fieldType: r.fieldType,
        testName: r.testItem?.name || 'Prueba',
        input: r.input,
        badgeText: r.badgeText,
        badgeClass: r.badgeClass,
        status: r.status,
        categoryKey: categorizeTestRisk(r),
        detail: r.detail,
        recommendation: r.recommendation
      }))
    };
  }

  // Standalone Full-Page Dashboard Window Generator
  if (btnOpenDashboard) {
    btnOpenDashboard.addEventListener('click', async () => {
      if (testResults.length === 0) {
        alert('No hay resultados para mostrar en el Dashboard. Inicia la verificación de campos primero.');
        return;
      }

      const auditData = getStructuredAuditData();
      if (auditData && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ qa_audit_dashboard_data: auditData });
      }

      const dashboardUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('dashboard/dashboard.html')
        : 'dashboard/dashboard.html';

      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: dashboardUrl });
      } else {
        window.open(dashboardUrl, '_blank');
      }
    });
  }


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
    md += `**Botón Guardar:** ${currentSaveButton ? (currentSaveButton.text || currentSaveButton.value) : 'Envío nativo / No asignado'}\n`;
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
  btnPrintReport.addEventListener('click', async () => {
    if (testResults.length === 0) {
      alert('No hay resultados para imprimir.');
      return;
    }

    const auditData = getStructuredAuditData();
    if (auditData && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ qa_audit_dashboard_data: auditData });
    }

    const reportUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('dashboard/dashboard.html?autoPrint=true')
      : 'dashboard/dashboard.html?autoPrint=true';

    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: reportUrl });
    } else {
      window.open(reportUrl, '_blank');
    }
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
