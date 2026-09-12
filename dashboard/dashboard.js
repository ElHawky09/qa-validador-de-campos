// dashboard.js - Controlador nativo del Dashboard Ejecutivo de Auditoría QA

let currentAuditData = null;
let activeFilter = 'all';
let currentSearchTerm = '';

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

// Inicialización y carga de datos
function initDashboard() {
  setupUIEventListeners();
  loadAuditData();

  // Suscripción reactiva a cambios desde el panel lateral
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.qa_audit_dashboard_data?.newValue) {
        currentAuditData = changes.qa_audit_dashboard_data.newValue;
        renderDashboard(currentAuditData);
      }
    });
  }
}

// Carga de datos desde chrome.storage.local con fallback a localStorage
function loadAuditData() {
  function applyData(data) {
    if (data && (data.totalPruebas !== undefined || data.resultados)) {
      currentAuditData = data;
      renderDashboard(currentAuditData);

      // Comprobar si se solicitó impresión directa
      const params = new URLSearchParams(window.location.search);
      if (params.get('autoPrint') === 'true') {
        setTimeout(() => {
          window.print();
        }, 500);
      }
      return true;
    }
    return false;
  }

  let loaded = false;

  // 1. Intento primario con chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['qa_audit_dashboard_data'], (result) => {
      if (result && result.qa_audit_dashboard_data) {
        loaded = true;
        applyData(result.qa_audit_dashboard_data);
      } else {
        checkLocalStorage();
      }
    });
  } else {
    checkLocalStorage();
  }

  // 2. Fallback síncrono a localStorage
  function checkLocalStorage() {
    if (loaded) return;
    try {
      const raw = localStorage.getItem('qa_audit_dashboard_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (applyData(parsed)) {
          loaded = true;
          return;
        }
      }
    } catch (e) {
      console.warn('Error leyendo localStorage:', e);
    }
    showEmptyState();
  }
}

function showEmptyState() {
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('dash-meta-info').innerText = 'Sin auditoría activa';
}

// Configuración de escuchas de eventos UI
function setupUIEventListeners() {
  // Botón Copiar JSON
  const btnCopyJson = document.getElementById('btn-copy-json');
  if (btnCopyJson) {
    btnCopyJson.addEventListener('click', handleCopyJson);
  }

  // Botón Imprimir / PDF
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  if (btnPrintPdf) {
    btnPrintPdf.addEventListener('click', () => {
      window.print();
    });
  }

  // Búsqueda en tiempo real
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value.toLowerCase().trim();
      applyFiltersAndSearch();
    });
  }

  // Píldoras de filtro de categoría
  const pillBtns = document.querySelectorAll('.pill-btn');
  pillBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      pillBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      applyFiltersAndSearch();
    });
  });

  // Conmutador de vista (Categorías vs Tabla)
  const btnViewCategories = document.getElementById('btn-view-categories');
  const btnViewTable = document.getElementById('btn-view-table');
  const categoriesView = document.getElementById('categories-view-container');
  const tableView = document.getElementById('table-view-container');

  if (btnViewCategories && btnViewTable) {
    btnViewCategories.addEventListener('click', () => {
      btnViewCategories.classList.add('active');
      btnViewTable.classList.remove('active');
      categoriesView.style.display = 'block';
      tableView.style.display = 'none';
    });

    btnViewTable.addEventListener('click', () => {
      btnViewTable.classList.add('active');
      btnViewCategories.classList.remove('active');
      categoriesView.style.display = 'none';
      tableView.style.display = 'block';
    });
  }
}

