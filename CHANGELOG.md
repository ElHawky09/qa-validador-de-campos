# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/spec/v2.0.0.html).

## [Sin publicar]

### Añadido
- **test-catalog:** Definir alias canónico SUITES_CATALOG correspondiente a defaultSuites con jerarquía de herencia inmutable de 4 niveles.
- **lab:** Incorporar control encapsulado en Shadow DOM abierto en Formulario 3 de test-sample.html para verificación diagnóstica integral.
- **shadow-dom:** Implementar recolección recursiva de elementos en árboles Shadow DOM abiertos (collectTestableInputs) y retargeting de eventos (composedPath) en picker.js.
- **ui:** Incorporar modal de confirmación para detención de pruebas (#confirm-stop-modal) en el panel lateral, pausando la ejecución de forma no destructiva y evitando cancelaciones accidentales.
- **ui:** Incorporar modal de confirmación previa al inicio de verificación (#confirm-run-modal) en el panel lateral, exhibiendo resumen de campos a evaluar, profundidad seleccionada, total de pruebas y control de confirmación interactivo.
- **test-cases:** Incorporar vectores nativos para campos type="email" (email_valid y email_invalid_format) en defaultSuites, incrementando el catálogo base a 53 pruebas (SEC2-H04).
- **concurrency:** Incorporar botón de cancelación interactiva (#btn-stop-tests) en sidepanel.html y control de aborto reactivo en ejecución de pruebas (SEC2-H12).
- **lab:** Incorporar Formulario 3 de Controles Especializados y Validación Nativa HTML5 en test-sample.html conteniendo campos tel, url, email, pattern y contenteditable (SEC2-H16).
- **shadow-dom:** Implementar función findInShadowRoots en content-scripts/picker.js permitiendo resolver campos encapsulados en árboles Shadow DOM abiertos (SEC2-H17).
- **privacy:** Incorporar Política de Privacidad corporativa independiente (PRIVACY.md) detallando procesamiento estrictamente local, cero telemetría y directivas de datos sintéticos.
- **security:** Incorporar Política de Seguridad y Divulgación Coordinada de Vulnerabilidades (SECURITY.md) con procedimiento formal de reporte y canal confidencial.
- **ui:** Incorporar banner de alcance heurístico y advertencia técnica en la Consola Ejecutiva (dashboard.html y dashboard.css).
- **versioning:** Incorporar CHANGELOG.md segun Keep a Changelog y automatizacion de versionado con update_changelog.ps1.
- **sidepanel:** Integrar acceso a Terminos y Condiciones en encabezado y pie de pagina.

### Cambiado
- **ui:** Aplicar esquema de colores cyberpunk neón entre azul y cyan oscuro en toda la interfaz de usuario (panel lateral, selector visual, dashboard interactivo y términos), preservando estrictamente la disposición estructural, tipografía y dimensiones de todos los componentes.
- **taxonomy:** Reclasificar caso url_internal_ssrf con badgeClass res-risk y severidad prioritaria en categorizeTestRisk (SEC2-H10).
- **diagnostics:** Aislar taxonómicamente el Caso Q para asignar severidad Media (res-format / warning) a vectores estándar que no contengan patrones de inyección (SEC2-H13).
- **recommendations:** Contextualizar sugerencia de longitud máxima en Caso D para sugerir límites de 2,000 a 5,000 caracteres en áreas textarea (SEC2-H09).
- **modal:** Flexibilizar modal de entradas personalizadas para permitir guardar deliberadamente cadenas vacías o espacios en blanco (SEC2-H11).
- **ui:** Deshabilitar botón de reinicio global #btn-reset-all durante la ejecución activa de pruebas (SEC2-H12).
- **legal:** Reestructurar integralmente TERMS.md y dashboard/terms.html: sustituir límite monetario de 0.00 USD por limitación proporcional, eliminar aceptación irrevocable, acotar indemnización y armonizar con la Licencia MIT oficial.
- **diagnostics:** Reformular taxonomía técnica de severidad y métricas: transicionar de severidad crítica a atención prioritaria y de score absoluto a Índice de Resiliencia Heurística en sidepanel.js, sidepanel.html, dashboard.js y dashboard.html.
- **docs:** Saneamiento estructural de README.md: desvincular contrato legal extenso hacia TERMS.md, incorporar enlaces a PRIVACY.md y SECURITY.md, y precisar inferencia de backend a partir de señales observables.

### Corregido
- **depth-selector:** Preservar estados de deselección manual (userDeselected) al alternar entre niveles de profundidad (Simple, Normal, Avanzado, Total) en defaultSuites sin reactivaciones indebidas.
- **heuristics:** Inmunizar áreas de texto <textarea> y editores enriquecidos contenteditable contra categorización espuria como URL cuando contengan descriptores web en etiquetas o placeholders.
- **queue:** Prevenir contaminación cruzada de payloads personalizados en campos numéricos (restringiendo vectores de script/inyección no numéricos) y campos telefónicos/postales (excluyendo emojis).
- **routing:** Desacoplar campos de correo electrónico de heurística de URLs cuando el placeholder o etiqueta contenga términos como dominio, garantizando asignación exclusiva de pruebas de email (SEC2-H04).
- **validation:** Respetar atributo novalidate en formulario y formnovalidate en botón antes de marcar bloqueo de guardado por errores nativos HTML5 en picker (SEC2-H14).
- **heuristics:** Soportar generación inteligente de datos de prueba para atributos pattern con sufijo alfabético en picker (SEC2-H16).
- **taxonomy:** Sustituir identificador tipográfico erróneo num_letters por num_non_numeric en filtros de campos numéricos (SEC2-H01).
- **diagnostics:** Detectar superación de maxlength declarado en persistencia y emitir hallazgo de severidad Alta (res-capacity) en lugar de Conforme (SEC2-H05).
- **diagnostics:** Corregir falso reporte de "Restringido en Campo" en Caso 5 cuando hubo intento de guardado pero el formulario no fue bloqueado a pesar del error HTML5 (SEC2-H14).
- **diagnostics:** Desglosar regla de categoría number en evaluateTestResult distinguiendo num_overflow, num_negative y num_non_numeric (SEC2-H07).
- **diagnostics:** Excluir reducción normalizada de ceros a la izquierda en inputs nativos type="number" del diagnóstico de truncamiento (SEC2-H08).
- **diagnostics:** Incorporar retroalimentación contextual y advertencia técnica cuando un campo viole el atributo pattern declarado (SEC2-H15).
- **routing:** Impedir asignación de vectores de URL completa a campos identificados como slug (SEC2-H02).
- **heuristics:** Incorporar fType === "tel" en la heurística isNumericText para enrutamiento y diagnóstico coherente (SEC2-H03).
- **heuristics:** Excluir campos numéricos textuales (isNumericText) de la recomendación de formato alfabético en txt_15_digits (SEC2-H06).
- **versioning:** Preservar cambios previos en sin publicar, blindar semver y robustecer verificacion.
- **automation:** Omitir confirmaciones meta de changelog para prevenir bucle de registro.
- **sidepanel:** Corregir visualización de pestaña Propios, desincronización de checkSelectAll y cálculo reactivo de selected-count-badge.
- **engine:** Eliminar contaminación cruzada de custom payloads, desvincular slug de URLs y añadir heurística numérica en campos de texto.
- **lab:** Incorporar validación condicional de edad en test-sample.html y ajustar semántica ISO de fecha invertida.
- **ui:** Preservar status-dot en badge de profundidad y añadir opción de URLs en modal de nuevos inputs.
- **taxonomy:** Corregir CATEGORY_META en dashboard.js y categoriesDef en renderDashboardView de sidepanel.js para armonizar la presentación de badges y píldoras hacia Prioritario y Conforme.
- **tone:** Suprimir términos intimidatorios en mayúsculas en CONTRIBUTING.md y PRIVACY.md, y robustecer enlaces a repositorios en terms.html.
- **section-2:** Corregir 12 incidencias en selector de profundidad, reactividad y filtrado contextual.
- **taxonomy:** Armonizar definicion de categorias y eliminar remanentes de severidad critica en dashboard y sidepanel.
- **section-2:** Implementar resolucion integral de 17 hallazgos tecnicos sec2-h01 a sec2-h17.
- **section-2:** Corregir enrutamiento de email, respeto a novalidate y generacion contextual de datos dummy.

### Seguridad
- **auditing:** Auditar código fuente frente a fuga de datos: verificar ausencia de telemetría, transmisiones de red o llamadas remotas en service worker, content scripts, panel lateral y dashboard.
- **legal:** Separar documentacion tecnica y legal, incorporar PRIVACY y SECURITY, y armonizar terminos.

### Documentación
- **legal:** Incorporar TERMS.md, vista terms.html y enlace en pie de pagina del dashboard.
- **specs:** Actualizar a 43 vectores el perfil Avanzado en README.md tras verificación matemática.
- **contact:** Unificar y estandarizar direcciones de contacto legal y reporte de seguridad a `hawkymfs09@proton.me` en SECURITY.md, PRIVACY.md, TERMS.md, CONTRIBUTING.md y terms.html.

## [1.0.0] - 2026-09-15

### Añadido
- Version inicial de la plataforma QA Form Field Validator.
- Extension QA Form Field Validator para Edge, Brave y Chrome.
- Soporte para múltiples botones de guardado por formulario y solución al ciclo de pruebas en selección múltiple.
- **diagnostics:** Motor de evaluación granular, diferenciación de severidad y recomendaciones técnicas específicas.
- **report:** Diseño en tema oscuro para vista web del informe PDF y tema blanco optimizado para impresión.
- **picker:** Detección semántica de campos URL y generación de fillers en minúsculas.
- **sidepanel:** Suite de pruebas de URLs, pestaña dedicada y enrutamiento inteligente por tipo de campo.
- **forms:** Soportar multiples botones de guardado y agrupacion manual de formularios.
- **ui:** Añadir conmutador de vista tabla/dashboard y estructura de dashboard en sidepanel.html.
- **dashboard:** Implementar clasificacion de riesgos, vista dashboard y dashboard interactivo a pantalla completa.
- **dashboard:** Incorporar columna de Tipo de Riesgo con pildoras semanticas y bordes coloreados por severidad en modo tabla.
- **form:** Permitir editar nombre de formulario y eliminar asignacion automatica por primer campo.
- **dashboard:** Enriquecer distribucion visual de riesgos con grafico circular Donut SVG y tarjetas de barras detalladas por severidad.

### Cambiado
- Reemplazar emojis con iconos SVG minimalistas y diseño limpio de interfaz.
- **sidepanel:** Agregar estilos de badges diferenciados para lógica, formato, integridad y capacidad.
- **sample:** Añadir casos de prueba para campos de URL y slug en test-sample.html.
- **forms:** Simplificar a soporte estricto de un solo formulario y un solo boton de guardado.
- **dashboard:** Añadir estilos para conmutador de vista, tarjeta de robustez y grupos de riesgo.
- **dashboard:** Preservar colores semanticos en impresion y PDF mediante print-color-adjust exact en barra de distribucion, kpis, acordeones y badges.

### Corregido
- **picker:** Limpiar campo antes de cada payload y corregir conteo de longitud en contenteditable/react.
- **multi-form:** Aislar botones de guardado por formulario y evitar asignacion al primer formulario.
- **multi-form:** Resolver boton de guardado dentro del formulario correcto usando resolveSaveButton y formSelector.
- **dashboard:** Delegar apertura de pestana al service worker via sendMessage porque sidepanel no tiene acceso a chrome.tabs.
- **dashboard:** Simplificar apertura usando window.open con URL real de extension en vez de sendMessage - solucion directa y confiable.
- **dashboard:** Corregir bug TypeError reading push usando cat.key, agregar persistencia redundante con localStorage y apertura robusta de pestana.
- Eliminar etiquetas de porcentaje redundantes debajo del Donut SVG que se distorsionaban en PDF.
- Eliminar formato de PDF de tabla en el dashboard - forzar exclusivamente formato de categorías para impresión y PDF.

### Seguridad
- **dashboard:** Crear pagina nativa extension dashboard.html para evitar bloqueo about:blank y cumplir CSP.

### Documentación
- Documentar la taxonomía de diagnósticos técnicos y la diferenciación de capas en README.
- **service-worker:** Documentar exhaustivamente cada linea y bloque con explicaciones tecnicas y de APIs.
- **dashboard:** Documentar exhaustivamente funciones, matematicas del Donut SVG y logica del dashboard.
- **dashboard:** Documentar estructura HTML, SVG y secciones de evaluacion de dashboard.html.
- **picker:** Documentar exhaustivamente funciones, seleccion DOM, inyeccion segura y eventos IPC.
- **sidepanel:** Documentar exhaustivamente estructura HTML, accesibilidad, controles y modales de sidepanel.html.
- **sidepanel:** Documentar exhaustivamente logica, motor de pruebas, dashboard y exportadores.
- **picker:** Documentar exhaustivamente reglas CSS y animaciones del overlay selector.
- **test-sample:** Documentar exhaustivamente scripts de simulacion de validaciones y formularios.
- Actualizar README.md con documentacion completa, guia paso a paso y detalles del dashboard ejecutivo.
- Reescribir README con tono enterprise sin emojis y clausulas legales exhaustivas de exencion de responsabilidad.
- Perfeccionar blindaje legal exhaustivo, sincronizar metricas tecnicas de profundidad y alinear documentacion enterprise.
- Agregar CONTRIBUTING.md con guia corporativa de contribucion, flujo git y directivas arquitectonicas.
- **contributing:** Incorporar script fisico check_js.ps1 y sincronizar directivas de verificacion en CONTRIBUTING.md.


[Sin publicar]: https://github.com/ElHawky09/qa-validador-de-campos/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ElHawky09/qa-validador-de-campos/releases/tag/v1.0.0
