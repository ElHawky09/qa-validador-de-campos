# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/spec/v2.0.0.html).

## [Sin publicar]

### Añadido
- **versioning:** Incorporar CHANGELOG.md segun Keep a Changelog y automatizacion de versionado con update_changelog.ps1.
- **sidepanel:** Integrar acceso a Terminos y Condiciones en encabezado y pie de pagina.

### Corregido
- **versioning:** Preservar cambios previos en sin publicar, blindar semver y robustecer verificacion.
- **automation:** Omitir confirmaciones meta de changelog para prevenir bucle de registro.
- **sidepanel:** Corregir visualización de pestaña Propios, desincronización de checkSelectAll y cálculo reactivo de selected-count-badge.
- **engine:** Eliminar contaminación cruzada de custom payloads, desvincular slug de URLs y añadir heurística numérica en campos de texto.
- **lab:** Incorporar validación condicional de edad en test-sample.html y ajustar semántica ISO de fecha invertida.
- **ui:** Preservar status-dot en badge de profundidad y añadir opción de URLs en modal de nuevos inputs.

### Documentación
- **legal:** Incorporar TERMS.md, vista terms.html y enlace en pie de pagina del dashboard.
- **specs:** Actualizar a 43 vectores el perfil Avanzado en README.md tras verificación matemática.

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