// Renderizado principal del Dashboard
function renderDashboard(data) {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';

  // 1. Header y Metadatos
  const metaEl = document.getElementById('dash-meta-info');
  const camposStr = Array.isArray(data.camposAuditados)
    ? data.camposAuditados.map((c) => (typeof c === 'string' ? c : c.label || c.name)).join(', ')
    : (data.campos || 'Campos evaluados');

  metaEl.innerHTML = `
    <strong>Formulario:</strong> ${escapeHtml(data.formulario || 'Formulario Principal')} &bull;
    <strong>Campos auditados:</strong> ${escapeHtml(camposStr)}<br>
    <strong>Fecha de ejecución:</strong> ${escapeHtml(data.fechaFormateada || new Date(data.fecha).toLocaleString())} &bull;
    <strong>Total de pruebas ejecutadas:</strong> ${data.totalPruebas || 0}
  `;

  // 2. KPIs Ejecutivos
  const score = data.robustezScore !== undefined ? data.robustezScore : 0;
  const scoreValEl = document.getElementById('kpi-score-val');
  const scoreLevelEl = document.getElementById('kpi-score-level');
  const scoreCardEl = document.getElementById('kpi-card-score');

  scoreValEl.innerText = `${score}%`;
  scoreLevelEl.innerText = data.overallLevel || 'Evaluado';

  // Colores dinámicos para tarjeta de score
  if (score >= 80) {
    scoreCardEl.style.borderColor = '#10b981';
    scoreValEl.style.color = '#34d399';
  } else if (score >= 55) {
    scoreCardEl.style.borderColor = '#f59e0b';
    scoreValEl.style.color = '#fbbf24';
  } else {
    scoreCardEl.style.borderColor = '#ef4444';
    scoreValEl.style.color = '#f87171';
  }

  const metrics = data.metricas || { criticos: 0, altos: 0, medios: 0, seguros: 0 };
  document.getElementById('kpi-critical-val').innerText = metrics.criticos || 0;
  document.getElementById('kpi-high-val').innerText = metrics.altos || 0;
  document.getElementById('kpi-medium-val').innerText = metrics.medios || 0;
  document.getElementById('kpi-safe-val').innerText = metrics.seguros || 0;
  document.getElementById('kpi-total-val').innerText = data.totalPruebas || 0;

  // 3. Barra de Distribución y Leyenda
  const p = data.porcentajes || { criticos: 0, altos: 0, medios: 0, seguros: 0 };
  document.getElementById('dist-bar-crit').style.width = `${p.criticos}%`;
  document.getElementById('dist-bar-high').style.width = `${p.altos}%`;
  document.getElementById('dist-bar-med').style.width = `${p.medios}%`;
  document.getElementById('dist-bar-safe').style.width = `${p.seguros}%`;

  document.getElementById('dist-health-msg').innerText = data.overallMessage || '';
  document.getElementById('leg-crit-txt').innerText = `Seguridad: ${p.criticos}% (${metrics.criticos})`;
  document.getElementById('leg-high-txt').innerText = `Capacidad DoS: ${p.altos}% (${metrics.altos})`;
  document.getElementById('leg-med-txt').innerText = `Formato / Integridad: ${p.medios}% (${metrics.medios})`;
  document.getElementById('leg-safe-txt').innerText = `Conforme / Seguro: ${p.seguros}% (${metrics.seguros})`;

  // 4. Renderizar Secciones de Categorías (Acordeones)
  renderCategories(data.categorias || []);

  // 5. Renderizar Tabla Detallada
  renderTable(data.resultados || []);
}

// Renderizado de acordeones de categorías de riesgo
function renderCategories(categories) {
  const root = document.getElementById('risk-categories-root');
  root.innerHTML = '';

  if (!categories || categories.length === 0) {
    root.innerHTML = '<div class="empty-state"><p>No se categorizaron hallazgos.</p></div>';
    return;
  }

  categories.forEach((cat) => {
    const sec = document.createElement('div');
    sec.className = 'cat-section';
    sec.id = `cat-section-${cat.key}`;
    sec.setAttribute('data-category', cat.key);
    sec.style.borderLeft = `4px solid ${cat.borderLeft || '#3b82f6'}`;

    const isCollapsible = true;
    const count = cat.findings ? cat.findings.length : 0;
    const countLabel = cat.key === 'conforme'
      ? `${count} conformes`
      : `${count} ${count === 1 ? 'incidencia' : 'incidencias'}`;

    // Header del acordeón
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

    // Cuerpo con hallazgos
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

    // Toggle al hacer click en el header
    header.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });

    sec.appendChild(header);
    sec.appendChild(body);
    root.appendChild(sec);
  });
}

