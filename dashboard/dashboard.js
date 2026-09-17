// =================================================================================================
// ARCHIVO: dashboard/dashboard.js
// PROPÓSITO: Controlador lógico principal para la página del Dashboard Ejecutivo de Auditoría QA.
// COMPATIBILIDAD: Chrome Extension Manifest V3 (ejecutado en su propia pestaña o ventana completa).
//
// ¿QUÉ HACE ESTE ARCHIVO?
// 1. Lee los resultados estructurados de las pruebas almacenados por el Sidepanel.
// 2. Gestiona el ciclo de vida de la vista (inicialización, actualización reactiva, filtros y búsqueda).
// 3. Renderiza métricas ejecutivas (Índice de resiliencia heurística, tarjetas KPI de severidad).
// 4. Dibuja un gráfico circular Donut SVG matemáticamente calibrado y tarjetas de barras detalladas.
// 5. Genera acordeones interactivos colapsables por categoría de riesgo.
// 6. Construye la tabla detallada de hallazgos para inspección técnica exhaustiva.
// 7. Facilita la exportación directa a JSON y la impresión/guardado en PDF.
// =================================================================================================

// -------------------------------------------------------------------------------------------------
// VARIABLES DE ESTADO GLOBAL
// Estas variables mantienen el estado de la aplicación en memoria mientras la pestaña esté abierta.
// -------------------------------------------------------------------------------------------------

// "currentAuditData": Almacena el objeto JSON completo con los resultados de la auditoría (o null si está vacío).
let currentAuditData = null;

// "activeFilter": Almacena la categoría de filtro seleccionada por el usuario ('all', 'security', 'capacity', etc.).
let activeFilter = 'all';

// "currentSearchTerm": Almacena el texto actual que el usuario escribe en el campo de búsqueda en tiempo real.
let currentSearchTerm = '';

