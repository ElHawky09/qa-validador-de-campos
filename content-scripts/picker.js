// Content Script for QA Form Field Validator
// Supports single and multi-field selection, auto-detecting all form fields,
// intelligent dummy-value generation for required sibling fields, and dual-phase testing

(() => {
  if (window.__qaFormValidatorInjected) {
    return;
  }
  window.__qaFormValidatorInjected = true;

  let isPickingField = false;
  let isPickingSaveButton = false;
  let isPickingForm = false;
  let isPickingReopenStep = false;
  let hoveredElement = null;
  let targetElement = null;
  let saveButtonElement = null;
  let lastRightClickedElement = null;
  let bannerEl = null;
  let tooltipEl = null;
  let lastCapturedAlert = null;

  // Intercept window.alert from page context
  try {
    const script = document.createElement('script');
    script.textContent = `
      (() => {
        window.__qa_last_alert = null;
        const _nativeAlert = window.alert;
        window.alert = function(msg) {
          window.__qa_last_alert = String(msg || '');
          window.dispatchEvent(new CustomEvent('__qa_alert_captured', { detail: { message: String(msg || '') } }));
          console.warn('[QA Form Validator Alert Intercepted]:', msg);
        };
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    window.addEventListener('__qa_alert_captured', (e) => {
      lastCapturedAlert = e.detail?.message || null;
    });
  } catch (err) {
    console.warn('Could not inject alert interceptor:', err);
  }

  // Track context menu target
  document.addEventListener('contextmenu', (e) => {
    lastRightClickedElement = e.target;
  }, true);

  const ALLOWED_INPUT_TYPES = new Set([
    'text', 'search', 'email', 'tel', 'url', 'password',
    'number', 'date', 'datetime-local', 'time', 'month', 'week'
  ]);

  // Helper: check if element is testable input (strictly text-entry fields, excludes checkboxes/selects)
  function isTestableField(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.disabled || el.readOnly) return false;

    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (el.isContentEditable) return true;

    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase().trim();
      return ALLOWED_INPUT_TYPES.has(type);
    }

    return false;
  }

  // Helper: check if element is a clickable button or submit element
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

  // Helper: check if element is actually visible and rendered in DOM
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
      // Check parent modal, drawer or container up to 8 levels to avoid expensive deep traversals
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

  // Helper: resolve element from a saved reopen step
  function resolveElementByStep(step) {
    if (!step) return null;
    if (step.id) {
      const byId = document.getElementById(step.id);
      if (byId && isElementVisible(byId)) return byId;
      if (byId) return byId;
    }
    if (step.selector) {
      try {
        const bySel = document.querySelector(step.selector);
        if (bySel && isElementVisible(bySel)) return bySel;
        if (bySel) return bySel;
      } catch (e) {
        console.warn('Step selector resolution error:', e);
      }
    }
    if (step.text) {
      const textTrim = step.text.trim().toLowerCase();

      // 1. High priority: exact match on interactive buttons and links
      const interactives = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
      const exactBtn = interactives.find(c => {
        const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return cText === textTrim;
      });
      if (exactBtn) return exactBtn;

      // 2. Partial match on interactive buttons/links
      const partialBtn = interactives.find(c => {
        const cText = (c.innerText || c.value || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return cText.length < 60 && (cText.includes(textTrim) || textTrim.includes(cText));
      });
      if (partialBtn) return partialBtn;

      // 3. Fallback to leaf elements (elements without interactive children and with short text)
      const genericCandidates = Array.from(document.querySelectorAll('span, div, tr, li, td, .btn'));
      const leafMatch = genericCandidates.find(c => {
        if (c.querySelector('button, a, input, [role="button"]')) return false;
        const cText = (c.innerText || c.getAttribute('aria-label') || '').trim().toLowerCase();
        return (cText === textTrim || (cText.length < 50 && cText.includes(textTrim))) && isElementVisible(c);
      });
      if (leafMatch) return leafMatch;
    }
    return null;
  }

  // Execute sequence of clicks to reopen a collapsible / modal form
  async function executeReopenSequence(steps, waitBetweenMs = 400) {
    if (!Array.isArray(steps) || steps.length === 0) return true;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const el = resolveElementByStep(step);
      if (el) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
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
      await new Promise(r => setTimeout(r, waitBetweenMs));
    }
    return true;
  }

  // Wait until element becomes visible in DOM (up to maxWaitMs)
  async function waitForElementVisible(fieldInfo, maxWaitMs = 1800) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const el = resolveFieldElement(fieldInfo);
        if (el && isElementVisible(el)) {
          return el;
        }
      } catch (err) {
        console.warn('waitForElementVisible check error:', err);
      }
      await new Promise(r => setTimeout(r, 60));
    }
    const finalEl = resolveFieldElement(fieldInfo);
    return (finalEl && isElementVisible(finalEl)) ? finalEl : null;
  }

  // Find associated label or readable name
  function getElementLabel(el) {
    if (!el) return '';
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.innerText.trim()) return label.innerText.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText.trim()) {
      return parentLabel.innerText.trim();
    }
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl && labelEl.innerText.trim()) return labelEl.innerText.trim();
    }
    if (el.getAttribute('placeholder')) {
      return `Placeholder: "${el.getAttribute('placeholder').trim()}"`;
    }
    if (el.name) return `name="${el.name}"`;
    if (el.id) return `#${el.id}`;
    return `<${el.tagName.toLowerCase()}>`;
  }

  // Generate a selector for reference
  function getUniqueSelector(el) {
    if (!el) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) path += `.${classes}`;
    }
    return path;
  }

  // Helper: check if element is semantically a URL or link field
  function isUrlField(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();
    if (type === 'url') return true;

    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const label = getElementLabel(el).toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const allText = `${name} ${id} ${placeholder} ${label} ${ariaLabel}`;

    return /\b(url|link|enlace|sitio|website|web|endpoint|slug|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(allText);
  }

  // Helper: check if element is a slug or route path
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

  // Smart generator of compliant dummy data for required/sibling fields
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

    // 0. Dropdown / Select element
    if (tag === 'select' && el instanceof HTMLSelectElement) {
      const options = Array.from(el.options || []);
      const validOpt = options.find(opt => opt.value && opt.value.trim() !== '' && !opt.disabled);
      if (validOpt) return validOpt.value;
      if (options.length > 1) return options[1].value;
      if (options.length > 0) return options[0].value;
      return '';
    }

    // 0.1. URL / Link / Slug fields (Strictly lowercase valid dummy value!)
    if (isUrlField(el)) {
      if (isSlugField(el)) {
        return 'recurso-qa-valido';
      }
      return 'https://qa.ejemplo.com/recurso-valido';
    }

    // 1. Phone / 10-digit number constraint (the exact user scenario!)
    if (type === 'tel' || /tel[eé]fono|phone|celular|movil|móvil|10\s*d[ií]gito/.test(allText) || /\[0-9\]\{10\}|\\d\{10\}/.test(pattern)) {
      return '55' + Math.floor(10000000 + Math.random() * 90000000); // 10 valid digits
    }

    // 2. Specific Regex patterns
    if (pattern) {
      if (/\[0-9\]\{8\}|\\d\{8\}/.test(pattern)) return '12345678';
      if (/\[0-9\]\{5\}|\\d\{5\}/.test(pattern)) return '28001';
      if (/\[A-Za-z0-9\]\{5\}/.test(pattern)) return 'AB123';
      if (/\[0-9\]\{4\}|\\d\{4\}/.test(pattern)) return '2025';
    }

    // 3. Email
    if (type === 'email' || /correo|email|e-mail/.test(allText)) {
      return `usuario.qa${Math.floor(100 + Math.random() * 900)}@test.com`;
    }

    // 4. Number
    if (type === 'number') {
      let minNum = min !== null && min !== '' ? parseFloat(min) : null;
      let maxNum = max !== null && max !== '' ? parseFloat(max) : null;
      if (minNum !== null && maxNum !== null) {
        return String(Math.floor((minNum + maxNum) / 2));
      }
      if (minNum !== null) return String(minNum + 5);
      if (maxNum !== null) return String(Math.max(1, maxNum - 5));
      return '25';
    }

    // 5. Date
    if (type === 'date' || type === 'datetime-local' || /fecha|date|nacimiento|cita/.test(allText)) {
      return '2025-06-15';
    }

    // 6. Postal code / ZIP
    if (/c[oó]digo\s*postal|zip|postal/.test(allText)) {
      return '28001';
    }

    // 7. Password
    if (type === 'password' || /pass|clave|contrase[ñn]a/.test(allText)) {
      return 'ClaveValida_2025!';
    }

    // 8. Minlength string
    if (minLength > 0) {
      return 'DatoValido'.padEnd(minLength + 2, 'X');
    }

    // 9. Standard Names / Text
    if (/nombre|name|first/.test(allText)) return 'Juan Carlos';
    if (/apellido|last/.test(allText)) return 'Pérez Gómez';
    if (/ciudad|city/.test(allText)) return 'Ciudad de Prueba';
    if (/direccion|address|calle/.test(allText)) return 'Av. Principal 123';
    if (tag === 'textarea' || /comentario|observaci[oó]n|descripci[oó]n/.test(allText)) {
      return 'Observaciones de prueba válidas.';
    }

    return 'Dato Válido QA';
  }

  // Auto-detect submit / save button local to the field's container
  function autoDetectSaveButton(fieldEl, allowHidden = false) {
    if (!fieldEl) return null;

    // 1. Check enclosing <form> or [role="form"]
    const form = fieldEl.form || fieldEl.closest('form, [role="form"]');
    if (form) {
      // 1a. Check HTML5 linked button[form="id"] outside the form
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

      // 1b. Check submit buttons inside the form
      const explicitSubmit = form.querySelector('button[type="submit"], input[type="submit"]');
      if (explicitSubmit && (allowHidden || isElementVisible(explicitSubmit))) return explicitSubmit;

      const buttons = Array.from(form.querySelectorAll('button, input[type="button"], a.btn, [role="button"]'));
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

    // 2. Check enclosing card, module, modal, drawer, or section container
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

  // Extract comprehensive element metadata
  function getElementMetadata(el, allowHidden = false) {
    const parentForm = el.form || el.closest('form, [role="form"], .modal, .card, .section');
    const formSaveBtn = autoDetectSaveButton(el, allowHidden);
    return {
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || (el.tagName.toLowerCase() === 'textarea' ? 'textarea' : 'text')).toLowerCase(),
      isUrlField: isUrlField(el),
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
      formSelector: parentForm ? getUniqueSelector(parentForm) : null,
      saveButton: formSaveBtn ? getButtonMetadata(formSaveBtn) : null
    };
  }

  function getButtonMetadata(el) {
    if (!el) return null;
    const text = el.innerText?.trim() || el.value || el.getAttribute('aria-label') || 'Botón';
    return {
      text: text.slice(0, 30),
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      type: el.getAttribute('type') || 'submit',
      selector: getUniqueSelector(el)
    };
  }

  // Extract human-readable title for a form or container
  function getFormTitle(formEl, index = 1) {
    if (!formEl) return `Formulario #${index}`;
    const legend = formEl.querySelector('legend');
    if (legend && legend.innerText.trim()) return legend.innerText.trim();

    const heading = formEl.querySelector('h1, h2, h3, h4, h5, .card-title, .modal-title, .form-title');
    if (heading && heading.innerText.trim()) return heading.innerText.trim();

    let prev = formEl.previousElementSibling;
    while (prev) {
      if (/^h[1-6]$/i.test(prev.tagName) && prev.innerText.trim()) {
        return prev.innerText.trim();
      }
      prev = prev.previousElementSibling;
    }

    if (formEl.getAttribute('aria-label')) return formEl.getAttribute('aria-label').trim();
    if (formEl.id) return `#${formEl.id}`;
    if (formEl.name) return `name="${formEl.name}"`;

    const firstLabel = formEl.querySelector('label');
    if (firstLabel && firstLabel.innerText.trim()) {
      return `Formulario (${firstLabel.innerText.trim().slice(0, 22)})`;
    }

    return `Formulario #${index}`;
  }

  // Scan and discover ALL forms and form modules across the page
  function scanAllPageForms() {
    const detected = [];
    const forms = Array.from(document.querySelectorAll('form'));

    if (forms.length > 0) {
      forms.forEach((formEl, idx) => {
        const rawInputs = Array.from(formEl.querySelectorAll('input, textarea, select, [contenteditable]'));
        const testable = rawInputs.filter(isTestableField);
        if (testable.length > 0) {
          const title = getFormTitle(formEl, idx + 1);
          const fields = testable.map(el => getElementMetadata(el, true));
          const btn = autoDetectSaveButton(testable[0], true);
          const formSaveBtn = btn ? getButtonMetadata(btn) : null;
          const formId = formEl.id || `form_${idx}`;
          const formSelector = getUniqueSelector(formEl);

          // Stamp each field with its parent form identity and local save button
          fields.forEach(f => {
            f.formId = formId;
            f.formIndex = idx;
            f.formTitle = title;
            f.formSelector = formSelector;
            if (!f.saveButton && formSaveBtn) {
              f.saveButton = formSaveBtn;
            }
          });

          detected.push({
            formIndex: idx,
            id: formId,
            title: title,
            selector: formSelector,
            fields: fields,
            fieldsCount: fields.length,
            saveButton: formSaveBtn
          });
        }
      });
    }

    // Check for form-like sections/cards in SPAs if no formal forms found or multiple modules exist
    if (detected.length === 0) {
      const containers = Array.from(document.querySelectorAll('[role="form"], .modal, .card, .section, main, body'));
      let cIdx = 1;
      const seenSignatures = new Set();
      containers.forEach(cont => {
        const rawInputs = Array.from(cont.querySelectorAll('input, textarea, select, [contenteditable]'));
        const testable = rawInputs.filter(isTestableField);
        if (testable.length > 0) {
          const sig = testable.map(f => f.id || f.name || getUniqueSelector(f)).sort().join('|');
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            const title = getFormTitle(cont, cIdx++);
            const fields = testable.map(el => getElementMetadata(el, true));
            const btn = autoDetectSaveButton(testable[0], true);
            const formSaveBtn = btn ? getButtonMetadata(btn) : null;
            const formId = cont.id || `section_${cIdx}`;
            const formSelector = getUniqueSelector(cont);

            fields.forEach(f => {
              f.formId = formId;
              f.formIndex = cIdx - 1;
              f.formTitle = title;
              f.formSelector = formSelector;
              if (!f.saveButton && formSaveBtn) {
                f.saveButton = formSaveBtn;
              }
            });

            detected.push({
              formIndex: cIdx - 1,
              id: formId,
              title: title,
              selector: formSelector,
              fields: fields,
              fieldsCount: fields.length,
              saveButton: formSaveBtn
            });
          }
        }
      });
    }

    // Add a unified combined entry if more than 1 form found
    if (detected.length > 1) {
      const allUniqueFields = [];
      const seen = new Set();
      detected.forEach(d => {
        d.fields.forEach(f => {
          const key = f.id || f.selector || f.name;
          if (!seen.has(key)) {
            seen.add(key);
            allUniqueFields.push(f);
          }
        });
      });

      detected.unshift({
        formIndex: 'all',
        id: 'all_forms_combined',
        title: `Todos los formularios combinados (${allUniqueFields.length} campos)`,
        fields: allUniqueFields,
        fieldsCount: allUniqueFields.length,
        saveButton: null
      });
    }

    return detected;
  }

  // Auto-detect all testable fields within the form or page
  function detectAllFormFields(baseEl) {
    let container = baseEl?.form || baseEl?.closest('form') || document.querySelector('form') || document.body;
    const rawInputs = Array.from(container.querySelectorAll('input, textarea, select, [contenteditable]'));
    const testable = rawInputs.filter(isTestableField);

    const fieldsData = testable.map(el => getElementMetadata(el));
    const detectedBtn = autoDetectSaveButton(testable[0] || baseEl);

    if (detectedBtn) {
      saveButtonElement = detectedBtn;
    }

    return {
      fields: fieldsData,
      saveButton: detectedBtn ? getButtonMetadata(detectedBtn) : null
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // UI overlay elements for the picker
  function createPickerUI(type, extraLabel = '') {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'qa-picker-banner';
      document.body.appendChild(bannerEl);
    }

    const icons = {
      button: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
      form: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="11" y2="17"></line></svg>',
      reopen_step: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
      field: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>'
    };

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

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'qa-picker-tooltip';
      tooltipEl.style.display = 'none';
      document.body.appendChild(tooltipEl);
    }
  }

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

  function startPicking(type = 'field', extraLabel = '') {
    stopPicking();
    if (type === 'button') {
      isPickingSaveButton = true;
    } else if (type === 'form') {
      isPickingForm = true;
    } else if (type === 'reopen_step') {
      isPickingReopenStep = true;
    } else {
      isPickingField = true;
    }
    createPickerUI(type, extraLabel);

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stopPicking() {
    isPickingField = false;
    isPickingSaveButton = false;
    isPickingForm = false;
    isPickingReopenStep = false;
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    removePickerUI();
  }

  function onMouseOver(e) {
    if (!isPickingField && !isPickingSaveButton && !isPickingForm && !isPickingReopenStep) return;
    const target = e.target;
    if (target === bannerEl || bannerEl?.contains(target) || target === tooltipEl) return;

    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
    }

    if (isPickingReopenStep) {
      hoveredElement = target;
      hoveredElement.classList.add('qa-picker-hover-highlight');
      const rawText = target.innerText?.trim() || target.getAttribute('aria-label') || target.value || target.tagName.toLowerCase();
      const text = rawText.split('\n')[0].trim().slice(0, 35) || 'Elemento';

      tooltipEl.innerHTML = `
        <span class="qa-badge" style="background:#8b5cf6;">PASO RE-APERTURA</span>
        <span>${text.replace(/[<>&"]/g, '')}</span>
      `;
      tooltipEl.style.display = 'flex';

      const rect = target.getBoundingClientRect();
      let top = rect.top - 34;
      if (top < 10) top = rect.bottom + 8;
      let left = Math.max(10, rect.left);

      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.left = `${left}px`;
      return;
    }

    if (isPickingForm) {
      const formTarget = target.closest('form, [role="form"], .modal, .card, .section, fieldset') || (isTestableField(target) ? (target.form || target.closest('form') || target) : target);
      if (formTarget) {
        hoveredElement = formTarget;
        hoveredElement.classList.add('qa-form-hover-highlight');
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
      if (tooltipEl) tooltipEl.style.display = 'none';
      if (hoveredElement) {
        hoveredElement.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
        hoveredElement = null;
      }
    }
  }

  function onMouseOut(e) {
    if (!isPickingField && !isPickingSaveButton && !isPickingForm && !isPickingReopenStep) return;
    if (e.target === hoveredElement) {
      e.target.classList.remove('qa-picker-hover-highlight', 'qa-form-hover-highlight');
      hoveredElement = null;
      if (tooltipEl) tooltipEl.style.display = 'none';
    }
  }

  function onClick(e) {
    if (!isPickingField && !isPickingSaveButton && !isPickingForm && !isPickingReopenStep) return;
    const target = e.target;
    if (target === bannerEl || bannerEl?.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();

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
    stopPicking();
  }

  function onKeyDown(e) {
    if ((isPickingField || isPickingSaveButton || isPickingForm || isPickingReopenStep) && e.key === 'Escape') {
      stopPicking();
      chrome.runtime.sendMessage({ action: 'PICKING_CANCELLED' });
    }
  }

  function selectReopenStep(el) {
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

    chrome.runtime.sendMessage({
      action: 'REOPEN_STEP_PICKED',
      data: stepData
    });
  }

  function selectFormElement(formEl) {
    formEl.classList.add('qa-picker-selected-highlight');
    setTimeout(() => formEl?.classList.remove('qa-picker-selected-highlight'), 1800);

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

  function selectTargetElement(el) {
    if (targetElement) {
      targetElement.classList.remove('qa-picker-selected-highlight');
    }
    targetElement = el;
    targetElement.classList.add('qa-picker-selected-highlight');
    setTimeout(() => targetElement?.classList.remove('qa-picker-selected-highlight'), 1800);

    const metadata = getElementMetadata(targetElement);

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

  function selectSaveButton(btnEl) {
    saveButtonElement = btnEl;
    saveButtonElement.classList.add('qa-picker-selected-highlight');
    setTimeout(() => saveButtonElement?.classList.remove('qa-picker-selected-highlight'), 1800);

    chrome.runtime.sendMessage({
      action: 'SAVE_BUTTON_SELECTED',
      data: getButtonMetadata(saveButtonElement)
    });
  }

  // Find DOM element by selector, id, or name
  function resolveFieldElement(fieldInfo) {
    if (!fieldInfo) return targetElement;
    if (fieldInfo.id) {
      const byId = document.getElementById(fieldInfo.id);
      if (byId) return byId;
    }
    if (fieldInfo.selector) {
      try {
        const bySel = document.querySelector(fieldInfo.selector);
        if (bySel) return bySel;
      } catch (e) {
        console.warn('Selector error:', e);
      }
    }
    if (fieldInfo.name) {
      const byName = document.querySelector(`[name="${CSS.escape(fieldInfo.name)}"]`);
      if (byName) return byName;
    }
    return targetElement;
  }

  // Helper to set value on any field safely
  function setFieldValueSafely(el, val) {
    if (!el) return;
    try {
      if (el instanceof HTMLSelectElement) {
        el.value = val;
        // If exact value wasn't found in options, try matching by text
        if (el.value !== val) {
          const opt = Array.from(el.options).find(o => o.text.trim() === String(val).trim());
          if (opt) el.value = opt.value;
        }
      } else if (el.isContentEditable) {
        el.focus();
        el.innerText = val;
        el.textContent = val;
      } else {
        // Reset React's internal value tracker to ensure onChange triggers
        const tracker = el._valueTracker;
        if (tracker) {
          tracker.setValue('');
        }
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
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Detect DOM error messages
  function getActiveErrors(el) {
    const errorMessages = [];

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
          if (node.offsetHeight > 0 && node.offsetWidth > 0) {
            const txt = node.innerText?.trim();
            if (txt && txt.length > 2 && !errorMessages.includes(txt)) {
              errorMessages.push(txt);
            }
          }
        }
      }
    } else {
      // If no form or card container, only check container directly housing the input
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

    const parentGroup = el?.closest('.form-group, .form-field, .input-container, .has-error, .is-invalid');
    if (parentGroup && parentGroup.classList.contains('has-error')) {
      const errSpan = parentGroup.querySelector('.error-text, .help-block, span, p');
      if (errSpan && errSpan.innerText.trim() && !errorMessages.includes(errSpan.innerText.trim())) {
        errorMessages.push(errSpan.innerText.trim());
      }
    }

    return errorMessages;
  }

  // Pre-fill any mandatory / required fields in the same form container so save is not blocked
  function fillMandatoryFormRequirements(targetEl, explicitFillers = []) {
    if (!targetEl) return;

    // 1. First apply any user-configured explicit fillers from the sidepanel
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

    // 2. Locate the parent form or container of the target field
    const parentForm = targetEl.form || targetEl.closest('form, [role="form"], .modal, .card, .section');
    if (!parentForm) return;

    // 3. Scan all controls inside this form/container
    const controls = Array.from(parentForm.querySelectorAll('input, select, textarea'));
    for (const ctrl of controls) {
      if (ctrl === targetEl || filledElements.has(ctrl)) continue;
      if (ctrl.disabled || ctrl.readOnly) continue;

      const tag = ctrl.tagName.toLowerCase();
      const type = (ctrl.getAttribute('type') || '').toLowerCase();
      const isReq = ctrl.required || 
                    ctrl.hasAttribute('required') || 
                    ctrl.getAttribute('aria-required') === 'true' ||
                    ctrl.closest('.form-group, .form-field')?.classList.contains('required');

      // Fill required dropdowns (<select>) that are not selected yet
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

      // Check required checkboxes that are unchecked
      if (type === 'checkbox') {
        if (isReq && !ctrl.checked) {
          ctrl.checked = true;
          ctrl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        continue;
      }

      // Check required radio buttons
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

      // Fill required text / numeric / date inputs that are currently empty
      if (isReq) {
        const currVal = ctrl.value !== undefined ? ctrl.value : '';
        if (currVal.trim() === '') {
          const dummyVal = generateSmartDummyValue(ctrl);
          setFieldValueSafely(ctrl, dummyVal);
        }
      }
    }
  }

  // Dual-phase Execution Engine with Sibling Filler & Re-open Support
  async function runSinglePayload(options) {
    try {
      const reopenConfig = options.reopenConfig;
      let el = resolveFieldElement(options.fieldInfo);

      // STEP 0: AUTO RE-OPEN FORM IF CONFIGURED AND (NOT VISIBLE OR ALWAYS REOPEN IS EXPLICITLY TRUE)
      const isVis = isElementVisible(el);
      const shouldReopen = !isVis || (reopenConfig && reopenConfig.alwaysReopen === true);
      if (reopenConfig && reopenConfig.enabled && Array.isArray(reopenConfig.steps) && reopenConfig.steps.length > 0) {
        if (shouldReopen) {
          await executeReopenSequence(reopenConfig.steps, reopenConfig.waitMs || 400);
          el = await waitForElementVisible(options.fieldInfo, 1800);
        }
      } else if (!isVis) {
        el = await waitForElementVisible(options.fieldInfo, 500);
      }

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

      // STEP 1: PRE-FILL SIBLING AND MANDATORY FIELDS SO THEY DON'T BLOCK SAVE
      fillMandatoryFormRequirements(el, siblingFillers);

      lastCapturedAlert = null;
      const initialErrors = getActiveErrors(el);

      // STEP 2: INJECT TEST VALUE INTO THE TARGET FIELD
      try {
        el.focus();
        el.dispatchEvent(new Event('focus', { bubbles: true }));
      } catch (e) {}

      // Clear field first to eliminate residual values from prior tests (e.g. zero-width or large payloads)
      setFieldValueSafely(el, '');
      setFieldValueSafely(el, payload);
      try {
        el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      } catch (e) {}

      await new Promise((r) => setTimeout(r, 60));

      const resultingValue = el.value !== undefined ? el.value : (el.isContentEditable ? (el.innerText || el.textContent || '') : '');
      const resultingLength = resultingValue.length;
      const payloadLength = payload.length;

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

      // STEP 3: TRIGGER SAVE / SUBMIT ACTION
      let saveAttempted = false;
      let saveBlocked = false;
      let postSubmitErrors = [];
      let saveErrorMessage = '';

      if (triggerSave) {
        saveAttempted = true;
        lastCapturedAlert = null;

        // Dynamically resolve the save button for THIS field's form/container
        let btnToClick = null;

        // 1. Explicit save button assigned from sidepanel (per-form or field)
        const targetBtnMeta = options.saveButton || options.fieldInfo?.saveButton;
        if (targetBtnMeta) {
          const resolvedBtn = resolveFieldElement(targetBtnMeta) || resolveElementByStep(targetBtnMeta);
          if (resolvedBtn && isElementVisible(resolvedBtn)) {
            btnToClick = resolvedBtn;
          }
        }

        // 2. Local button auto-detected inside the field's container
        if (!btnToClick) {
          const localBtn = autoDetectSaveButton(el);
          if (localBtn && isElementVisible(localBtn)) {
            btnToClick = localBtn;
          }
        }

        // 3. Fallback to globally selected button ONLY IF it belongs to the same form or container
        if (!btnToClick && saveButtonElement && isElementVisible(saveButtonElement)) {
          const fieldForm = el.form || el.closest('form, [role="form"], .form-module-card, .modal, .card, .section');
          const btnForm = saveButtonElement.form || saveButtonElement.closest('form, [role="form"], .form-module-card, .modal, .card, .section');
          if (!fieldForm || !btnForm || fieldForm === btnForm) {
            btnToClick = saveButtonElement;
          }
        }

        // Install temporary capture listener to prevent full-page navigation / page reload during test
        const activeForm = el.form || (btnToClick ? btnToClick.closest('form') : null);
        const preventDefaultNavigation = (e) => {
          e.preventDefault();
        };

        if (activeForm) {
          activeForm.addEventListener('submit', preventDefaultNavigation, { capture: true });
        }
        window.addEventListener('submit', preventDefaultNavigation, { capture: true });

        try {
          if (btnToClick && typeof btnToClick.click === 'function') {
            btnToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            btnToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            btnToClick.click();
          } else if (activeForm) {
            if (typeof activeForm.requestSubmit === 'function') {
              activeForm.requestSubmit();
            } else {
              activeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          } else {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
        } catch (submitErr) {
          console.warn('Click on save button threw error:', submitErr);
        }

        await new Promise((r) => setTimeout(r, submitWaitMs));

        if (activeForm) {
          activeForm.removeEventListener('submit', preventDefaultNavigation, { capture: true });
        }
        window.removeEventListener('submit', preventDefaultNavigation, { capture: true });

        postSubmitErrors = getActiveErrors(el);
        const newErrors = postSubmitErrors.filter(err => !initialErrors.includes(err));

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

  // Restore initial value
  function restoreValue(fieldInfo, initialValue) {
    const el = resolveFieldElement(fieldInfo);
    if (!el) return;
    setFieldValueSafely(el, initialValue);
  }

  // Messaging listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PING') {
      sendResponse({ status: 'PONG' });
      return false;
    }

    if (message.action === 'START_PICKING') {
      startPicking('field');
      sendResponse({ status: 'PICKING_STARTED' });
      return false;
    }

    if (message.action === 'START_PICKING_BUTTON') {
      startPicking('button', message.formTitle || '');
      sendResponse({ status: 'BUTTON_PICKING_STARTED' });
      return false;
    }

    if (message.action === 'START_PICKING_FORM') {
      startPicking('form');
      sendResponse({ status: 'FORM_PICKING_STARTED' });
      return false;
    }

    if (message.action === 'START_PICKING_REOPEN_STEP') {
      startPicking('reopen_step');
      sendResponse({ status: 'REOPEN_STEP_PICKING_STARTED' });
      return false;
    }

    if (message.action === 'EXECUTE_REOPEN_STEPS') {
      executeReopenSequence(message.steps || [], message.waitMs || 400)
        .then(() => {
          sendResponse({ status: 'REOPEN_EXECUTED' });
        })
        .catch((err) => {
          console.error('executeReopenSequence error:', err);
          sendResponse({ status: 'REOPEN_ERROR', error: err?.message || String(err) });
        });
      return true;
    }

    if (message.action === 'CANCEL_PICKING') {
      stopPicking();
      sendResponse({ status: 'PICKING_STOPPED' });
      return false;
    }

    if (message.action === 'DETECT_ALL_PAGE_FORMS') {
      try {
        const detected = scanAllPageForms();
        sendResponse({ forms: detected });
      } catch (err) {
        console.error('DETECT_ALL_PAGE_FORMS error:', err);
        sendResponse({ forms: [], error: err?.message });
      }
      return false;
    }

    if (message.action === 'DETECT_ALL_FORM_FIELDS') {
      try {
        const result = detectAllFormFields(targetElement);
        sendResponse(result);
      } catch (err) {
        console.error('DETECT_ALL_FORM_FIELDS error:', err);
        sendResponse({ fields: [], error: err?.message });
      }
      return false;
    }

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
      return true;
    }

    if (message.action === 'RESTORE_INITIAL_VALUE') {
      restoreValue(message.fieldInfo, message.value || '');
      sendResponse({ status: 'RESTORED' });
      return false;
    }

    if (message.action === 'HIGHLIGHT_TARGET') {
      const el = resolveFieldElement(message.fieldInfo);
      if (el) {
        el.classList.add('qa-picker-selected-highlight');
        setTimeout(() => el?.classList.remove('qa-picker-selected-highlight'), 1200);
      }
      sendResponse({ status: 'HIGHLIGHTED' });
      return false;
    }

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