// Metadatos para categorías de riesgo en modo tabla
const CATEGORY_META = {
  security: {
    name: 'Seguridad (Crítico)',
    pillClass: 'cat-pill-security',
    rowClass: 'row-cat-security',
    dotColor: '#ef4444'
  },
  capacity: {
    name: 'Capacidad DoS (Alto)',
    pillClass: 'cat-pill-capacity',
    rowClass: 'row-cat-capacity',
    dotColor: '#f43f5e'
  },
  integrity: {
    name: 'Integridad (Medio)',
    pillClass: 'cat-pill-integrity',
    rowClass: 'row-cat-integrity',
    dotColor: '#f59e0b'
  },
  format_logic: {
    name: 'Lógica / Formato',
    pillClass: 'cat-pill-logic',
    rowClass: 'row-cat-format_logic',
    dotColor: '#fbbf24'
  },
  conforme: {
    name: 'Conforme (Seguro)',
    pillClass: 'cat-pill-safe',
    rowClass: 'row-cat-conforme',
    dotColor: '#10b981'
  }
};

// Renderizado de la tabla detallada
function renderTable(results) {
  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = '';

  if (!results || results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Sin datos de tabla</td></tr>';
    return;
  }

  results.forEach((r) => {
    const tr = document.createElement('tr');
    const catKey = r.categoryKey || 'conforme';
    const meta = CATEGORY_META[catKey] || CATEGORY_META.conforme;

    tr.className = meta.rowClass;
    tr.setAttribute('data-category', catKey);
    tr.setAttribute('data-field', (r.fieldName || '').toLowerCase());
    tr.setAttribute('data-test', (r.testName || '').toLowerCase());
    tr.setAttribute('data-detail', (r.detail || '').toLowerCase());
    tr.setAttribute('data-rec', (r.recommendation || '').toLowerCase());

    const badgeClass = r.badgeClass || 'res-safe';
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
        <div style="font-size: 11px; color: #93c5fd; line-height: 1.4;">${escapeHtml(r.recommendation)}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Filtrado combinado (Categoría + Búsqueda)
function applyFiltersAndSearch() {
  // 1. Filtrar Acordeones y Tarjetas
  const catSections = document.querySelectorAll('.cat-section');
  catSections.forEach((sec) => {
    const catKey = sec.getAttribute('data-category');
    const categoryMatches = (activeFilter === 'all' || activeFilter === catKey || (activeFilter === 'logic' && catKey === 'format_logic'));

    if (!categoryMatches) {
      sec.style.display = 'none';
      return;
    }

    // Filtrar tarjetas internas según búsqueda
    const cards = sec.querySelectorAll('.finding-card');
    let visibleCards = 0;

    cards.forEach((card) => {
      const field = card.getAttribute('data-field') || '';
      const test = card.getAttribute('data-test') || '';
      const detail = card.getAttribute('data-detail') || '';
      const rec = card.getAttribute('data-rec') || '';

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

    if (currentSearchTerm && visibleCards === 0 && cards.length > 0) {
      sec.style.display = 'none';
    } else {
      sec.style.display = 'block';
    }
  });

  // 2. Filtrar Filas de la Tabla
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

// Acción: Copiar JSON estructurado
function handleCopyJson() {
  if (!currentAuditData) return;

  const jsonString = JSON.stringify(currentAuditData, null, 2);
  const btnText = document.getElementById('btn-copy-json-text');

  navigator.clipboard.writeText(jsonString).then(() => {
    if (btnText) {
      const orig = btnText.innerText;
      btnText.innerText = '¡JSON Copiado!';
      setTimeout(() => {
        btnText.innerText = orig;
      }, 2000);
    }
  }).catch(() => {
    prompt('Copia el JSON manualmente:', jsonString);
  });
}

// Función auxiliar de escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