// -------------------------------------------------------------------------------------------------
// EVENTO: DOMContentLoaded
// ¿QUÉ HACE?
// Se ejecuta cuando el navegador ha terminado de analizar el documento HTML y el árbol de nodos DOM está listo.
// Es el punto de entrada estándar para ejecutar JavaScript de interfaz de usuario de forma segura.
// -------------------------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initDashboard(); // Inicia la configuración y la carga de datos del dashboard.
});

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: initDashboard()
// ¿QUÉ HACE?
// Centraliza el proceso de inicialización: conecta los eventos de botones y buscador, carga los datos
// de la auditoría y se suscribe a actualizaciones en tiempo real si el usuario ejecuta más pruebas en el sidepanel.
// -------------------------------------------------------------------------------------------------
function initDashboard() {
  // 1. Conectar escuchas de eventos en la interfaz (botones de clic, campos de texto, filtros)
  setupUIEventListeners();

  // 2. Cargar datos desde el almacenamiento local
  loadAuditData();

  // 3. Suscripción reactiva a cambios mediante chrome.storage.onChanged
  // Si el auditor ejecuta una nueva prueba en el panel lateral mientras tiene esta pestaña abierta,
  // el dashboard detecta el nuevo valor y se redibuja automáticamente sin requerir recargar la página (F5).
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      // Validamos que el cambio ocurra en el almacenamiento 'local' y que la clave modificada sea 'qa_audit_dashboard_data'
      if (area === 'local' && changes.qa_audit_dashboard_data?.newValue) {
        currentAuditData = changes.qa_audit_dashboard_data.newValue;
        // Redibujamos toda la vista con los nuevos datos entrantes
        renderDashboard(currentAuditData);
      }
    });
  }
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: loadAuditData()
// ¿QUÉ HACE?
// Implementa una estrategia de almacenamiento de alta fiabilidad:
// 1° Intenta leer desde "chrome.storage.local" (canal principal de extensiones).
// 2° Si falla o no está disponible, lee de "localStorage" como mecanismo de contingencia (fallback).
// 3° Si no hay datos, muestra una pantalla de bienvenida amigable ("Sin auditoría activa").
// 4° Si la URL contiene "?autoPrint=true", dispara automáticamente el cuadro de impresión PDF.
// -------------------------------------------------------------------------------------------------
function loadAuditData() {

  // Función interna para validar y proyectar los datos sobre la interfaz
  function applyData(data) {
    if (data && (data.totalPruebas !== undefined || data.resultados)) {
      currentAuditData = data;
      renderDashboard(currentAuditData);

      // Comprobamos los parámetros de la URL para detectar si se solicitó impresión automática
      // "window.location.search": Obtiene la cadena de consulta (query string, ej: "?autoPrint=true")
      const params = new URLSearchParams(window.location.search);
      if (params.get('autoPrint') === 'true') {
        // "setTimeout": Da un breve margen de 500ms para que el DOM y los estilos se rendericen antes de imprimir
        setTimeout(() => {
          window.print();
        }, 500);
      }
      return true; // Indica que se cargaron datos válidos
    }
    return false; // Indica que los datos estaban vacíos o mal estructurados
  }

  let loaded = false; // Bandera booleana para evitar lecturas duplicadas

  // INTENTO 1: chrome.storage.local (Asíncrono)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['qa_audit_dashboard_data'], (result) => {
      if (result && result.qa_audit_dashboard_data) {
        loaded = true;
        applyData(result.qa_audit_dashboard_data);
      } else {
        // Si no se encontró en chrome.storage, acudimos a localStorage
        checkLocalStorage();
      }
    });
  } else {
    // Si la API chrome.storage no está presente en el entorno, acudimos a localStorage
    checkLocalStorage();
  }

  // INTENTO 2: localStorage (Síncrono)
  function checkLocalStorage() {
    if (loaded) return; // Si ya se cargó, no hacemos nada
    try {
      const raw = localStorage.getItem('qa_audit_dashboard_data');
      if (raw) {
        // "JSON.parse": Convierte el texto guardado en un objeto JavaScript operable
        const parsed = JSON.parse(raw);
        if (applyData(parsed)) {
          loaded = true;
          return;
        }
      }
    } catch (e) {
      // Capturamos cualquier error en caso de que el JSON esté corrupto
      console.warn('Error leyendo localStorage:', e);
    }
    // Si no hubo datos en ninguna fuente, mostramos la pantalla vacía
    showEmptyState();
  }
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: showEmptyState()
// ¿QUÉ HACE?
// Muestra el contenedor informativo cuando no se ha ejecutado ninguna prueba todavía,
// y oculta la estructura principal del dashboard.
// -------------------------------------------------------------------------------------------------
function showEmptyState() {
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('dash-meta-info').innerText = 'Sin auditoría activa';
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: setupUIEventListeners()
// ¿QUÉ HACE?
// Asigna los escuchadores de eventos a todos los controles interactivos de la página:
// - Botón de copiar JSON
// - Botón de imprimir / PDF
// - Campo de búsqueda textual reactiva
// - Botones de píldoras de filtrado por categoría
// - Botones para alternar entre vista de Acordeones y vista de Tabla
// -------------------------------------------------------------------------------------------------
function setupUIEventListeners() {
  // Botón "Copiar JSON"
  const btnCopyJson = document.getElementById('btn-copy-json');
  if (btnCopyJson) {
    btnCopyJson.addEventListener('click', handleCopyJson);
  }

  // Botón "Imprimir / PDF"
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  if (btnPrintPdf) {
    btnPrintPdf.addEventListener('click', () => {
      window.print(); // Invoca el diálogo nativo de impresión del sistema operativo (genera exclusivamente el formato de categorías).
    });
  }

  // Campo de entrada de búsqueda en tiempo real
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    // "input": Se dispara inmediatamente cada vez que el usuario teclea o borra una letra
    searchInput.addEventListener('input', (e) => {
      // "toLowerCase()": Convierte a minúsculas para comparaciones insensibles a mayúsculas
      // "trim()": Remueve espacios accidentales al inicio y al final
      currentSearchTerm = e.target.value.toLowerCase().trim();
      applyFiltersAndSearch();
    });
  }

  // Píldoras de filtro por categoría (Todos, Seguridad, Capacidad, Integridad, Lógica, Conformes)
  const pillBtns = document.querySelectorAll('.pill-btn');
  pillBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Quitamos la clase 'active' de todas las píldoras
      pillBtns.forEach((b) => b.classList.remove('active'));
      // Añadimos la clase 'active' únicamente a la píldora presionada
      btn.classList.add('active');
      // Leemos el atributo data-filter configurado en el HTML
      activeFilter = btn.getAttribute('data-filter') || 'all';
      // Aplicamos el filtro sobre acordeones y tabla
      applyFiltersAndSearch();
    });
  });

  // Conmutador de vista: "Categorías" vs "Tabla"
  const btnViewCategories = document.getElementById('btn-view-categories');
  const btnViewTable = document.getElementById('btn-view-table');
  const categoriesView = document.getElementById('categories-view-container');
  const tableView = document.getElementById('table-view-container');

  if (btnViewCategories && btnViewTable) {
    // Clic en pestaña "Categorías"
    btnViewCategories.addEventListener('click', () => {
      btnViewCategories.classList.add('active');
      btnViewTable.classList.remove('active');
      categoriesView.style.display = 'block';
      tableView.style.display = 'none';
    });

    // Clic en pestaña "Tabla"
    btnViewTable.addEventListener('click', () => {
      btnViewTable.classList.add('active');
      btnViewCategories.classList.remove('active');
      categoriesView.style.display = 'none';
      tableView.style.display = 'block';
    });
  }
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: renderDashboard(data)
// ¿QUÉ HACE?
// Es el motor central de dibujo del dashboard. Toma el objeto "data" recibido y actualiza:
// 1. Metadatos del encabezado (Nombre del formulario, campos auditados, fecha y total de pruebas).
// 2. Tarjetas KPI ejecutivas (Índice de resiliencia heurística, conteos de severidad con código de color dinámico).
// 3. Distribución visual especializada (Barra de espectro, Donut Chart SVG y Tarjetas de Barras).
// 4. Secciones de categorías de riesgo (Acordeones colapsables con hallazgos).
// 5. Tabla analítica detallada con insignias y recomendaciones técnicas.
// -------------------------------------------------------------------------------------------------
function renderDashboard(data) {
  // Aseguramos que el estado vacío se oculte y el contenido principal se muestre
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';

  // -----------------------------------------------------------------------------------------------
  // 1. ENCABEZADO Y METADATOS
  // -----------------------------------------------------------------------------------------------
  const metaEl = document.getElementById('dash-meta-info');

  // Procesamos la lista de campos evaluados para mostrar sus nombres legibles
  const camposStr = Array.isArray(data.camposAuditados)
    ? data.camposAuditados.map((c) => (typeof c === 'string' ? c : c.label || c.name)).join(', ')
    : (data.campos || 'Campos evaluados');

  metaEl.innerHTML = `
    <strong>Formulario:</strong> ${escapeHtml(data.formulario || 'Formulario Principal')} &bull;
    <strong>Campos auditados:</strong> ${escapeHtml(camposStr)}<br>
    <strong>Fecha de ejecución:</strong> ${escapeHtml(data.fechaFormateada || new Date(data.fecha).toLocaleString())} &bull;
    <strong>Total de pruebas ejecutadas:</strong> ${data.totalPruebas || 0}
  `;

  // -----------------------------------------------------------------------------------------------
  // 2. KPIS EJECUTIVOS (ÍNDICE DE RESILIENCIA HEURÍSTICA Y TARJETAS DE SEVERIDAD)
  // -----------------------------------------------------------------------------------------------
  const score = data.robustezScore !== undefined ? data.robustezScore : 0;
  const scoreValEl = document.getElementById('kpi-score-val');
  const scoreLevelEl = document.getElementById('kpi-score-level');
  const scoreCardEl = document.getElementById('kpi-card-score');

  scoreValEl.innerText = `${score}%`;
  scoreLevelEl.innerText = data.overallLevel || 'Evaluado';

  // Asignamos colores dinámicos a la tarjeta principal de Resiliencia según su nivel determinado
  if (score >= 80) {
    scoreCardEl.style.borderColor = '#00ff88'; // Verde neón (Robusto / Excelente)
    scoreValEl.style.color = '#00ff88';
  } else if (score >= 55) {
    scoreCardEl.style.borderColor = '#ffea00'; // Ámbar neón (Riesgo moderado / Aceptable)
    scoreValEl.style.color = '#ffea00';
  } else {
    scoreCardEl.style.borderColor = '#ff0055'; // Carmesí neón (Atención prioritaria requerida)
    scoreValEl.style.color = '#ff0055';
  }

  // Asignamos los valores numéricos en cada tarjeta KPI
  const metrics = data.metricas || { criticos: 0, altos: 0, medios: 0, seguros: 0 };
  document.getElementById('kpi-critical-val').innerText = metrics.criticos || 0;
  document.getElementById('kpi-high-val').innerText = metrics.altos || 0;
  document.getElementById('kpi-medium-val').innerText = metrics.medios || 0;
  document.getElementById('kpi-safe-val').innerText = metrics.seguros || 0;
  document.getElementById('kpi-total-val').innerText = data.totalPruebas || 0;

  // -----------------------------------------------------------------------------------------------
  // 3. DISTRIBUCIÓN VISUAL ESPECIALIZADA
  // Actualiza la barra superior de flujo continuo
  // -----------------------------------------------------------------------------------------------
  const p = data.porcentajes || { criticos: 0, altos: 0, medios: 0, seguros: 0 };
  const distBarCrit = document.getElementById('dist-bar-crit');
  const distBarHigh = document.getElementById('dist-bar-high');
  const distBarMed = document.getElementById('dist-bar-med');
  const distBarSafe = document.getElementById('dist-bar-safe');
  if (distBarCrit) distBarCrit.style.width = `${p.criticos}%`;
  if (distBarHigh) distBarHigh.style.width = `${p.altos}%`;
  if (distBarMed) distBarMed.style.width = `${p.medios}%`;
  if (distBarSafe) distBarSafe.style.width = `${p.seguros}%`;

  const distHealthMsg = document.getElementById('dist-health-msg');
  if (distHealthMsg) distHealthMsg.innerText = data.overallMessage || '';

  // Invocamos el renderizado del Donut SVG y de las tarjetas de barras detalladas
  renderSpecializedDistribution(metrics, p, data.totalPruebas || 0, score);

  // -----------------------------------------------------------------------------------------------
  // 4. RENDERIZAR SECCIONES DE CATEGORÍAS (ACORDEONES)
  // -----------------------------------------------------------------------------------------------
  renderCategories(data.categorias || []);

  // -----------------------------------------------------------------------------------------------
  // 5. RENDERIZAR TABLA DETALLADA
  // -----------------------------------------------------------------------------------------------
  renderTable(data.resultados || []);
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: renderSpecializedDistribution(metrics, p, totalTests, score)
// ¿QUÉ HACE?
// Dibuja el gráfico circular SVG (Donut Chart) y actualiza las tarjetas de barras por severidad.
//
// MATEMÁTICAS DEL GRÁFICO CIRCULAR SVG:
// Para dibujar arcos proporcionales en un elemento <circle> de SVG sin librerías externas:
// 1. Radio: r = 68 píxeles.
// 2. Circunferencia: C = 2 * Math.PI * r = 2 * 3.14159... * 68 ≈ 427.2566 píxeles.
// 3. "strokeDasharray": Define la longitud del trazo visible y del espacio vacío (longitudTrazo, espacioRestante).
// 4. "strokeDashoffset": Rota el punto de inicio a lo largo del perímetro. Al colocar un desfase negativo
//    acumulado (-offset), cada nuevo segmento empieza exactamente donde terminó el anterior (en sentido horario).
// -------------------------------------------------------------------------------------------------
function renderSpecializedDistribution(metrics, p, totalTests, score) {
  // Constante perimétrica matemática para radio = 68
  const C = 2 * Math.PI * 68;

  // Elementos del centro del Donut
  const donutScoreVal = document.getElementById('donut-score-val');
  const donutTotalTests = document.getElementById('donut-total-tests');

  // Asignamos el valor de resiliencia central y su color semántico
  if (donutScoreVal) {
    donutScoreVal.textContent = `${score}%`;
    if (score >= 80) donutScoreVal.style.fill = '#00ff88';
    else if (score >= 55) donutScoreVal.style.fill = '#ffea00';
    else donutScoreVal.style.fill = '#ff0055';
  }
  if (donutTotalTests) {
    donutTotalTests.textContent = `${totalTests} ${totalTests === 1 ? 'Prueba' : 'Pruebas'}`;
  }



  // Círculos SVG de cada segmento
  const segCrit = document.getElementById('donut-seg-crit');
  const segHigh = document.getElementById('donut-seg-high');
  const segMed = document.getElementById('donut-seg-med');
  const segSafe = document.getElementById('donut-seg-safe');

  // Si no hay pruebas ejecutadas, reseteamos todos los trazos a cero
  if (!totalTests || totalTests <= 0) {
    [segCrit, segHigh, segMed, segSafe].forEach((seg) => {
      if (seg) {
        seg.style.strokeDasharray = `0 ${C}`;
        seg.style.strokeDashoffset = '0';
      }
    });
  } else {
    // Calculamos la longitud en píxeles del trazo para cada segmento
    const lenCrit = (p.criticos / 100) * C;
    const lenHigh = (p.altos / 100) * C;
    const lenMed = (p.medios / 100) * C;
    const lenSafe = (p.seguros / 100) * C;

    let offset = 0; // Desfase inicial (0 píxeles, posición 12 en punto gracias a rotate(-90deg))

    // Segmento Seguridad Prioritario (Rojo)
    if (segCrit) {
      segCrit.style.strokeDasharray = `${lenCrit} ${C - lenCrit}`;
      segCrit.style.strokeDashoffset = `-${offset}`;
      offset += lenCrit; // Acumulamos la longitud para el siguiente segmento
    }

    // Segmento Alto (Rosa / Carmesí)
    if (segHigh) {
      segHigh.style.strokeDasharray = `${lenHigh} ${C - lenHigh}`;
      segHigh.style.strokeDashoffset = `-${offset}`;
      offset += lenHigh;
    }

    // Segmento Medio (Ámbar)
    if (segMed) {
      segMed.style.strokeDasharray = `${lenMed} ${C - lenMed}`;
      segMed.style.strokeDashoffset = `-${offset}`;
      offset += lenMed;
    }

    // Segmento Seguro (Verde)
    if (segSafe) {
      segSafe.style.strokeDasharray = `${lenSafe} ${C - lenSafe}`;
      segSafe.style.strokeDashoffset = `-${offset}`;
    }
  }

  // -----------------------------------------------------------------------------------------------
  // ACTUALIZACIÓN DE TARJETAS DE BARRAS HORIZONTALES POR SEVERIDAD
  // -----------------------------------------------------------------------------------------------

  // 1. Tarjeta Seguridad (Atención Prioritaria)
  const elBarCritCount = document.getElementById('bar-crit-count');
  const elBarCritPct = document.getElementById('bar-crit-pct');
  const elSevFillCrit = document.getElementById('sev-fill-crit');
  if (elBarCritCount) elBarCritCount.textContent = `${metrics.criticos || 0} ${metrics.criticos === 1 ? 'prueba' : 'pruebas'}`;
  if (elBarCritPct) elBarCritPct.textContent = `(${p.criticos}%)`;
  if (elSevFillCrit) elSevFillCrit.style.width = `${p.criticos}%`;

  // 2. Tarjeta Capacidad y Búfer (Alto)
  const elBarHighCount = document.getElementById('bar-high-count');
  const elBarHighPct = document.getElementById('bar-high-pct');
  const elSevFillHigh = document.getElementById('sev-fill-high');
  if (elBarHighCount) elBarHighCount.textContent = `${metrics.altos || 0} ${metrics.altos === 1 ? 'prueba' : 'pruebas'}`;
  if (elBarHighPct) elBarHighPct.textContent = `(${p.altos}%)`;
  if (elSevFillHigh) elSevFillHigh.style.width = `${p.altos}%`;

  // 3. Tarjeta Integridad y Formato (Medio)
  const elBarMedCount = document.getElementById('bar-med-count');
  const elBarMedPct = document.getElementById('bar-med-pct');
  const elSevFillMed = document.getElementById('sev-fill-med');
  if (elBarMedCount) elBarMedCount.textContent = `${metrics.medios || 0} ${metrics.medios === 1 ? 'prueba' : 'pruebas'}`;
  if (elBarMedPct) elBarMedPct.textContent = `(${p.medios}%)`;
  if (elSevFillMed) elSevFillMed.style.width = `${p.medios}%`;

  // 4. Tarjeta Validaciones Conformes (Seguro)
  const elBarSafeCount = document.getElementById('bar-safe-count');
  const elBarSafePct = document.getElementById('bar-safe-pct');
  const elSevFillSafe = document.getElementById('sev-fill-safe');
  if (elBarSafeCount) elBarSafeCount.textContent = `${metrics.seguros || 0} ${metrics.seguros === 1 ? 'prueba' : 'pruebas'}`;
  if (elBarSafePct) elBarSafePct.textContent = `(${p.seguros}%)`;
  if (elSevFillSafe) elSevFillSafe.style.width = `${p.seguros}%`;
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: renderCategories(categories)
// ¿QUÉ HACE?
// Construye de forma dinámica los acordeones HTML para cada categoría de riesgo:
// - Genera el encabezado con título, descripción, recuento y chevron desplegable.
// - Inserta las tarjetas individuales de hallazgos con detalles de la prueba, carga y recomendaciones.
// - Conecta el evento de clic para colapsar y expandir cada acordeón suavemente.
// -------------------------------------------------------------------------------------------------
function renderCategories(categories) {
  const root = document.getElementById('risk-categories-root');
  root.innerHTML = ''; // Limpiamos el contenedor antes de dibujar

  // Validación de seguridad por si no existen categorías
  if (!categories || categories.length === 0) {
    root.innerHTML = '<div class="empty-state"><p>No se categorizaron hallazgos.</p></div>';
    return;
  }

  // Iteramos sobre cada categoría definida en la taxonomía
  categories.forEach((cat) => {
    const sec = document.createElement('div');
    sec.className = 'cat-section';
    sec.id = `cat-section-${cat.key}`;
    sec.setAttribute('data-category', cat.key);
    sec.style.borderLeft = `4px solid ${cat.borderLeft || '#00ff88'}`;

    const count = cat.findings ? cat.findings.length : 0;
    const countLabel = cat.key === 'conforme'
      ? `${count} conformes`
      : `${count} ${count === 1 ? 'incidencia' : 'incidencias'}`;

    // Encabezado del Acordeón
    const header = document.createElement('div');
    header.className = 'cat-section-header';
    header.innerHTML = `
      <div class="cat-header-left">
        <h2 class="cat-header-title">${escapeHtml(cat.title)}</h2>
        <div class="cat-header-desc">${escapeHtml(cat.desc)}</div>
      </div>
      <div class="cat-header-right">
        <span class="cat-count-pill" style="color: ${cat.color}; border: 1px solid ${cat.color};">
          ${countLabel}
        </span>
        <span class="cat-chevron">▼</span>
      </div>
    `;

    // Cuerpo desplegable con las tarjetas de hallazgos
    const body = document.createElement('div');
    body.className = 'cat-section-body';
    body.id = `cat-body-${cat.key}`;

    if (count === 0) {
      body.innerHTML = `
        <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">
          No se registraron anomalías ni observaciones en este grupo de evaluación.
        </div>
      `;
    } else {
      cat.findings.forEach((f) => {
        const card = document.createElement('div');
        card.className = 'finding-card';
        // Atributos de búsqueda para filtrado instantáneo
        card.setAttribute('data-field', (f.fieldName || '').toLowerCase());
        card.setAttribute('data-test', (f.testName || '').toLowerCase());
        card.setAttribute('data-detail', (f.detail || '').toLowerCase());
        card.setAttribute('data-rec', (f.recommendation || '').toLowerCase());

        const badgeClass = f.badgeClass || 'res-safe';
        card.innerHTML = `
          <div class="finding-header">
            <div>
              <span class="finding-field-name">${escapeHtml(f.fieldName)}</span>
              <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">(${escapeHtml(f.fieldType || 'input')})</span>
              <div class="finding-test-name">${escapeHtml(f.testName)}</div>
            </div>
            <span class="res-badge ${badgeClass}">${escapeHtml(f.badgeText)}</span>
          </div>
          <div class="finding-payload">
            <strong>Carga ingresada:</strong> ${escapeHtml(f.input)}
          </div>
          <div class="finding-detail">
            <strong>Detalle:</strong> ${escapeHtml(f.detail)}
          </div>
          <div class="finding-rec">
            <strong>Recomendación Técnica:</strong> ${escapeHtml(f.recommendation)}
          </div>
        `;
        body.appendChild(card);
      });
    }

    // Evento para alternar colapso/expansión al hacer clic en el encabezado
    header.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });

    sec.appendChild(header);
    sec.appendChild(body);
    root.appendChild(sec);
  });
}

// -------------------------------------------------------------------------------------------------
// CONSTANTE: CATEGORY_META
// ¿QUÉ HACE?
// Diccionario de metadatos de presentación visual para la vista de tabla detallada.
// Asocia cada clave técnica de categoría con su nombre en español, clase CSS de fila,
// clase CSS de píldora y color de punto indicador.
// -------------------------------------------------------------------------------------------------
const CATEGORY_META = {
  security: {
    name: 'Seguridad (Prioritario)',
    pillClass: 'cat-pill-security',
    rowClass: 'row-cat-security',
    dotColor: '#ff0055'
  },
  capacity: {
    name: 'Capacidad (Alto)',
    pillClass: 'cat-pill-capacity',
    rowClass: 'row-cat-capacity',
    dotColor: '#ff4070'
  },
  integrity: {
    name: 'Integridad (Medio)',
    pillClass: 'cat-pill-integrity',
    rowClass: 'row-cat-integrity',
    dotColor: '#ffea00'
  },
  format_logic: {
    name: 'Lógica / Formato',
    pillClass: 'cat-pill-logic',
    rowClass: 'row-cat-format_logic',
    dotColor: '#ffea00'
  },
  conforme: {
    name: 'Conforme',
    pillClass: 'cat-pill-safe',
    rowClass: 'row-cat-conforme',
    dotColor: '#00ff88'
  }
};

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: renderTable(results)
// ¿QUÉ HACE?
// Construye las filas <tr> del cuerpo de la tabla (<tbody>) en la vista de tabla completa:
// - Muestra la columna "Tipo de Riesgo" con su píldora semántica coloreada.
// - Detalla el nombre del campo, tipo, prueba ejecutada, payload probado, insignia y recomendación técnica.
// -------------------------------------------------------------------------------------------------
function renderTable(results) {
  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = ''; // Limpiamos filas anteriores

  if (!results || results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Sin datos de tabla</td></tr>';
    return;
  }

  results.forEach((r) => {
    const tr = document.createElement('tr');
    const catKey = r.categoryKey || 'conforme';
    const meta = CATEGORY_META[catKey] || CATEGORY_META.conforme;

    tr.className = meta.rowClass;
    // Atributos para búsqueda y filtrado rápido
    tr.setAttribute('data-category', catKey);
    tr.setAttribute('data-field', (r.fieldName || '').toLowerCase());
    tr.setAttribute('data-test', (r.testName || '').toLowerCase());
    tr.setAttribute('data-detail', (r.detail || '').toLowerCase());
    tr.setAttribute('data-rec', (r.recommendation || '').toLowerCase());

    const badgeClass = r.badgeClass || 'res-safe';
    // Si la cadena de prueba es muy larga (ej. 1,000 o 5,000 caracteres), la recortamos visualmente con puntos suspensivos
    const displayInput = (r.input || '').length > 65 ? (r.input.slice(0, 62) + '...') : r.input;

    tr.innerHTML = `
      <td class="col-cat-risk">
        <span class="cat-pill ${meta.pillClass}">
          <span class="cat-pill-dot" style="background: ${meta.dotColor};"></span>
          ${escapeHtml(meta.name)}
        </span>
      </td>
      <td>
        <strong style="color: #ffffff;">${escapeHtml(r.fieldName)}</strong>
        <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(r.fieldType || 'input')}</div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-main); margin-bottom: 2px;">${escapeHtml(r.testName)}</div>
        <code>${escapeHtml(displayInput)}</code>
      </td>
      <td>
        <span class="res-badge ${badgeClass}">${escapeHtml(r.badgeText)}</span>
      </td>
      <td>${escapeHtml(r.detail)}</td>
      <td>
        <div style="font-size: 11px; color: #00ff88; line-height: 1.4;">${escapeHtml(r.recommendation)}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: applyFiltersAndSearch()
// ¿QUÉ HACE?
// Motor unificado de filtrado: aplica simultáneamente el filtro de categoría activo y la cadena
// de búsqueda en tiempo real sobre ambas vistas (Acordeones y Tabla).
// -------------------------------------------------------------------------------------------------
function applyFiltersAndSearch() {
  // -----------------------------------------------------------------------------------------------
  // 1. FILTRAR VISTA DE CATEGORÍAS (ACORDEONES Y TARJETAS)
  // -----------------------------------------------------------------------------------------------
  const catSections = document.querySelectorAll('.cat-section');
  catSections.forEach((sec) => {
    const catKey = sec.getAttribute('data-category');
    // Coincidencia de categoría (soporta alias 'logic' para 'format_logic')
    const categoryMatches = (activeFilter === 'all' || activeFilter === catKey || (activeFilter === 'logic' && catKey === 'format_logic'));

    if (!categoryMatches) {
      sec.style.display = 'none';
      return;
    }

    // Filtrar tarjetas internas según el texto de búsqueda
    const cards = sec.querySelectorAll('.finding-card');
    let visibleCards = 0;

    cards.forEach((card) => {
      const field = card.getAttribute('data-field') || '';
      const test = card.getAttribute('data-test') || '';
      const detail = card.getAttribute('data-detail') || '';
      const rec = card.getAttribute('data-rec') || '';

      // La tarjeta coincide si el buscador está vacío o si alguna de sus propiedades contiene el texto buscado
      const searchMatches = !currentSearchTerm ||
        field.includes(currentSearchTerm) ||
        test.includes(currentSearchTerm) ||
        detail.includes(currentSearchTerm) ||
        rec.includes(currentSearchTerm);

      if (searchMatches) {
        card.style.display = 'block';
        visibleCards++;
      } else {
        card.style.display = 'none';
      }
    });

    // Si hay búsqueda activa y ninguna tarjeta coincidió dentro de la categoría, ocultamos la categoría completa
    if (currentSearchTerm && visibleCards === 0 && cards.length > 0) {
      sec.style.display = 'none';
    } else {
      sec.style.display = 'block';
    }
  });

  // -----------------------------------------------------------------------------------------------
  // 2. FILTRAR FILAS DE LA TABLA
  // -----------------------------------------------------------------------------------------------
  const tableRows = document.querySelectorAll('#audit-table-body tr');
  tableRows.forEach((row) => {
    const catKey = row.getAttribute('data-category');
    const categoryMatches = (activeFilter === 'all' || activeFilter === catKey || (activeFilter === 'logic' && catKey === 'format_logic'));

    if (!categoryMatches) {
      row.style.display = 'none';
      return;
    }

    const field = row.getAttribute('data-field') || '';
    const test = row.getAttribute('data-test') || '';
    const detail = row.getAttribute('data-detail') || '';
    const rec = row.getAttribute('data-rec') || '';

    const searchMatches = !currentSearchTerm ||
      field.includes(currentSearchTerm) ||
      test.includes(currentSearchTerm) ||
      detail.includes(currentSearchTerm) ||
      rec.includes(currentSearchTerm);

    row.style.display = searchMatches ? '' : 'none';
  });
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN: handleCopyJson()
// ¿QUÉ HACE?
// Serializa los datos completos de la auditoría en una cadena con formato JSON legible e invoca
// la API nativa de portapapeles del navegador (navigator.clipboard) para permitir copiar con un solo clic.
// -------------------------------------------------------------------------------------------------
function handleCopyJson() {
  if (!currentAuditData) return;

  // Formateamos el JSON con sangría de 2 espacios
  const jsonString = JSON.stringify(currentAuditData, null, 2);
  const btnText = document.getElementById('btn-copy-json-text');

  // "navigator.clipboard.writeText": API moderna asíncrona para copiar al portapapeles del sistema
  navigator.clipboard.writeText(jsonString).then(() => {
    if (btnText) {
      const orig = btnText.innerText;
      btnText.innerText = '¡JSON Copiado!';
      // Revertir el texto del botón tras 2 segundos
      setTimeout(() => {
        btnText.innerText = orig;
      }, 2000);
    }
  }).catch(() => {
    // Si los permisos del portapapeles fallan, mostramos un prompt de respaldo para copia manual
    prompt('Copia el JSON manualmente:', jsonString);
  });
}

// -------------------------------------------------------------------------------------------------
// FUNCIÓN AUXILIAR: escapeHtml(text)
// ¿QUÉ HACE?
// Medida de seguridad preventiva para evitar Cross-Site Scripting (XSS).
// Convierte caracteres especiales de HTML (&, <, >, ", ') en sus entidades seguras equivalentes
// antes de concatenar o insertar valores textuales dentro de innerHTML.
// -------------------------------------------------------------------------------------------------
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')   // Reemplaza ampersand
    .replace(/</g, '&lt;')    // Reemplaza menor que
    .replace(/>/g, '&gt;')    // Reemplaza mayor que
    .replace(/"/g, '&quot;')  // Reemplaza comillas dobles
    .replace(/'/g, '&#039;'); // Reemplaza comillas simples
}

