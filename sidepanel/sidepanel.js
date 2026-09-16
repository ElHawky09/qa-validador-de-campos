// =========================================================================================
// QA FORM FIELD VALIDATOR - CONTROLADOR DEL PANEL LATERAL (SIDE PANEL)
// =========================================================================================
// Este archivo actúa como el núcleo orquestador y centro de comando de la interfaz de usuario
// que se muestra en el panel lateral del navegador (Chrome Side Panel API).
// Es compatible con Microsoft Edge, Brave, Google Chrome y cualquier navegador Chromium moderno.
//
// Responsabilidades principales:
// 1. Gestión del estado de la extensión (campos seleccionados, botón de guardar, pasos de reapertura).
// 2. Comunicación bidireccional (IPC) con el content-script (`picker.js`) inyectado en la pestaña web.
// 3. Renderizado dinámico de suites de prueba organizadas por niveles de profundidad (Tiers).
// 4. Ejecución automatizada de pruebas secuenciales con inyección de valores, disparo de eventos y auditoría de guardado.
// 5. Motor de categorización de riesgos (Prioritario, Alto, Medio, Conforme) según la respuesta observable del DOM y la interfaz.
// 6. Generación de informes exportables en formatos Notion (HTML enriquecido), Markdown, CSV, Impresión/PDF y Dashboard gráfico interactivo.
// =========================================================================================

// Se añade un escucha al evento 'DOMContentLoaded' del objeto global 'document'.
// 'document' representa el árbol DOM de la página HTML del side panel ('sidepanel.html').
// 'addEventListener' registra una función callback que se ejecutará cuando el HTML haya sido completamente parseado.
// La palabra clave 'async' permite utilizar 'await' dentro de la función para operaciones asíncronas
// como consultas de pestañas activas o lecturas de base de datos 'chrome.storage.local'.
document.addEventListener('DOMContentLoaded', async () => {

  // =======================================================================================
  // VARIABLES DE ESTADO GLOBAL DE LA APLICACIÓN (SIDE PANEL SCOPE)
  // =======================================================================================
  // La palabra reservada 'let' define variables mutables reasignables limitadas al ámbito de este bloque.

  // Array que contendrá los objetos descriptores de los campos de formulario seleccionados para pruebas.
  // Cada elemento almacena selector CSS, tipo de input, etiqueta humana, valor original y atributos HTML.
  let selectedFields = [];

  // Almacena el descriptor del botón de envío/guardado del formulario (selector, texto, clase, tag).
  // Si es 'null', significa que el usuario no ha seleccionado un botón de guardar aún.
  let currentSaveButton = null;

  // Almacena el identificador numérico de la pestaña activa de Chrome en la que se ejecutan las auditorías.
  let activeTabId = null;

  // Banderas booleanas (flags) para evitar colisiones entre los distintos modos interactivos de selección:
  // Indica si el usuario está actualmente en modo de captura interactiva de un campo individual en la página.
  let isPickingFieldActive = false;

  // Indica si el usuario está en modo de captura interactiva del botón de guardar/submit.
  let isPickingButtonActive = false;

  // Indica si el usuario activó la detección/selección automática de un formulario completo mediante clic.
  let isPickingFormActive = false;

  // Indica si el usuario está seleccionando un elemento interactivo para la secuencia de reapertura de modales/drawers.
  let isPickingReopenStepActive = false;

  // Cadena de texto con el título asignado al formulario actual (personalizable por el usuario o auto-detectado).
  let activeFormTitle = '';

  // Array que guarda la secuencia ordenada de pasos (clics en botones, selectores) necesarios para reabrir el formulario.
  let reopenSteps = [];

  // Categoría de payloads actualmente visible en la interfaz ('all', 'text', 'emoji', 'number', 'date', 'security', 'url').
  let currentCategory = 'all';

  // Filtro de estado aplicado sobre la tabla de resultados ('all', 'restricted', 'conforme', 'risk').
  let activeFilter = 'all';

  // Filtro por campo específico para visualizar únicamente los resultados del input seleccionado en el dropdown ('all' o selector).
  let activeFieldFilter = 'all';

  // Array que almacena los casos de prueba personalizados creados por el usuario mediante el modal "+ Añadir Input".
  let customPayloads = [];

  // Array en memoria que recopila todos los objetos de resultados de pruebas ejecutadas en la sesión actual.
  let testResults = [];

  // Nivel de profundidad activo para filtrar las pruebas predeterminadas ('simple', 'normal', 'advanced', 'total').
  let currentDepthTier = 'normal';

  // Bandera booleana para abortar o detener la ejecución de pruebas bajo demanda del usuario (SEC2-H12).
  let isTestRunCancelled = false;

  // =======================================================================================
  // CONSTANTES DE NIVELES DE PROFUNDIDAD (TIER SYSTEM)
  // =======================================================================================
  // La palabra clave 'const' declara identificadores de solo lectura inmutables en su referencia.

  // Mapa jerárquico numérico para comparar niveles de profundidad.
  // Un nivel superior (ej. 'total' = 4) incluye implícitamente todas las pruebas de niveles inferiores.
  const TIER_HIERARCHY = {
    simple: 1,    // Nivel 1: Verificaciones básicas y mínimas indispensables.
    normal: 2,    // Nivel 2: Casos de uso estándar en formularios web cotidianos.
    advanced: 3,  // Nivel 3: Pruebas de calidad y casos borde complejos (edge cases).
    total: 4      // Nivel 4: Auditoría exhaustiva completa incluyendo ataques de seguridad y sobrecargas.
  };

  // Textos explicativos en español presentados en la interfaz para guiar al auditor sobre el volumen de pruebas.
  const TIER_DESCRIPTIONS = {
    simple: 'Simple (~14 pruebas rápidas)',
    normal: 'Normal (~31 pruebas estándar)',
    advanced: 'Avanzado (~45 pruebas de calidad)',
    total: 'Total (~53 pruebas exhaustivas)'
  };

  // =======================================================================================
  // SUITES DE PRUEBA POR DEFECTO (DEFAULT TEST SUITES)
  // =======================================================================================
  // Colección inmutable de casos de prueba integrados con valores de entrada (payloads), categorías y niveles.
  // Cada objeto contiene:
  // - id: Identificador único de la prueba.
  // - category: Grupo funcional al que pertenece.
  // - tier: Nivel mínimo requerido para ser seleccionado automáticamente.
  // - name: Nombre legible del caso de prueba.
  // - payload: Valor exacto que se inyectará en el campo del formulario web.
  // - desc: Justificación técnica de por qué se realiza esta prueba de calidad o seguridad.
  // - isInvalidCase: Booleano que define si el valor DEBE ser rechazado por una validación correcta.
  //   Si es 'true' y la página lo acepta como válido, se reporta como riesgo o advertencia.
  //   Si es 'false' y la página lo acepta, se considera un comportamiento conforme y esperado.
  const defaultSuites = [
    // -------------------------------------------------------------------------------------
    // GRUPO 1: TEXTO Y LONGITUD (Casos de longitud estándar, espacios y límites de buffer)
    // -------------------------------------------------------------------------------------
    {
      id: 'txt_normal',
      category: 'text',
      tier: 'simple',
      name: 'Texto común',
      payload: 'Prueba de validación QA',
      desc: 'Texto alfabético estándar',
      isInvalidCase: false // Debe ser aceptado en campos de texto normales.
    },
    {
      id: 'txt_spaces',
      category: 'text',
      tier: 'normal',
      name: 'Espacios alrededor',
      payload: '   Texto con espacios al inicio y final   ',
      desc: 'Verificar trim / recorte de espacios en blanco',
      isInvalidCase: false // Caso válido pero verifica si el sistema recorta espacios superfluos.
    },
    {
      id: 'txt_only_spaces',
      category: 'text',
      tier: 'normal',
      name: 'Solo espacios en blanco',
      payload: '       ',
      desc: 'Comprobar si permite campos vacíos mediante espacios',
      isInvalidCase: true // Debería ser rechazado en campos requeridos o no opcionales.
    },
    {
      id: 'txt_zero_width',
      category: 'text',
      tier: 'advanced',
      name: 'Espacios de ancho cero (Zero-width)',
      // Utiliza secuencias de escape Unicode: \u200B (Zero-width space), \u200C (ZWNJ), \u200D (ZWJ), \uFEFF (BOM).
      payload: 'Texto\u200Bcon\u200Cespa\u200Dcios\uFEFFocultos',
      desc: 'Caracteres invisibles Unicode que alteran validaciones',
      isInvalidCase: true // Caracteres no imprimibles que pueden evadir filtros de texto o búsquedas.
    },
    {
      id: 'txt_15_digits',
      category: 'text',
      tier: 'normal',
      name: 'Cadena de 15 dígitos (ej. Tel/ID)',
      payload: '123456789012345',
      desc: '15 dígitos continuos para probar límites de teléfonos/identificaciones',
      isInvalidCase: true // Comprueba si un campo de texto no restringe tamaños arbitrarios de números.
    },
    {
      id: 'txt_50',
      category: 'text',
      tier: 'simple',
      name: 'Longitud moderada (50 chars)',
      // El método String.prototype.repeat repite el carácter 'A' cincuenta veces exactamente.
      payload: 'A'.repeat(50),
      desc: '50 caracteres exactos',
      isInvalidCase: false
    },
    {
      id: 'txt_255',
      category: 'text',
      tier: 'normal',
      name: 'Límite estándar DB (255 chars)',
      // 255 caracteres es la longitud máxima histórica de una columna VARCHAR estándar en SQL (MySQL, PostgreSQL).
      payload: 'B'.repeat(255),
      desc: '255 caracteres exactos (límite común de VARCHAR)',
      isInvalidCase: false
    },
    {
      id: 'txt_1000',
      category: 'text',
      tier: 'advanced',
      name: 'Texto extenso (1,000 chars)',
      // 1000 caracteres verifica si inputs de una sola línea provocan desbordamientos visuales o errores 500.
      payload: 'C'.repeat(1000),
      desc: 'Cadena de 1,000 caracteres para prueba de desbordamiento',
      isInvalidCase: true
    },
    {
      id: 'txt_5000',
      category: 'text',
      tier: 'total',
      name: 'Sobrecarga de texto (5,000 chars)',
      // 5000 caracteres genera una carga pesada sobre el parser del DOM y comprueba si hay cuelgues de UI.
      payload: 'D'.repeat(5000),
      desc: 'Sobrecarga extrema para evaluar límite o lag de UI',
      isInvalidCase: true
    },
    {
      id: 'txt_multiline',
      category: 'text',
      tier: 'advanced',
      name: 'Saltos de línea y tabuladores',
      // Inyecta retornos de carro \r, saltos de línea \n y tabulaciones \t para probar compatibilidad multilínea.
      payload: 'Línea 1\nLínea 2\r\nLínea 3\tTab',
      desc: 'Caracteres de control multilínea',
      isInvalidCase: false
    },
    {
      id: 'email_valid',
      category: 'text',
      tier: 'simple',
      name: 'Correo electrónico válido',
      // Dirección canónica estándar conforme a especificación RFC 5322.
      payload: 'auditoria.qa@dominio-valido.com',
      desc: 'Formato estándar de correo con usuario, arroba y dominio válido',
      isInvalidCase: false
    },
    {
      id: 'email_invalid_format',
      category: 'text',
      tier: 'normal',
      name: 'Correo sin arroba (@)',
      // Cadena textual sin arroba que debe ser rechazada por controles nativos type="email".
      payload: 'usuario-sin-arroba.com',
      desc: 'Formato de correo inválido para verificar validación RFC 5322',
      isInvalidCase: true
    },

    // -------------------------------------------------------------------------------------
    // GRUPO 2: UNICODE Y SÍMBOLOS (Validación de codificación UTF-8, emojis y glifos globales)
    // -------------------------------------------------------------------------------------
    {
      id: 'emo_standard',
      category: 'emoji',
      tier: 'simple',
      name: 'Emojis comunes (4 bytes UTF-8)',
      // Los emojis modernos requieren 4 bytes en UTF-8. Si la base de datos utiliza una codificación
      // antigua de MySQL como 'utf8' (que solo admite 3 bytes por caracter) en lugar de 'utf8mb4',
      // la inserción fallará arrojando un error de truncamiento o una excepción fatal 500.
      payload: '\uD83D\uDE00 \uD83C\uDF89 \uD83D\uDD25 \uD83D\uDE80',
      desc: 'Validar soporte UTF8mb4 en base de datos',
      isInvalidCase: false // Texto legítimo en aplicaciones modernas (mensajería, perfiles, etc.).
    },
    {
      id: 'emo_compound',
      category: 'emoji',
      tier: 'advanced',
      name: 'Emoji compuesto con ZWJ',
      // Los emojis compuestos unen múltiples glifos mediante el caracter especial Zero-Width Joiner (\u200D).
      // Por ejemplo, una familia o profesionales con modificadores de tono de piel.
      // Permite comprobar si el renderizado del frontend o el contador de caracteres maneja grafemas correctamente.
      payload: '\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66 \uD83D\uDC68\u200D\uD83D\uDCBB',
      desc: 'Secuencias compuestas (Zero-Width Joiner)',
      isInvalidCase: false
    },
    {
      id: 'emo_flags',
      category: 'emoji',
      tier: 'advanced',
      name: 'Banderas regionales',
      // Las banderas no son un solo carácter, sino pares de Regional Indicator Symbols (ej. E + S = España).
      // Permite evaluar la representación de glifos compuestos y longitudes de cadena en bytes vs caracteres.
      payload: '\uD83C\uDDEA\uD83C\uDDF8 \uD83C\uDDF2\uD83C\uDDFD \uD83C\uDDE8\uD83C\uDDF1 \uD83C\uDDE6\uD83C\uDDF7 \uD83C\uDDFA\uD83C\uDDF8',
      desc: 'Unicode Regional Indicator Symbols',
      isInvalidCase: false
    },
    {
      id: 'sym_specials',
      category: 'emoji',
      tier: 'normal',
      name: 'Caracteres especiales de teclado',
      // Verifica si los caracteres estándar de puntuación y operadores matemáticos son procesados
      // sin romper la serialización JSON, XML o consultas dinámicas de backend.
      payload: '!@#$%^&*()_+-=[]{}|;:\'",./<>?~`',
      desc: 'Símbolos tipográficos y de puntuación',
      isInvalidCase: false
    },
    {
      id: 'sym_quotes',
      category: 'emoji',
      tier: 'advanced',
      name: 'Comillas y apóstrofes variados',
      // Comillas rectas (') ("), backticks (`), y comillas tipográficas curvadas (‘ ’ “ ” « »).
      // Comprueba si los parsers de SQL o plantillas escapan o desinfectan adecuadamente las comillas.
      payload: '\' " ` ‘ ’ “ ” « »',
      desc: 'Comillas rectas, curvas y tipográficas',
      isInvalidCase: false
    },
    {
      id: 'uni_accents',
      category: 'emoji',
      tier: 'simple',
      name: 'Acentos y diacríticos (Español)',
      // Vocales acentuadas, diéresis, eñes y cedillas indispensables en el idioma español y lenguas latinas.
      // Ayuda a detectar si una expresión regular restrictiva (ej. solo [A-Za-z]) bloquea nombres hispanos.
      payload: 'áéíóú ÁÉÍÓÚ ñ Ñ ü Ü ç Ç',
      desc: 'Caracteres lingüísticos válidos en español',
      isInvalidCase: false
    },
    {
      id: 'uni_foreign',
      category: 'emoji',
      tier: 'total',
      name: 'Alfabetos Cirílico y CJK',
      // Caracteres en Cirílico (Ruso), Chino tradicional y Japonés (Hiragana/Katakana).
      // Valida la internacionalización (i18n) y almacenamiento de alfabetos no latinos.
      payload: 'Привет мир / 測試 / こんにちは',
      desc: 'Caracteres internacionales no latinos',
      isInvalidCase: false
    },
    {
      id: 'uni_rtl',
      category: 'emoji',
      tier: 'total',
      name: 'Texto bidireccional / RTL',
      // Cadenas en Árabe y Hebreo cuya dirección de lectura natural es de derecha a izquierda (Right-To-Left).
      // Comprueba si la interfaz altera su maquetación visual o si los campos de entrada soportan direccionalidad mixta.
      payload: 'مرحبا بالعالم - שלום',
      desc: 'Árabe y Hebreo (direccionalidad derecha a izquierda)',
      isInvalidCase: false
    },

    // -------------------------------------------------------------------------------------
    // GRUPO 3: NÚMEROS Y FORMATOS NUMÉRICOS (Validación de tipos, rangos y precisión)
    // -------------------------------------------------------------------------------------
    {
      id: 'num_positive',
      category: 'number',
      tier: 'simple',
      name: 'Entero positivo',
      // Caso positivo ideal para campos que esperan cantidades enteras (edad, stock, código postal numérico).
      payload: '42',
      desc: 'Número entero estándar',
      isInvalidCase: false
    },
    {
      id: 'num_zero',
      category: 'number',
      tier: 'simple',
      name: 'Cero (0)',
      // El valor cero suele causar fallos de lógica condicional en JavaScript si se evalúa como falsy
      // (ej. 'if (value)' evalúa '0' como false en lugar de un número válido ingresado).
      payload: '0',
      desc: 'Valor cero exacto',
      isInvalidCase: false
    },
    {
      id: 'num_negative',
      category: 'number',
      tier: 'normal',
      name: 'Número negativo',
      // Valida si campos que representan magnitudes físicas o monetarias (edad, precio, cantidad de artículos)
      // prohíben números negativos mediante atributos 'min="0"' o validaciones personalizadas.
      payload: '-50',
      desc: 'Valor con signo negativo',
      isInvalidCase: true
    },
    {
      id: 'num_decimal',
      category: 'number',
      tier: 'normal',
      name: 'Decimal estándar',
      // Número con parte fraccionaria mediante punto decimal. Verifica soporte para monedas o medidas exactas.
      payload: '99.99',
      desc: 'Número con punto decimal',
      isInvalidCase: false
    },
    {
      id: 'num_scientific',
      category: 'number',
      tier: 'advanced',
      name: 'Notación científica',
      // Notación con exponente (1e5 = 100,000). Muchos campos numéricos HTML5 tipo 'number' lo aceptan
      // de forma nativa en el navegador, pero el backend puede fallar al convertirlo o parsearlo a entero.
      payload: '1e5',
      desc: 'Formato exponencial (100,000)',
      isInvalidCase: true
    },
    {
      id: 'num_overflow',
      category: 'number',
      tier: 'advanced',
      name: 'Desbordamiento numérico',
      // 20 nueves consecutivos. Supera el límite de enteros seguros de JavaScript (Number.MAX_SAFE_INTEGER = 9007199254740991)
      // y límites típicos de enteros de 32 o 64 bits en bases de datos relacionales, pudiendo causar redondeos o excepciones.
      payload: '99999999999999999999',
      desc: 'Número que supera límites de enteros de 32/64 bits',
      isInvalidCase: true
    },
    {
      id: 'num_non_numeric',
      category: 'number',
      tier: 'simple',
      name: 'Texto en campo numérico',
      // Cadena de letras inyectada en un campo numérico. Debe ser rechazada inmediatamente por la UI o el backend.
      payload: 'abcDEF',
      desc: 'Letras donde solo se esperan dígitos',
      isInvalidCase: true
    },
    {
      id: 'num_symbols',
      category: 'number',
      tier: 'normal',
      name: 'Símbolos en campo numérico',
      // Caracteres que los usuarios suelen escribir por error en campos numéricos (signos de moneda, comas, porcentajes).
      payload: '+ - . , $ € %',
      desc: 'Signos de puntuación o divisas',
      isInvalidCase: true
    },
    {
      id: 'num_leading_zeros',
      category: 'number',
      tier: 'total',
      name: 'Ceros a la izquierda',
      // Comprueba si los ceros no significativos a la izquierda son preservados (importante en códigos postales o folios)
      // o si son eliminados automáticamente al parsearse como entero matemático.
      payload: '00075',
      desc: 'Número con ceros precedentes',
      isInvalidCase: false
    },

    // -------------------------------------------------------------------------------------
    // GRUPO 4: FECHAS Y TIEMPOS (Validación de formatos de calendario, bisiestos y rangos)
    // -------------------------------------------------------------------------------------
    {
      id: 'date_valid',
      category: 'date',
      tier: 'simple',
      name: 'Fecha ISO válida',
      // Formato canónico internacional estándar ISO 8601 (AAAA-MM-DD). Es el estándar utilizado por inputs HTML5 'date'.
      payload: '2024-05-15',
      desc: 'Formato estándar AAAA-MM-DD',
      isInvalidCase: false
    },
    {
      id: 'date_leap_valid',
      category: 'date',
      tier: 'normal',
      name: '29 de Febrero (Año bisiesto 2024)',
      // 2024 es un año bisiesto divisible por 4. El 29 de febrero existe legítimamente en el calendario.
      payload: '2024-02-29',
      desc: 'Día bisiesto en año bisiesto válido',
      isInvalidCase: false
    },
    {
      id: 'date_leap_invalid',
      category: 'date',
      tier: 'advanced',
      name: '29 de Febrero (No bisiesto 2023)',
      // 2023 no es un año bisiesto; el 29 de febrero no existe. Comprueba si el validador calcula la bisiestidad
      // o si deja pasar la fecha convirtiéndola erróneamente en 1 de marzo (overflow de fecha).
      payload: '2023-02-29',
      desc: 'Fecha imposible en el calendario gregoriano',
      isInvalidCase: true
    },
    {
      id: 'date_day_32',
      category: 'date',
      tier: 'normal',
      name: 'Día 32 inexistente',
      // Ningún mes del año cuenta con 32 días. Valida que el día esté acotado entre 1 y 31.
      payload: '2024-01-32',
      desc: 'Día fuera de rango calendario',
      isInvalidCase: true
    },
    {
      id: 'date_month_13',
      category: 'date',
      tier: 'normal',
      name: 'Mes 13 inexistente',
      // El año gregoriano solo tiene 12 meses. Un valor 13 debe ser bloqueado terminantemente.
      payload: '2024-13-10',
      desc: 'Mes superior a 12',
      isInvalidCase: true
    },
    {
      id: 'date_boundary_past',
      category: 'date',
      tier: 'total',
      name: 'Fecha límite pasada (1899-12-31)',
      // Fecha anterior al siglo XX. Útil para verificar campos de fecha de nacimiento o vencimiento.
      payload: '1899-12-31',
      desc: 'Fecha histórica extrema',
      isInvalidCase: true
    },
    {
      id: 'date_boundary_future',
      category: 'date',
      tier: 'total',
      name: 'Fecha límite futura (2099-12-31)',
      // Fecha en el final del siglo XXI. Comprueba límites temporales hacia adelante en reservas o fechas de expiración.
      payload: '2099-12-31',
      desc: 'Fecha a muy largo plazo',
      isInvalidCase: true
    },
    {
      id: 'date_reversed',
      category: 'date',
      tier: 'advanced',
      name: 'Formato invertido (31/12/2024)',
      // Formato común hispanohablante (DD/MM/AAAA) con barras inclinadas en lugar de guiones ISO.
      // Evalúa la tolerancia o conversión automática de formato en la interfaz.
      payload: '31/12/2024',
      desc: 'Formato DD/MM/AAAA común en habla hispana',
      isInvalidCase: true
    },
    {
      id: 'date_free_text',
      category: 'date',
      tier: 'simple',
      name: 'Texto libre en campo de fecha',
      // Lenguaje natural ("ayer por la tarde") inyectado en un campo que espera fecha estructurada.
      payload: 'ayer por la tarde',
      desc: 'Cadena arbitraria en selector de fecha',
      isInvalidCase: true
    },

    // -------------------------------------------------------------------------------------
    // GRUPO 5: SEGURIDAD, INYECCIÓN Y VECTORES DE ATAQUE (OWASP Top 10)
    // -------------------------------------------------------------------------------------
    {
      id: 'sec_script',
      category: 'security',
      tier: 'simple',
      name: 'Etiqueta <script> (XSS básico)',
      // Vector de Cross-Site Scripting (XSS) reflejado o almacenado. Comprueba si el HTML escapa
      // los caracteres especiales (< > & " ') antes de reflejar el valor en la pantalla del usuario.
      payload: '<script>alert("XSS")</script>',
      desc: 'Intento de inyección de script ejecutable',
      isInvalidCase: true
    },
    {
      id: 'sec_img_onerror',
      category: 'security',
      tier: 'normal',
      name: 'Etiqueta <img> con onerror (XSS)',
      // Vector de inyección que no depende de etiquetas <script>, sino del evento onerror de una imagen con ruta rota.
      // Bypasea filtros que únicamente buscan la palabra clave 'script'.
      payload: '<img src="x" onerror="alert(1)">',
      desc: 'Vector XSS por manejo de errores en atributos',
      isInvalidCase: true
    },
    {
      id: 'sec_html_tags',
      category: 'security',
      tier: 'advanced',
      name: 'Etiquetas HTML de formato (<b>, <h1>)',
      // Inyección de HTML benigno para evaluar Defacement (alteración visual de la interfaz) o inyección de contenido.
      payload: '<b>Texto en Negrita</b> <h1>Título</h1>',
      desc: 'Inyección de marcado enriquecido',
      isInvalidCase: true
    },
    {
      id: 'sec_sql_basic',
      category: 'security',
      tier: 'normal',
      name: 'Patrón SQL Injection básico',
      // Payload clásico de Inyección SQL (' OR '1'='1' --). Si el backend concatena strings en lugar de
      // utilizar consultas parametrizadas (Prepared Statements), la condición siempre evaluará a verdadero,
      // alterando la lógica de autenticación o recuperación de datos.
      payload: '\' OR \'1\'=\'1\' --',
      desc: 'Bypass clásico de autenticación o consulta',
      isInvalidCase: true
    },
    {
      id: 'sec_null_byte',
      category: 'security',
      tier: 'total',
      name: 'Null byte (%00)',
      // El byte nulo (\u0000 o ASCII 0x00) actúa como terminador de cadena en lenguajes como C y C++.
      // En sistemas vulnerables, puede engañar a verificadores de extensiones de archivos (ej. 'archivo.pdf\0.exe').
      payload: 'archivo.pdf\u0000.exe',
      desc: 'Inyección de terminador de cadena en C/sistemas operativos',
      isInvalidCase: true
    },

    // -------------------------------------------------------------------------------------
    // GRUPO 6: PRUEBAS DE URL, ENLACES Y PROTOCOLOS DE RED (RFC 3986 y SSRF)
    // -------------------------------------------------------------------------------------
    {
      id: 'url_valid_https',
      category: 'url',
      tier: 'simple',
      name: 'URL HTTPS válida estándar',
      // Dirección web absoluta bien estructurada con esquema seguro HTTPS, subdominio, dominio y ruta de recurso.
      payload: 'https://qa.ejemplo.com/recurso-valido',
      desc: 'Formato canónico completo con esquema seguro, host y ruta',
      isInvalidCase: false
    },
    {
      id: 'url_missing_scheme',
      category: 'url',
      tier: 'simple',
      name: 'URL sin protocolo (falta https://)',
      // Dirección web sin protocolo explícito (www.ejemplo.com). Permite verificar si la aplicación
      // lo antepone automáticamente (https://) o si exige que el usuario lo escriba explícitamente.
      payload: 'www.ejemplo.com/recurso',
      desc: 'Verificar si el sistema auto-completa o rechaza URLs sin protocolo',
      isInvalidCase: true
    },
    {
      id: 'url_xss_javascript',
      category: 'url',
      tier: 'simple',
      name: 'Esquema peligroso javascript: (XSS)',
      // Pseudoprotocolo 'javascript:'. Si este enlace es renderizado dentro de un tag <a href="...">
      // y el usuario hace clic en él, ejecutará el código JavaScript arbitrario en el contexto de la página.
      payload: 'javascript:alert("XSS")',
      desc: 'Inyección de pseudoprotocolo para ejecución de script en enlaces',
      isInvalidCase: true
    },
    {
      id: 'url_valid_query',
      category: 'url',
      tier: 'normal',
      name: 'URL con query parameters y puerto',
      // URL compleja con puerto de red explícito (:8080) y parámetros de consulta (querystring).
      payload: 'https://api.ejemplo.com:8080/v1/items?id=123&status=ok',
      desc: 'Estructura URL avanzada con puerto explícito y parámetros GET',
      isInvalidCase: false
    },
    {
      id: 'url_unencoded_spaces',
      category: 'url',
      tier: 'normal',
      name: 'URL con espacios no codificados',
      // Las URLs según el estándar RFC 3986 no pueden contener caracteres de espacio sin codificar (%20).
      payload: 'https://ejemplo.com/ruta con espacios',
      desc: 'Violación RFC 3986 por falta de percent-encoding (%20)',
      isInvalidCase: true
    },
    {
      id: 'url_invalid_domain',
      category: 'url',
      tier: 'normal',
      name: 'Dominio/Host malformado con puntos dobles',
      // Dos puntos consecutivos en el nombre de dominio infringen la especificación DNS y RFC 1123.
      payload: 'https://dominio..ejemplo.com/item',
      desc: 'Hostname inválido según sintaxis RFC 1123',
      isInvalidCase: true
    },
    {
      id: 'url_protocol_relative',
      category: 'url',
      tier: 'advanced',
      name: 'URL relativa de protocolo (//ejemplo.com)',
      // Enlace relativo que hereda el esquema del contexto padre (HTTP o HTTPS).
      // En muchos formularios debe restringirse a URLs absolutas canónicas.
      payload: '//ejemplo.com/recurso',
      desc: 'Verificar si acepta o resuelve enlaces dependientes de protocolo',
      isInvalidCase: true
    },
    {
      id: 'url_internal_ssrf',
      category: 'url',
      tier: 'advanced',
      name: 'Host local / Intranet (Riesgo SSRF)',
      // Vector de Server-Side Request Forgery (SSRF). Si el backend descarga o inspecciona la URL enviada,
      // podría acceder a servicios internos confidenciales en localhost (127.0.0.1) o metadata cloud.
      payload: 'http://127.0.0.1:8080/admin',
      desc: 'Destino a interfaz loopback o infraestructura interna no restringida',
      isInvalidCase: true
    },
    {
      id: 'url_data_scheme',
      category: 'url',
      tier: 'advanced',
      name: 'Esquema data: con HTML/script',
      // Esquema 'data:' con carga Base64 que contiene un script ejecutable.
      // Si se abre o renderiza en un iframe o enlace sin restricciones, puede ejecutar código no deseado.
      payload: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      desc: 'Esquema URI peligroso capaz de generar contexto de ejecución arbitrario',
      isInvalidCase: true
    },
    {
      id: 'url_excessive_length',
      category: 'url',
      tier: 'total',
      name: 'URL extremadamente larga (>2000 chars)',
      // Cadena de más de 2000 caracteres. Muchos servidores web y navegadores cortan o rechazan URLs
      // que superan los 2048 caracteres con errores '414 Request-URI Too Long'.
      payload: 'https://ejemplo.com/' + 'a'.repeat(2000),
      desc: 'Verificar tolerancia a límites de URI en navegadores y servidores (2048)',
      isInvalidCase: true
    }
  ];

  // =======================================================================================
  // REFERENCIAS A ELEMENTOS DEL DOM (DOCUMENT OBJECT MODEL)
  // =======================================================================================
  // Se obtienen punteros directos a los nodos HTML de 'sidepanel.html' mediante 'getElementById' y 'querySelectorAll'.
  // Esto optimiza el rendimiento evitando búsquedas repetitivas en el árbol DOM durante la ejecución.

  // Botones y badges de captura de campos individuales y detección automática de formularios:
  const btnPickField = document.getElementById('btn-pick-field'); // Botón para iniciar el cursor inspector de un campo.
  const pickBtnText = document.getElementById('pick-btn-text'); // Etiqueta textual del botón de captura individual.
  const btnAutoDetectForm = document.getElementById('btn-auto-detect-form'); // Botón para auto-descubrir el formulario completo en la página.
  const fieldsCountBadge = document.getElementById('fields-count-badge'); // Badge numérico que indica cuántos campos han sido capturados.
  const fieldEmptyState = document.getElementById('field-empty-state'); // Contenedor visual mostrado cuando la lista de campos está vacía.
  const selectedFieldsList = document.getElementById('selected-fields-list'); // Contenedor flex donde se renderizan los chips de campos seleccionados.
  const btnPickFormClick = document.getElementById('btn-pick-form-click'); // Botón secundario para seleccionar un contenedor de formulario haciendo clic.
  const pickFormBtnText = document.getElementById('pick-form-btn-text'); // Texto del botón de selección manual de formulario.
  const btnResetAll = document.getElementById('btn-reset-all'); // Botón de reinicio global para limpiar campos, resultados y estado.

  // Referencias a la caja de personalización del nombre del formulario:
  const formNameBox = document.getElementById('form-name-box'); // Contenedor del input para nombrar el formulario.
  const inputFormTitle = document.getElementById('input-form-title'); // Input de texto donde el auditor escribe el título del formulario auditado.

  // Si el elemento inputFormTitle existe en el DOM, se asocia un listener al evento 'input'.
  // Cada vez que el usuario teclea un caracter, se actualiza reactivamente la variable 'activeFormTitle'.
  if (inputFormTitle) {
    inputFormTitle.addEventListener('input', () => {
      // El método String.prototype.trim elimina espacios en blanco sobrantes a los extremos.
      activeFormTitle = inputFormTitle.value.trim();
    });
  }

  // Referencias a la sección de configuración del botón de guardar (Save Button):
  const saveButtonBox = document.getElementById('save-button-box'); // Contenedor que agrupa la información del botón de envío.
  const saveBtnPill = document.getElementById('save-btn-pill'); // Píldora visual que muestra el nombre o selector del botón configurado.
  const btnInspectSave = document.getElementById('btn-inspect-save'); // Botón de mira telescópica para resaltar el botón de guardar en la página.
  const btnChangeSave = document.getElementById('btn-change-save'); // Botón para cambiar o reasignar interactivamente el botón de guardar.
  const changeSaveBtnText = document.getElementById('change-save-btn-text'); // Texto del botón de cambio ("Cambiar" o "Cancelar").

  // Referencias a la sección de campos hermanos de relleno (Sibling Fillers):
  const siblingFillersBox = document.getElementById('sibling-fillers-box'); // Contenedor de la lista de campos que no se auditan pero requieren valor.
  const checkEnableSiblingFillers = document.getElementById('check-enable-sibling-fillers'); // Checkbox para activar/desactivar el auto-llenado de hermanos.
  const siblingFillersList = document.getElementById('sibling-fillers-list'); // Contenedor DOM donde se listan los campos hermanos y sus valores asignados.

  // Referencias al flujo de reapertura de formularios en modales o drawers (Re-open Flow):
  const reopenFlowBox = document.getElementById('reopen-flow-box'); // Contenedor de configuración de reapertura de diálogos emergentes.
  const checkEnableReopen = document.getElementById('check-enable-reopen'); // Checkbox para activar la reapertura automática entre pruebas.
  const reopenStepsContent = document.getElementById('reopen-steps-content'); // Bloque colapsable que aloja la lista de pasos grabados.
  const reopenStepsList = document.getElementById('reopen-steps-list'); // Lista visual ordenada de pasos secuenciales para reabrir el modal.
  const btnAddReopenStep = document.getElementById('btn-add-reopen-step'); // Botón para capturar un nuevo clic en la secuencia de reapertura.
  const btnTestReopen = document.getElementById('btn-test-reopen'); // Botón para probar en vivo la secuencia grabada en la pestaña actual.

  // Referencias a la selección de suites de prueba, filtros por categoría y profundidad:
  const depthButtons = document.querySelectorAll('.depth-btn'); // Colección de botones para alternar entre niveles Simple, Normal, Avanzado y Total.
  const depthDescBadge = document.getElementById('depth-desc-badge'); // Badge informativo con el conteo aproximado y descripción del nivel actual.
  const categoryTabs = document.querySelectorAll('.tab-btn'); // Pestañas superiores de categorías (Todas, Texto, Emoji, Números, Fechas, Seguridad, URL).
  const checkSelectAll = document.getElementById('check-select-all'); // Checkbox maestro para seleccionar o deseleccionar todas las pruebas de la vista activa.
  const btnOpenCustomModal = document.getElementById('btn-open-custom-modal'); // Botón "+ Añadir Input" para desplegar el modal de creación de payloads propios.
  const payloadsContainer = document.getElementById('payloads-container'); // Contenedor scrollable donde se renderizan las tarjetas de cada caso de prueba.
  const selectedCountBadge = document.getElementById('selected-count-badge'); // Badge que muestra el total dinámico de pruebas seleccionadas listas para ejecutarse.

  // Referencias a los controles de configuración y ejecución de pruebas:
  const checkTriggerSave = document.getElementById('check-trigger-save'); // Checkbox para auditar fase 2 (hacer clic real en Guardar tras inyectar valor).
  const executionSpeedSelect = document.getElementById('execution-speed'); // Selector de velocidad entre pruebas (Rápido: 100ms, Normal: 300ms, Lento: 700ms).
  const submitWaitTimeSelect = document.getElementById('submit-wait-time'); // Selector del tiempo de espera para observar la respuesta del servidor (500ms, 1s, 2s, 3s).
  const checkRestoreValue = document.getElementById('check-restore-value'); // Checkbox para reponer el valor original del input al finalizar toda la auditoría.
  const btnRunTests = document.getElementById('btn-run-tests'); // Botón principal de acción para iniciar la batería automatizada de pruebas.
  const btnStopTests = document.getElementById('btn-stop-tests'); // Botón secundario para detener interactivamente la ejecución de pruebas.
  const runBtnText = document.getElementById('run-btn-text'); // Texto interno del botón de ejecución (muestra cantidad de campos seleccionados).
  const progressContainer = document.getElementById('progress-container'); // Contenedor de la barra de progreso visible durante la ejecución.
  const progressLabel = document.getElementById('progress-label'); // Texto con el progreso paso a paso (ej. "Campo 1/3: Prueba 5/29").
  const progressPercent = document.getElementById('progress-percent'); // Porcentaje numérico completado (ej. "45%").
  const progressBarFill = document.getElementById('progress-bar-fill'); // Elemento div que se ensancha mediante CSS width para reflejar el progreso.

  // Referencias al resumen de resultados y KPIs de auditoría:
  const resultsCard = document.getElementById('results-card'); // Tarjeta contenedor que agrupa la tabla, KPIs y exportaciones.
  const btnClearResults = document.getElementById('btn-clear-results'); // Botón para descartar y vaciar la tabla de resultados actual.
  const kpiTotal = document.getElementById('kpi-total'); // Contador KPI: Total de pruebas ejecutadas.
  const kpiRestricted = document.getElementById('kpi-restricted'); // Contador KPI: Pruebas con restricción detectada (bloqueo por frontend o backend).
  const kpiConforme = document.getElementById('kpi-conforme'); // Contador KPI: Pruebas válidas aceptadas conforme a lo esperado.
  const kpiRisk = document.getElementById('kpi-risk'); // Contador KPI: Casos inválidos aceptados o errores 500 catalogados como riesgo/advertencia.
  const resultsFilterChips = document.querySelectorAll('.filter-chip'); // Chips de filtro superior (Todos, Restringidos, Conformes, Riesgos).
  const filterFieldSelect = document.getElementById('filter-field-select'); // Dropdown para filtrar la vista por un campo de texto específico.
  const resultsTbody = document.getElementById('results-tbody'); // Cuerpo de la tabla (tbody) donde se insertan las filas dinámicas de resultados.

  // Referencias a los contenedores de vista (Tabla clásica vs Dashboard gráfico):
  const btnViewTable = document.getElementById('btn-view-table'); // Botón de alternancia a vista de tabla detallada.
  const btnViewDashboard = document.getElementById('btn-view-dashboard'); // Botón de alternancia a vista de dashboard visual ejecutivo.
  const tableViewContainer = document.getElementById('table-view-container'); // Contenedor con la tabla y buscador de resultados.
  const dashboardViewContainer = document.getElementById('dashboard-view-container'); // Contenedor con gráficos de barras, KPIs y desglose de severidad.
  const dashboardRiskLevelBadge = document.getElementById('dashboard-risk-level-badge'); // Badge con el nivel general de riesgo y resiliencia (Prioritario, Alto, Medio, Conforme).
  const dashboardScoreVal = document.getElementById('dashboard-score-val'); // Puntuación de calidad calculada de 0 a 100 puntos.
  const dashboardSummaryMsg = document.getElementById('dashboard-summary-msg'); // Párrafo explicativo con la conclusión del diagnóstico.
  const statCriticalCount = document.getElementById('stat-critical-count'); // Contador de indicadores de seguridad prioritarios.
  const statHighCount = document.getElementById('stat-high-count'); // Contador de fallos de severidad alta.
  const statMediumCount = document.getElementById('stat-medium-count'); // Contador de observaciones de severidad media.
  const statSafeCount = document.getElementById('stat-safe-count'); // Contador de pruebas seguras/conformes.
  const dashboardDistBar = document.getElementById('dashboard-dist-bar'); // Barra segmentada multicolor que muestra visualmente la distribución de riesgos.
  const dashboardRiskGroups = document.getElementById('dashboard-risk-groups'); // Contenedor de grupos de riesgo en acordeones expandibles.

  // Referencias a los botones de la barra de exportación:
  const btnOpenDashboard = document.getElementById('btn-open-dashboard'); // Abre el dashboard gráfico interactivo en una pestaña dedicada.
  const btnCopyNotion = document.getElementById('btn-copy-notion'); // Copia la tabla estructurada en HTML enriquecido listo para pegar directamente en Notion.
  const btnCopyMarkdown = document.getElementById('btn-copy-markdown'); // Copia la tabla en sintaxis estándar GitHub Flavored Markdown (GFM).
  const btnExportCsv = document.getElementById('btn-export-csv'); // Descarga un archivo .csv delimitado por comas compatible con Excel y Google Sheets.
  const btnPrintReport = document.getElementById('btn-print-report'); // Abre el diálogo del navegador para imprimir en papel o guardar como PDF formal.
  const linkSidepanelTerms = document.getElementById('link-sidepanel-terms'); // Enlace en el pie de página para consultar los Términos y Condiciones.
  const btnHeaderTerms = document.getElementById('btn-header-terms'); // Botón de acceso directo a Términos y Condiciones en el encabezado.

  // Referencias al modal de confirmación previa de auditoría:
  const confirmRunModal = document.getElementById('confirm-run-modal'); // Ventana modal para confirmar la ejecución antes de iniciar.
  const btnCloseConfirmModal = document.getElementById('btn-close-confirm-modal'); // Botón de cruz para cerrar el modal de confirmación.
  const btnCancelConfirmModal = document.getElementById('btn-cancel-confirm-modal'); // Botón "Cancelar" en el modal de confirmación.
  const btnProceedConfirmModal = document.getElementById('btn-proceed-confirm-modal'); // Botón "Confirmar e Iniciar" para arrancar la auditoría.
  const confirmDepthBadge = document.getElementById('confirm-depth-badge'); // Insignia que exhibe la profundidad seleccionada.
  const confirmTestsCount = document.getElementById('confirm-tests-count'); // Texto que muestra el total de pruebas a ejecutar.
  const confirmSaveMode = document.getElementById('confirm-save-mode'); // Texto que indica si el guardado transaccional está activo.
  const confirmFieldsCount = document.getElementById('confirm-fields-count'); // Contador de campos involucrados en la auditoría.
  const confirmFieldsList = document.getElementById('confirm-fields-list'); // Contenedor dinámico donde se listan los campos a auditar.
  let pendingTestQueue = []; // Cola temporal de tareas en espera de confirmación por el usuario.

  // Referencias al modal de confirmación de detención de pruebas:
  const confirmStopModal = document.getElementById('confirm-stop-modal'); // Ventana modal para evitar detenciones accidentales.
  const btnCloseConfirmStopModal = document.getElementById('btn-close-confirm-stop-modal'); // Botón de cruz para cerrar el modal de detención.
  const btnResumeFromStopModal = document.getElementById('btn-resume-from-stop-modal'); // Botón para reanudar la ejecución de pruebas.
  const btnProceedStopModal = document.getElementById('btn-proceed-stop-modal'); // Botón para confirmar la detención de pruebas.
  const confirmStopProgressText = document.getElementById('confirm-stop-progress-text'); // Texto que detalla el progreso al momento de la detención.
  let isTestRunPaused = false; // Bandera de pausa temporal mientras se muestra el diálogo de confirmación de detención.
  let currentRunStats = { completed: 0, total: 0 }; // Registro reactivo del progreso para informar al usuario.

  // Referencias a los campos del modal de creación de payload personalizado:
  const customModal = document.getElementById('custom-modal'); // Ventana modal flotante para registrar nuevos casos de prueba.
  const btnCloseModal = document.getElementById('btn-close-modal'); // Botón de cierre en la esquina superior del modal.
  const btnCancelCustom = document.getElementById('btn-cancel-custom'); // Botón "Cancelar" en el pie del modal.
  const btnSaveCustom = document.getElementById('btn-save-custom'); // Botón "Guardar Input" para validar e insertar el payload.
  const customName = document.getElementById('custom-name'); // Input de texto con el nombre descriptivo de la prueba propia.
  const customCategory = document.getElementById('custom-category'); // Selector desplegable para asociar el input a una categoría existente.
  const customValue = document.getElementById('custom-value'); // Textarea donde se introduce el valor o carga de inyección personalizada.
  const customDesc = document.getElementById('custom-desc'); // Input opcional con la explicación o motivo del caso de prueba.
  const customIsInvalid = document.getElementById('custom-is-invalid'); // Checkbox que define si el valor representa un caso inválido/ataque.

  // Referencias al modal visor de payloads largos:
  const payloadViewerModal = document.getElementById('payload-viewer-modal'); // Modal emergente para inspeccionar payloads que exceden el tamaño visible.
  const btnCloseViewer = document.getElementById('btn-close-viewer'); // Botón de cruz superior del visor.
  const btnDismissViewer = document.getElementById('btn-dismiss-viewer'); // Botón "Cerrar" del visor.
  const btnCopyViewer = document.getElementById('btn-copy-viewer'); // Botón para copiar el payload completo al portapapeles del sistema.
  const viewerTitle = document.getElementById('viewer-title'); // Encabezado h3 del visor con el nombre del test.
  const viewerContent = document.getElementById('viewer-content'); // Bloque preformateado (pre) donde se muestra el payload sin truncar.

  // =======================================================================================
  // PERSISTENCIA DE DATOS CON CHROME STORAGE API
  // =======================================================================================

  /**
   * Carga los casos de prueba personalizados definidos por el usuario desde el almacenamiento
   * local persistente de la extensión ('chrome.storage.local').
   * Esta función es asíncrona y previene la pérdida de configuraciones personalizadas al cerrar el navegador.
   * @async
   * @returns {Promise<void>}
   */
  async function loadCustomPayloads() {
    // Estructura 'try...catch' para capturar cualquier posible error de permisos o cuota de almacenamiento.
    try {
      // 'chrome.storage.local.get' recupera el objeto asociado a la clave 'qa_custom_payloads'.
      const stored = await chrome.storage.local.get('qa_custom_payloads');
      // 'Array.isArray' comprueba si los datos recuperados corresponden efectivamente a un arreglo válido.
      if (stored && Array.isArray(stored.qa_custom_payloads)) {
        customPayloads = stored.qa_custom_payloads;
      }
    } catch (e) {
      // 'console.warn' registra una advertencia en la consola de depuración sin interrumpir el flujo.
      console.warn('Error loading custom payloads:', e);
    }
  }

  /**
   * Persiste la lista actual de casos de prueba personalizados en el almacenamiento local de Chrome.
   * @async
   * @returns {Promise<void>}
   */
  async function saveCustomPayloads() {
    try {
      // 'chrome.storage.local.set' serializa y escribe el array en disco.
      await chrome.storage.local.set({ qa_custom_payloads: customPayloads });
    } catch (e) {
      console.warn('Error saving custom payloads:', e);
    }
  }

  // =======================================================================================
  // GESTIÓN DE PESTAÑAS Y COMUNICACIÓN CON CONTENT SCRIPTS
  // =======================================================================================

  /**
   * Obtiene el descriptor de la pestaña activa en la ventana actual del navegador.
   * Utiliza la API 'chrome.tabs.query'.
   * @async
   * @returns {Promise<chrome.tabs.Tab|null>} La pestaña activa o null en caso de error.
   */
  async function getActiveTab() {
    try {
      // La desestructuración '[tab]' extrae el primer elemento del arreglo devuelto por 'chrome.tabs.query'.
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (e) {
      console.warn('Error fetching active tab:', e);
      return null;
    }
  }

  /**
   * Garantiza que los archivos del content-script ('picker.css' y 'picker.js') estén inyectados
   * y ejecutándose en la pestaña web objetivo.
   * Primero intenta enviar un mensaje ping; si la pestaña no responde (porque fue abierta antes de
   * instalar la extensión o tras recargar), inyecta dinámicamente el CSS y JS usando 'chrome.scripting'.
   * @async
   * @param {number} tabId - El identificador numérico de la pestaña objetivo.
   * @returns {Promise<boolean>} True si el script está listo y funcional, False si falló la inyección.
   */
  async function ensureContentScriptInjected(tabId) {
    try {
      // Envía un mensaje simple con la acción 'PING' para comprobar si 'picker.js' ya está vivo.
      await chrome.tabs.sendMessage(tabId, { action: 'PING' });
      return true; // El script respondió exitosamente, no se requiere inyección adicional.
    } catch {
      // Si entra al bloque 'catch', significa que no hubo ningún content-script escuchando.
      try {
        // 'chrome.scripting.insertCSS' inyecta los estilos de la mira interactiva y tooltips en la página web.
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['content-scripts/picker.css']
        });
        // 'chrome.scripting.executeScript' evalúa y arranca el content-script 'picker.js' en el DOM del usuario.
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/picker.js']
        });
        return true;
      } catch (err) {
        // En sitios protegidos como 'chrome://', 'edge://' o la Chrome Web Store, la inyección es rechazada por diseño de seguridad.
        console.error('Failed to inject content script:', err);
        return false;
      }
    }
  }

  // =======================================================================================
  // GESTIÓN Y RENDERIZADO DE PAYLOADS (CASOS DE PRUEBA)
  // =======================================================================================

  /**
   * Combina las suites de prueba predeterminadas con los casos personalizados creados por el usuario.
   * Utiliza el operador spread (...) para generar un nuevo array unificado sin alterar los arreglos originales.
   * @returns {Array<Object>} Arreglo con la totalidad de los casos de prueba disponibles.
   */
  function getAllPayloads() {
    return [...defaultSuites, ...customPayloads];
  }

  /**
   * Renderiza dinámicamente las tarjetas de los casos de prueba dentro del contenedor '#payloads-container'
   * aplicando el filtro de categoría actual ('all' o una categoría específica).
   * Genera los checkboxes de selección, las etiquetas de nivel (tier) y asocia escuchas de eventos
   * para vista previa completa, modificación de selección y eliminación de entradas personalizadas.
   */
  function renderPayloads() {
    // Se obtiene el universo total de pruebas combinadas.
    const all = getAllPayloads();
    // El método 'Array.prototype.filter' filtra las pruebas que coinciden con la pestaña de categoría seleccionada.
    const matchesCategory = (p) => {
      if (currentCategory === 'all') return true;
      if (currentCategory === 'custom') return !!p.isCustom;
      return p.category === currentCategory;
    };
    const filtered = all.filter(matchesCategory);

    // Se vacía el contenido previo del contenedor para reconstruirlo limpiamente.
    payloadsContainer.innerHTML = '';

    // Si la categoría filtrada no contiene ninguna prueba (ej. casos personalizados vacíos), se muestra un aviso didáctico.
    if (filtered.length === 0) {
      payloadsContainer.innerHTML = `
        <div class="empty-notice" style="margin: 10px;">
          No hay entradas en esta categoría. Puedes añadir una personalizada con "+ Añadir Input".
        </div>
      `;
      if (checkSelectAll) {
        checkSelectAll.checked = false;
        checkSelectAll.indeterminate = false;
      }
      updateSelectedCount();
      return; // Se detiene la ejecución de la función.
    }

    // Se itera sobre cada caso de prueba filtrado para construir su representación visual en el DOM.
    filtered.forEach((p) => {
      // Se crea un nuevo elemento contenedor 'div'.
      const item = document.createElement('div');
      item.className = 'payload-item';
      // 'dataset.id' almacena el ID del payload en un atributo de datos HTML5 (data-id) para fácil identificación.
      item.dataset.id = p.id;

      // Si la propiedad 'selected' no está definida explícitamente en false, se asume seleccionada por defecto.
      const isChecked = p.selected !== false;

      // Se genera un extracto legible del payload; si excede 25 caracteres, se trunca y agrega elipsis ("...").
      let displayPreview = p.payload;
      if (displayPreview.length > 25) {
        displayPreview = displayPreview.slice(0, 22) + '...';
      }

      // Se inyecta la estructura HTML interna del elemento de prueba usando interpolación de plantillas (template literals).
      // Se utiliza la función de sanitización 'escapeHtml' para prevenir inyección accidental de HTML en la UI.
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

      // Se añade el nodo hijo al contenedor principal de la interfaz.
      payloadsContainer.appendChild(item);
    });

    // Se asigna un escucha de clic a todos los elementos con clase '.payload-preview' para abrir el modal visor.
    payloadsContainer.querySelectorAll('.payload-preview').forEach(el => {
      el.addEventListener('click', (e) => {
        // 'currentTarget.dataset.viewerId' obtiene el ID del caso desde el atributo 'data-viewer-id'.
        const id = e.currentTarget.dataset.viewerId;
        // 'Array.prototype.find' busca el objeto de prueba correspondiente en la colección completa.
        const targetPayload = all.find(p => p.id === id);
        if (targetPayload) {
          // Despliega el modal emergente con el nombre y valor íntegro del caso de prueba.
          showViewerModal(targetPayload.name, targetPayload.payload);
        }
      });
    });

    // Se asigna un escucha al evento 'change' en cada checkbox individual de payload.
    payloadsContainer.querySelectorAll('.payload-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const item = all.find(p => p.id === id);
        if (item) item.selected = e.target.checked;

        // Actualiza el checkbox maestro según el conjunto de tarjetas visibles:
        if (checkSelectAll) {
          const visibleCheckboxes = payloadsContainer.querySelectorAll('.payload-checkbox');
          const checkedCount = Array.from(visibleCheckboxes).filter(c => c.checked).length;
          checkSelectAll.checked = visibleCheckboxes.length > 0 && checkedCount === visibleCheckboxes.length;
          checkSelectAll.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
        }

        // Se recalculan y actualizan los badges de conteo y estado del botón de inicio.
        updateSelectedCount();
      });
    });

    // Se asigna un escucha al botón de eliminar para casos de prueba personalizados creados por el usuario.
    payloadsContainer.querySelectorAll('.btn-delete-custom').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        // Se excluye la prueba eliminada del array 'customPayloads' mediante 'filter'.
        customPayloads = customPayloads.filter(p => p.id !== id);
        // Se guarda el nuevo estado en 'chrome.storage.local'.
        await saveCustomPayloads();
        // Se refresca la lista visible de pruebas en pantalla.
        renderPayloads();
      });
    });

    // Sincroniza el estado visual del checkbox maestro (checked e indeterminate) para la categoría activa:
    if (checkSelectAll) {
      const visibleCheckboxes = payloadsContainer.querySelectorAll('.payload-checkbox');
      const checkedCount = Array.from(visibleCheckboxes).filter(c => c.checked).length;
      checkSelectAll.checked = visibleCheckboxes.length > 0 && checkedCount === visibleCheckboxes.length;
      checkSelectAll.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
    }

    // Sincroniza el contador total de pruebas seleccionadas en la interfaz.
    updateSelectedCount();
  }

  /**
   * Actualiza el badge numérico de pruebas seleccionadas y habilita/deshabilita el botón principal de ejecución.
   * Si no hay campos capturados, informa el estado del catálogo global.
   * Si hay campos capturados, calcula de manera reactiva la cantidad exacta de pruebas aplicables por tipo.
   */
  function updateSelectedCount() {
    const all = getAllPayloads();
    const activeInCatalog = all.filter(p => p.selected !== false).length;

    // Si no hay campos seleccionados, se muestra el estado general del catálogo y se desactiva el botón:
    if (selectedFields.length === 0) {
      selectedCountBadge.innerText = `${activeInCatalog} pruebas activas`;
      btnRunTests.disabled = true;
      btnRunTests.title = 'Añade o detecta al menos un campo para iniciar la verificación';
      runBtnText.innerText = 'Iniciar Verificación de Campos';
      return;
    }

    // Cálculo reactivo exacto de pruebas aplicables según los campos cargados en Sección 1:
    let totalQueuedTests = 0;
    selectedFields.forEach(field => {
      const fType = (field.type || 'text').toLowerCase();
      const isSlug = !!field.isSlugField || /\bslug\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);
      const isEmail = fType === 'email' || /\b(email|correo|mail)\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);
      const isUrl = !isSlug && !isEmail && (fType === 'url' || (!['number', 'date', 'datetime-local', 'month', 'tel', 'password'].includes(fType) && (!!field.isUrlField || /\b(url|link|enlace|sitio|website|web|endpoint|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`))));
      const isNumericText = fType === 'tel' || /\b(cp|postal|zip|telefono|tel|phone|identificacion|dni|cedula|nif|cif)\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);

      let applicable = [];
      if (isUrl) {
        applicable = all.filter(p => p.selected !== false && (p.category === 'url' || p.id === 'sec_null_byte' || p.id === 'sec_script' || p.id === 'txt_spaces' || p.id === 'txt_only_spaces'));
      } else if (fType === 'number') {
        applicable = all.filter(p => p.selected !== false && (p.category === 'number' || p.id === 'sec_null_byte'));
      } else if (fType === 'date' || fType === 'datetime-local' || fType === 'month') {
        applicable = all.filter(p => p.selected !== false && p.category === 'date');
      } else if (isEmail) {
        applicable = all.filter(p => p.selected !== false && (p.id === 'email_valid' || p.id === 'email_invalid_format' || p.id === 'sec_script' || p.id === 'sec_sql_basic' || p.id === 'sec_null_byte' || p.id === 'txt_spaces' || p.id === 'txt_only_spaces' || p.id === 'txt_1000' || p.id === 'txt_5000'));
      } else if (isNumericText) {
        applicable = all.filter(p => p.selected !== false && ((p.category === 'text' && p.id !== 'email_valid' && p.id !== 'email_invalid_format') || p.category === 'security' || p.id === 'num_leading_zeros' || p.id === 'num_overflow' || p.id === 'num_negative' || p.id === 'num_non_numeric'));
      } else {
        applicable = all.filter(p => p.selected !== false && ((p.category === 'text' && p.id !== 'email_valid' && p.id !== 'email_invalid_format') || p.category === 'emoji' || p.category === 'security'));
      }

      const customs = all.filter(p => {
        if (!p.isCustom || p.selected === false) return false;
        if (isUrl) return p.category === 'url' || p.category === 'security';
        if (fType === 'number') return p.category === 'number' || p.category === 'security';
        if (fType === 'date' || fType === 'datetime-local' || fType === 'month') return p.category === 'date';
        if (isEmail) return p.category === 'text' || p.category === 'security';
        return p.category === 'text' || p.category === 'emoji' || p.category === 'security' || (isNumericText && p.category === 'number');
      });

      customs.forEach(c => {
        if (!applicable.includes(c)) applicable.push(c);
      });

      totalQueuedTests += applicable.length;
    });

    if (totalQueuedTests === 0) {
      selectedCountBadge.innerText = '0 pruebas aplicables';
      btnRunTests.disabled = true;
      btnRunTests.title = 'No hay pruebas seleccionadas compatibles con los tipos de campo elegidos.';
      runBtnText.innerText = `Sin pruebas aplicables (${selectedFields.length} campo${selectedFields.length > 1 ? 's' : ''})`;
    } else {
      selectedCountBadge.innerText = `${totalQueuedTests} pruebas aplicables (${activeInCatalog} en catálogo)`;
      btnRunTests.disabled = false;
      btnRunTests.title = 'Ejecutar verificación de campos';
      runBtnText.innerText = `Iniciar Verificación (${totalQueuedTests} prueba${totalQueuedTests > 1 ? 's' : ''} / ${selectedFields.length} campo${selectedFields.length > 1 ? 's' : ''})`;
    }
  }

  // =======================================================================================
  // GESTIÓN DE NIVELES DE PROFUNDIDAD (SIMPLE, NORMAL, AVANZADO, TOTAL)
  // =======================================================================================

  /**
   * Aplica un nivel de profundidad determinado sobre las suites de prueba predeterminadas.
   * Marca como activas aquellas pruebas cuyo nivel jerárquico sea menor o igual al seleccionado.
   * Por ejemplo, el nivel 'normal' incluye pruebas 'simple' y 'normal', pero omite 'advanced' y 'total'.
   * @param {string} tier - Nombre del nivel: 'simple', 'normal', 'advanced' o 'total'.
   */
  function applyDepthTier(tier) {
    // Si se pasa un nivel no reconocido en el diccionario, se establece 'normal' como valor por defecto.
    if (!TIER_HIERARCHY[tier]) tier = 'normal';
    currentDepthTier = tier;
    // Se obtiene el valor numérico correspondiente al nivel (1, 2, 3 o 4).
    const targetLevel = TIER_HIERARCHY[tier];

    // Se recorre la lista de botones de nivel para actualizar la clase CSS 'active'.
    depthButtons.forEach(btn => {
      if (btn.dataset.depth === tier) {
        btn.classList.add('active'); // Se resalta visualmente el botón seleccionado.
      } else {
        btn.classList.remove('active'); // Se desmarcan los otros botones.
      }
    });

    // Se actualiza el badge descriptivo de profundidad preservando el indicador luminoso .status-dot.
    if (depthDescBadge) {
      const dotClasses = { simple: 'status-dot-success', normal: 'status-dot-info', advanced: 'status-dot-purple', total: 'status-dot-warning' };
      const dotClass = dotClasses[tier] || 'status-dot-info';
      depthDescBadge.innerHTML = `<span class="status-dot ${dotClass}" style="margin-right: 4px;"></span>${TIER_DESCRIPTIONS[tier] || tier}`;
    }

    // Se itera sobre las suites por defecto actualizando la propiedad 'selected' según la jerarquía.
    defaultSuites.forEach(p => {
      const pLevel = TIER_HIERARCHY[p.tier] || 2;
      // La prueba queda seleccionada si su nivel numérico es menor o igual al nivel objetivo.
      p.selected = pLevel <= targetLevel;
    });

    // Se garantiza que los payloads personalizados del usuario permanezcan activos a menos que se hayan desmarcado manualmente.
    customPayloads.forEach(c => {
      if (c.selected === undefined) c.selected = true;
    });

    // Se vuelve a renderizar el listado de casos con los nuevos estados de selección.
    renderPayloads();
  }

  // Escucha de eventos de clic en los botones de profundidad:
  depthButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Se lee el atributo 'data-depth' del botón pulsado y se aplica el nivel correspondiente.
      applyDepthTier(btn.dataset.depth);
    });
  });

  // =======================================================================================
  // INTERCAMBIO DE PESTAÑAS DE CATEGORÍA Y CHECKBOX MAESTRO
  // =======================================================================================

  // Escucha de eventos de clic en las pestañas de categorías:
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Se remueve la clase activa de todas las pestañas.
      categoryTabs.forEach(t => t.classList.remove('active'));
      // Se añade la clase activa a la pestaña sobre la que se hizo clic.
      tab.classList.add('active');
      // Se actualiza la categoría activa en el estado global.
      currentCategory = tab.dataset.category;
      // Se renderiza nuevamente el listado mostrando únicamente las pruebas de la categoría elegida.
      renderPayloads();
    });
  });

  // Escucha de eventos de cambio en el checkbox maestro "Seleccionar todo":
  checkSelectAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const all = getAllPayloads();
    // Se actualiza la selección de todas las pruebas que pertenezcan a la categoría que está actualmente en pantalla.
    all.forEach(p => {
      const inCategory = (currentCategory === 'all') || (currentCategory === 'custom' ? !!p.isCustom : p.category === currentCategory);
      if (inCategory) {
        p.selected = isChecked;
      }
    });
    // Se refleja el cambio en la interfaz gráfica.
    renderPayloads();
  });

  // =======================================================================================
  // GESTIÓN Y RENDERIZADO DE MÚLTIPLES CAMPOS (MULTI-FIELD MANAGEMENT)
  // =======================================================================================

  /**
   * Renderiza la lista visual de campos capturados en la interfaz del side panel.
   * Si no hay campos, muestra el estado vacío ('#field-empty-state') y oculta secciones dependientes.
   * Si hay campos, genera los chips interactivos con tipo, nombre, botón de mira telescópica y botón de eliminación.
   */
  function renderSelectedFields() {
    // Si la lista de campos está vacía, se ocultan los paneles secundarios y se restablecen los badges.
    if (selectedFields.length === 0) {
      fieldEmptyState.style.display = 'block'; // Muestra el mensaje "No hay campos seleccionados".
      selectedFieldsList.style.display = 'none'; // Oculta la lista de chips.
      saveButtonBox.style.display = 'none'; // Oculta la configuración del botón de guardar.
      if (formNameBox) formNameBox.style.display = 'none'; // Oculta la caja del título del formulario.
      fieldsCountBadge.className = 'badge badge-idle'; // Aplica estilo visual inactivo.
      fieldsCountBadge.innerText = '0 campos';
      updateSelectedCount(); // Actualiza el estado del botón de inicio de pruebas.
      updateFilterFieldSelect(); // Limpia las opciones del dropdown de filtros.
      return; // Fin anticipado de la función.
    }

    // Si existen campos seleccionados, se activan los contenedores visuales correspondientes.
    fieldEmptyState.style.display = 'none';
    selectedFieldsList.style.display = 'flex';
    saveButtonBox.style.display = 'flex';
    if (formNameBox) {
      formNameBox.style.display = 'flex';
      // Si el input de título de formulario no tiene texto, se le asigna el título activo o uno por defecto.
      if (inputFormTitle) {
        if (!inputFormTitle.value && activeFormTitle) {
          inputFormTitle.value = activeFormTitle;
        } else if (!inputFormTitle.value) {
          inputFormTitle.value = 'Formulario Principal';
          activeFormTitle = 'Formulario Principal';
        }
      }
    }
    // Actualiza el badge con estilo activo y el número total de campos capturados.
    fieldsCountBadge.className = 'badge badge-active';
    fieldsCountBadge.innerText = `${selectedFields.length} campo${selectedFields.length > 1 ? 's' : ''}`;

    // Se limpia el listado previo de chips para volver a generarlo desde el estado actual.
    selectedFieldsList.innerHTML = '';
    selectedFields.forEach((field, index) => {
      // Se crea el elemento contenedor del chip.
      const chip = document.createElement('div');
      chip.className = 'field-chip-item';
      // Se inyecta la estructura del chip: tipo de input, etiqueta del campo y botones de inspección/eliminación.
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

    // Escucha para resaltar el campo en la página web mediante el botón de mira telescópica:
    selectedFieldsList.querySelectorAll('.btn-inspect-field').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        // Se obtiene el índice numérico del campo desde el atributo 'data-index'.
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const f = selectedFields[idx];
        if (f && activeTabId) {
          // Se envía el mensaje 'HIGHLIGHT_TARGET' al content-script para activar la animación de destello visual en la web.
          chrome.tabs.sendMessage(activeTabId, { action: 'HIGHLIGHT_TARGET', fieldInfo: f });
        }
      });
    });

    // Escucha para remover un campo individual de la selección:
    selectedFieldsList.querySelectorAll('.field-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        // El método 'Array.prototype.splice' elimina 1 elemento en la posición 'idx'.
        selectedFields.splice(idx, 1);
        // Se redibuja la lista actualizada.
        renderSelectedFields();
      });
    });

    // Se sincronizan las demás secciones que dependen de la lista de campos seleccionados.
    updateSelectedCount();
    updateFilterFieldSelect();
    renderSiblingFillers();
    renderSaveButton();
  }

  // =======================================================================================
  // CAMPOS HERMANOS DE RELLENO (SIBLING FILLERS PARA CAMPOS REQUERIDOS)
  // =======================================================================================

  /**
   * Renderiza la lista de campos hermanos en el contenedor '#sibling-fillers-box'.
   * En formularios con múltiples campos requeridos (ej. Nombre, Email, Password), si probamos 'Email'
   * pero 'Nombre' está vacío, el formulario no permitirá el guardado no por culpa del email, sino
   * por la ausencia del nombre. Los Sibling Fillers inyectan datos válidos en los campos secundarios
   * para aislar y evaluar exclusivamente el comportamiento del campo bajo auditoría activa.
   */
  function renderSiblingFillers() {
    if (!siblingFillersBox) return;

    // Si hay un solo campo o ninguno, no existen hermanos que requieran pre-llenado.
    if (selectedFields.length <= 1) {
      siblingFillersBox.style.display = 'none';
      return;
    }

    siblingFillersBox.style.display = 'flex';
    siblingFillersList.innerHTML = '';

    // Se genera una fila por cada campo hermano seleccionado en el formulario.
    selectedFields.forEach((field, index) => {
      const item = document.createElement('div');
      item.className = 'sibling-filler-item';

      // Determina si el campo está marcado como obligatorio (por defecto true a menos que sea explícitamente false).
      const isReq = field.required !== false;
      // Obtiene el valor de relleno asignado o uno sugerido inteligente.
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

    // Escucha para conmutar entre Obligatorio u Opcional en el campo hermano:
    siblingFillersList.querySelectorAll('.sibling-req-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (selectedFields[idx]) {
          selectedFields[idx].required = e.target.checked;
          renderSiblingFillers();
        }
      });
    });

    // Escucha para capturar la edición manual del valor de relleno ingresado por el usuario:
    siblingFillersList.querySelectorAll('.sibling-filler-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (selectedFields[idx]) {
          selectedFields[idx].fillerValue = e.target.value;
        }
      });
    });

    // Escucha para generar un valor dummy aleatorio acorde a las heurísticas del tipo de campo:
    siblingFillersList.querySelectorAll('.btn-random-filler').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const f = selectedFields[idx];
        if (f && activeTabId) {
          try {
            // Intenta solicitar un valor inteligente al content-script mediante 'GENERATE_NEW_DUMMY'.
            const res = await chrome.tabs.sendMessage(activeTabId, { action: 'GENERATE_NEW_DUMMY', fieldInfo: f });
            if (res && res.value) {
              f.fillerValue = res.value;
              renderSiblingFillers();
            }
          } catch {
            // Fallback heurístico local si falla la comunicación IPC:
            const isSlug = !!f.isSlugField || /\bslug\b/i.test(`${f.name || ''} ${f.id || ''} ${f.label || ''} ${f.placeholder || ''}`);
            const isEmail = f.type === 'email' || /\b(email|correo|mail)\b/i.test(`${f.name || ''} ${f.id || ''} ${f.label || ''} ${f.placeholder || ''}`);
            const isUrl = !isSlug && !isEmail && (f.type === 'url' || (!['number', 'date', 'datetime-local', 'month', 'tel', 'password'].includes(f.type) && (!!f.isUrlField || /\b(url|link|enlace|sitio|website|web|endpoint|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(`${f.name || ''} ${f.id || ''} ${f.label || ''} ${f.placeholder || ''}`))));
            if (isEmail) {
              f.fillerValue = `usuario.qa${Math.floor(100 + Math.random() * 900)}@test.com`;
            } else if (isSlug) {
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

  // =======================================================================================
  // SECUENCIA DE REAPERTURA DE FORMULARIOS COLAPSABLES O MODALES (REOPEN STEPS)
  // =======================================================================================

  /**
   * Renderiza la secuencia ordenada de pasos grabados para reabrir el formulario en pantalla.
   * Muy útil para modales o cajones laterales (drawers) que se cierran tras cada intento de guardado.
   */
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

    // Escucha para resaltar el elemento del paso en la página:
    reopenStepsList.querySelectorAll('.btn-inspect-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        const s = reopenSteps[idx];
        if (s && activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { action: 'HIGHLIGHT_TARGET', fieldInfo: s });
        }
      });
    });

    // Escucha para eliminar un paso individual de la secuencia:
    reopenStepsList.querySelectorAll('.btn-remove-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        reopenSteps.splice(idx, 1);
        renderReopenSteps();
      });
    });
  }

  // Escucha del checkbox principal para habilitar/deshabilitar el bloque de reapertura:
  if (checkEnableReopen) {
    checkEnableReopen.addEventListener('change', (e) => {
      if (reopenStepsContent) {
        // Muestra u oculta la caja colapsable de pasos.
        reopenStepsContent.style.display = e.target.checked ? 'block' : 'none';
      }
      renderReopenSteps();
    });
  }

  // Botón para iniciar el modo de captura interactiva de un nuevo paso de clic:
  if (btnAddReopenStep) {
    btnAddReopenStep.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) {
        alert('Por favor abre una página web válida en el navegador.');
        return;
      }
      activeTabId = tab.id;
      await ensureContentScriptInjected(tab.id);

      // Si ya estaba activo el modo de captura, se cancela; de lo contrario, se inicia.
      if (isPickingReopenStepActive) {
        chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
        setReopenStepPickingState(false);
      } else {
        chrome.tabs.sendMessage(tab.id, { action: 'START_PICKING_REOPEN_STEP' });
        setReopenStepPickingState(true);
      }
    });
  }

  /**
   * Actualiza el aspecto visual del botón de captura de pasos de reapertura según el estado activo.
   * @param {boolean} active - True si el cursor inspector de pasos está activo.
   */
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

  // Botón para probar en vivo la secuencia de reapertura grabada:
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
        // Envía la secuencia completa de pasos al content-script para que simule los clics reales en la web.
        await chrome.tabs.sendMessage(tab.id, {
          action: 'EXECUTE_REOPEN_STEPS',
          steps: reopenSteps,
          waitMs: 450 // Pausa de 450ms entre cada clic para dar tiempo a animaciones CSS/JS.
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

  // =======================================================================================
  // INSERCIÓN Y PREVENCIÓN DE DUPLICADOS DE CAMPOS
  // =======================================================================================

  /**
   * Añade un descriptor de campo de entrada a la lista de 'selectedFields' evitando duplicaciones.
   * Si el campo ya existe, produce una retroalimentación visual animando el chip preexistente.
   * @param {Object} fieldData - Objeto descriptor del campo capturado por el content-script.
   */
  function addField(fieldData) {
    // Se evalúa si el campo ya fue capturado comparando ID, selector CSS o combinación de nombre y tipo.
    const exists = selectedFields.some(f => 
      (f.id && f.id === fieldData.id) || 
      (f.selector && f.selector === fieldData.selector) ||
      (f.name && f.name === fieldData.name && f.type === fieldData.type)
    );

    if (!exists) {
      // Se inicializa el valor de relleno para campos hermanos.
      if (fieldData.fillerValue === undefined) {
        fieldData.fillerValue = fieldData.suggestedFillerValue || 'Dato Válido QA';
      }
      // Se vincula el botón de guardar si el campo trae uno auto-detectado y no había ninguno configurado.
      if (!currentSaveButton && (fieldData.saveButton || fieldData.autoSaveButton)) {
        currentSaveButton = fieldData.saveButton || fieldData.autoSaveButton;
      }
      fieldData.saveButton = currentSaveButton;
      // Se agrega el nuevo campo al array principal.
      selectedFields.push(fieldData);
      // Si el título del formulario aún no está definido, se adopta el del campo o un valor por defecto.
      if (!activeFormTitle) {
        activeFormTitle = fieldData.formTitle || 'Formulario Principal';
        if (inputFormTitle) inputFormTitle.value = activeFormTitle;
      }
    } else {
      // Retroalimentación visual: si el campo ya estaba presente, resalta brevemente su chip con un destello.
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

    // Se actualiza la vista de campos en la interfaz.
    renderSelectedFields();
  }

  // =======================================================================================
  // DROPDOWN DE FILTRO POR CAMPO EN LA TABLA DE RESULTADOS
  // =======================================================================================

  /**
   * Regenera las opciones del elemento select '#filter-field-select'
   * permitiendo filtrar la tabla de resultados para analizar un campo específico o todos.
   */
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

  // =======================================================================================
  // BOTONES Y CONTROLADORES DE CAPTURA INTERACTIVA (PICKERS)
  // =======================================================================================

  // Botón para apuntar un campo individual en la página web:
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

    // Alterna entre activar o cancelar el modo inspector de campos.
    if (isPickingFieldActive) {
      chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
      setFieldPickingState(false);
    } else {
      chrome.tabs.sendMessage(tab.id, { action: 'START_PICKING' });
      setFieldPickingState(true);
    }
  });

  /**
   * Modifica los estilos y texto del botón de selección individual de campos según el estado activo.
   * @param {boolean} active - True si el cursor selector está activo.
   */
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

  // Botón para apuntar un contenedor de formulario haciendo clic:
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

  /**
   * Modifica los estilos y texto del botón de selección de formulario completo según el estado.
   * @param {boolean} active - True si el modo de selección de formulario está activo.
   */
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

  // Botón de detección automática de formularios en toda la página web:
  btnAutoDetectForm.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    activeTabId = tab.id;
    await ensureContentScriptInjected(tab.id);

    try {
      const originalText = btnAutoDetectForm.innerHTML;
      btnAutoDetectForm.innerText = 'Detectando...';
      // Envía la acción 'DETECT_SINGLE_FORM' al content-script para escanear etiquetas <form> o bloques densos de inputs.
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_SINGLE_FORM' });
      btnAutoDetectForm.innerHTML = originalText;

      if (res && res.fields && res.fields.length > 0) {
        activeFormTitle = res.title || 'Formulario Principal';
        if (inputFormTitle) inputFormTitle.value = activeFormTitle;
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

  // =======================================================================================
  // GESTIÓN DEL BOTÓN DE GUARDAR / ENVIAR (SAVE BUTTON LOGIC)
  // =======================================================================================

  /**
   * Cambia el estado visual del selector del botón de guardar.
   * @param {boolean} active - True si el cursor inspector de botón está activo.
   */
  function setButtonPickingState(active) {
    isPickingButtonActive = active;
    renderSaveButton();
  }

  /**
   * Asigna el descriptor del botón capturado al estado y lo propaga a todos los campos seleccionados.
   * @param {Object} btnData - Descriptor del botón seleccionado en la web.
   */
  function handleSaveButtonSelected(btnData) {
    currentSaveButton = btnData;
    selectedFields.forEach(f => {
      f.saveButton = btnData;
    });
    renderSaveButton();
  }

  /**
   * Renderiza el estado actual del botón de guardar en la interfaz (píldora asignada o auto-detectada).
   */
  function renderSaveButton() {
    if (!saveButtonBox) return;

    if (currentSaveButton) {
      const btnLabel = currentSaveButton.text || currentSaveButton.value || currentSaveButton.id || 'Botón de Guardar';
      saveBtnPill.className = 'pill pill-assigned';
      saveBtnPill.innerHTML = `<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${escapeHtml(btnLabel.slice(0, 32))}`;
      saveBtnPill.title = `Botón: ${btnLabel}\nSelector: ${currentSaveButton.selector || 'N/A'}`;
      if (btnInspectSave) {
        btnInspectSave.style.display = 'inline-flex';
        btnInspectSave.disabled = false;
      }
    } else {
      saveBtnPill.className = 'pill pill-idle';
      saveBtnPill.innerText = 'Auto / No asignado';
      saveBtnPill.title = 'Se detectará automáticamente al enviar o se enviará por evento submit';
      if (btnInspectSave) {
        btnInspectSave.style.display = 'none';
        btnInspectSave.disabled = true;
      }
    }

    if (btnChangeSave) {
      if (isPickingButtonActive) {
        btnChangeSave.classList.remove('btn-outline');
        btnChangeSave.classList.add('btn-primary');
        changeSaveBtnText.innerText = 'Cancelar selección (ESC)';
      } else {
        btnChangeSave.classList.remove('btn-primary');
        btnChangeSave.classList.add('btn-outline');
        changeSaveBtnText.innerText = currentSaveButton ? 'Cambiar botón' : 'Asignar botón';
      }
    }
  }

  // Botón para cambiar o reasignar interactivamente el botón de guardar:
  if (btnChangeSave) {
    btnChangeSave.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      activeTabId = tab.id;
      await ensureContentScriptInjected(tab.id);

      if (isPickingButtonActive) {
        chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_PICKING' });
        setButtonPickingState(false);
      } else {
        chrome.tabs.sendMessage(tab.id, {
          action: 'START_PICKING_BUTTON',
          formTitle: (inputFormTitle?.value?.trim() || activeFormTitle || 'Formulario Principal')
        });
        setButtonPickingState(true);
      }
    });
  }

  // Botón para inspeccionar/resaltar el botón de guardar configurado en la página:
  if (btnInspectSave) {
    btnInspectSave.addEventListener('click', async () => {
      if (!currentSaveButton?.selector) return;
      const tab = await getActiveTab();
      if (!tab?.id) return;
      await ensureContentScriptInjected(tab.id);
      chrome.tabs.sendMessage(tab.id, {
        action: 'INSPECT_ELEMENT',
        selector: currentSaveButton.selector
      });
    });
  }

  // =======================================================================================
  // ENRUTADOR DE MENSAJES IPC (INTER-PROCESS COMMUNICATION) DESDE EL CONTENT-SCRIPT
  // =======================================================================================

  // Se suscribe un escucha global a 'chrome.runtime.onMessage' para recibir eventos emitidos por 'picker.js'.
  chrome.runtime.onMessage.addListener((message) => {
    // 1. Campo individual capturado por el usuario:
    if (message.action === 'ELEMENT_SELECTED') {
      setFieldPickingState(false);
      addField(message.data);
    } 
    // 2. Formulario completo seleccionado mediante clic:
    else if (message.action === 'FORM_SELECTED') {
      setFormPickingState(false);
      const formData = message.data;
      if (formData && formData.fields && formData.fields.length > 0) {
        activeFormTitle = formData.title || 'Formulario Principal';
        if (inputFormTitle) inputFormTitle.value = activeFormTitle;
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
    } 
    // 3. Botón de guardar seleccionado por el usuario:
    else if (message.action === 'SAVE_BUTTON_SELECTED') {
      setButtonPickingState(false);
      handleSaveButtonSelected(message.data);
    } 
    // 4. Paso de la secuencia de reapertura capturado:
    else if (message.action === 'REOPEN_STEP_PICKED') {
      setReopenStepPickingState(false);
      if (message.data) {
        reopenSteps.push(message.data);
        renderReopenSteps();
      }
    } 
    // 5. Usuario canceló cualquier modo de selección presionando ESC o haciendo clic en el banner:
    else if (message.action === 'PICKING_CANCELLED') {
      setFieldPickingState(false);
      setFormPickingState(false);
      setReopenStepPickingState(false);
      setButtonPickingState(false);
    }
  });

  // =======================================================================================
  // REINICIO GLOBAL DEL ESTADO DE LA EXTENSIÓN (RESET EVERYTHING)
  // =======================================================================================

  // Escucha del botón "Reiniciar Todo" con diálogo de confirmación de seguridad:
  btnResetAll.addEventListener('click', () => {
    // El diálogo nativo 'confirm' solicita aprobación al usuario antes de borrar datos.
    if (confirm('¿Deseas reiniciar la lista de campos y los resultados?')) {
      selectedFields = [];
      activeFormTitle = '';
      if (inputFormTitle) inputFormTitle.value = '';
      if (formNameBox) formNameBox.style.display = 'none';
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


  // =======================================================================================
  // MOTOR DE EJECUCIÓN: PRUEBAS AUTOMATIZADAS SECUENCIALES POR TIPO DE CAMPO
  // =======================================================================================

  // Escucha del botón principal "Iniciar Verificación":
  btnRunTests.addEventListener('click', async () => {
    // Validación previa: se requiere al menos un campo capturado y una pestaña web activa conectada.
    if (selectedFields.length === 0 || !activeTabId) {
      alert('Por favor selecciona al menos un campo antes de iniciar.');
      return;
    }

    // Se obtienen todas las pruebas y se filtran únicamente las que tienen 'selected !== false'.
    const all = getAllPayloads();
    const selectedPayloads = all.filter(p => p.selected !== false);
    if (selectedPayloads.length === 0) {
      alert('No hay entradas seleccionadas para probar.');
      return;
    }

    // -------------------------------------------------------------------------------------
    // FASE 1: CONSTRUCCIÓN INTELIGENTE DE LA COLA DE PRUEBAS SEGÚN TIPO DE CAMPO
    // -------------------------------------------------------------------------------------
    // Cada tipo de dato HTML5 (texto, número, fecha, url) tiene reglas semánticas distintas.
    // Inyectar fechas en un campo numérico carece de sentido; este discriminador asigna a cada campo
    // únicamente los vectores de prueba pertinentes, optimizando tiempo y relevancia de auditoría.
    const testQueue = [];
    selectedFields.forEach(field => {
      // Se normaliza el tipo de dato a minúsculas ('text', 'number', 'date', 'url', etc.).
      const fType = (field.type || 'text').toLowerCase();
      let applicable = [];

      // Heurística avanzada para determinar si el campo representa una URL, slug, número semántico o email:
      const isSlug = !!field.isSlugField || /\bslug\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);
      const isEmail = fType === 'email' || /\b(email|correo|mail)\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);
      const isUrl = !isSlug && !isEmail && (fType === 'url' || (!['number', 'date', 'datetime-local', 'month', 'tel', 'password'].includes(fType) && (!!field.isUrlField || /\b(url|link|enlace|sitio|website|web|endpoint|dominio|domain|repositorio|repo|webhook|uri)\b|avatar_url|profile_url/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`))));
      const isNumericText = fType === 'tel' || /\b(cp|postal|zip|telefono|tel|phone|identificacion|dni|cedula|nif|cif)\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);

      if (isUrl) {
        // En campos de URL se aplican pruebas de protocolo, XSS en esquemas, byte nulo y espacios en blanco.
        applicable = selectedPayloads.filter(p => p.category === 'url' || p.id === 'sec_null_byte' || p.id === 'sec_script' || p.id === 'txt_spaces' || p.id === 'txt_only_spaces');
      } else if (fType === 'number') {
        // En campos numéricos se aplican casos de números (positivos, negativos, desbordamientos, letras).
        applicable = selectedPayloads.filter(p => p.category === 'number' || p.id === 'sec_null_byte');
      } else if (fType === 'date' || fType === 'datetime-local' || fType === 'month') {
        // En selectores de fecha se aplican formatos ISO, años bisiestos y rangos calendario.
        applicable = selectedPayloads.filter(p => p.category === 'date');
      } else if (isEmail) {
        // En campos de correo electrónico se aplican pruebas de formato de correo, seguridad y longitud:
        applicable = selectedPayloads.filter(p => p.id === 'email_valid' || p.id === 'email_invalid_format' || p.id === 'sec_script' || p.id === 'sec_sql_basic' || p.id === 'sec_null_byte' || p.id === 'txt_spaces' || p.id === 'txt_only_spaces' || p.id === 'txt_1000' || p.id === 'txt_5000');
      } else if (isNumericText) {
        // En campos semánticos numéricos basados en texto (códigos postales, teléfonos, documentos):
        applicable = selectedPayloads.filter(p => (p.category === 'text' && p.id !== 'email_valid' && p.id !== 'email_invalid_format') || p.category === 'security' || p.id === 'num_leading_zeros' || p.id === 'num_overflow' || p.id === 'num_negative' || p.id === 'num_non_numeric');
      } else {
        // En campos de texto libre, áreas de texto (textarea) y contraseñas:
        applicable = selectedPayloads.filter(p => (p.category === 'text' && p.id !== 'email_valid' && p.id !== 'email_invalid_format') || p.category === 'emoji' || p.category === 'security');
      }

      // Si el usuario creó pruebas personalizadas (isCustom: true), se incorporan según compatibilidad funcional:
      const customs = selectedPayloads.filter(p => {
        if (!p.isCustom) return false;
        if (isUrl) return p.category === 'url' || p.category === 'security';
        if (fType === 'number') return p.category === 'number' || p.category === 'security';
        if (fType === 'date' || fType === 'datetime-local' || fType === 'month') return p.category === 'date';
        if (isEmail) return p.category === 'text' || p.category === 'security';
        return p.category === 'text' || p.category === 'emoji' || p.category === 'security' || (isNumericText && p.category === 'number');
      });
      customs.forEach(c => {
        if (!applicable.includes(c)) applicable.push(c);
      });

      // Se genera un elemento en la cola de tareas asociando el campo con cada caso aplicable.
      applicable.forEach(testItem => {
        testQueue.push({ field, testItem });
      });
    });

    // Si tras el filtrado por tipo no hay ninguna prueba para ejecutar, se actualiza el estado y cancela:
    if (testQueue.length === 0) {
      updateSelectedCount();
      return;
    }

    // Advertencia amigable si se activó la reapertura automática pero no se registraron clics:
    if (checkEnableReopen && checkEnableReopen.checked && reopenSteps.length === 0) {
      const proceed = confirm('Has activado "Auto re-abrir formulario" pero aún no has grabado ningún paso de clic.\n\n¿Deseas ejecutar las pruebas sin re-apertura automática? (Presiona Cancelar para apuntar los pasos antes de iniciar)');
      if (!proceed) return;
    }

    // Despliegue del diálogo modal de confirmación previa antes de iniciar la ejecución directa:
    openConfirmRunModal(testQueue);
  });

  /**
   * Despliega el modal interactivo de confirmación previa a la auditoría.
   * Muestra al usuario los campos que serán evaluados, la profundidad seleccionada
   * y el número total de casos de prueba aplicables.
   * @param {Array<Object>} queue - Cola calculada de tareas { field, testItem }.
   */
  function openConfirmRunModal(queue) {
    pendingTestQueue = queue;

    // Se obtiene el descriptor del nivel de profundidad activo:
    const tier = currentDepthTier || 'normal';
    const tierNames = { simple: 'Simple', normal: 'Normal', advanced: 'Avanzado', total: 'Total' };
    const tierName = tierNames[tier] || tier;
    const dotClasses = { simple: 'status-dot-success', normal: 'status-dot-info', advanced: 'status-dot-purple', total: 'status-dot-warning' };
    const dotClass = dotClasses[tier] || 'status-dot-info';
    if (confirmDepthBadge) {
      confirmDepthBadge.innerHTML = `<span class="status-dot ${dotClass}" style="margin-right: 4px;"></span>${escapeHtml(tierName)}`;
    }

    if (confirmTestsCount) {
      confirmTestsCount.innerText = `${queue.length} prueba${queue.length === 1 ? '' : 's'}`;
    }

    if (confirmSaveMode) {
      const isSaveActive = checkTriggerSave && checkTriggerSave.checked;
      confirmSaveMode.innerText = isSaveActive ? 'Activo (audita envíos con clic en Guardar)' : 'Inactivo (solo prueba local en campo)';
      confirmSaveMode.style.color = isSaveActive ? '#38bdf8' : 'var(--text-muted)';
    }

    if (confirmFieldsCount) {
      confirmFieldsCount.innerText = String(selectedFields.length);
    }

    if (confirmFieldsList) {
      confirmFieldsList.innerHTML = '';
      selectedFields.forEach(field => {
        const countForField = queue.filter(t => t.field === field).length;
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(51, 65, 85, 0.4);';
        
        const formTag = field.formTitle ? `<span style="color: #64748b; font-size: 9px; margin-right: 3px;">[${escapeHtml(field.formTitle)}]</span>` : '';
        const fieldName = escapeHtml(field.label || field.name || field.id || field.selector || 'Campo');
        const fieldType = escapeHtml(field.type || 'text');
        
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
            ${formTag}
            <span style="color: #94a3b8; font-family: monospace; font-size: 10px;">&lt;${escapeHtml(field.tag || 'input')}&gt;</span>
            <span style="font-weight: 600; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fieldName}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <span class="badge" style="font-size: 9px; padding: 1px 5px; background: #334155; color: #38bdf8;">${fieldType}</span>
            <span style="color: #94a3b8; font-size: 10px;">${countForField} prueba${countForField === 1 ? '' : 's'}</span>
          </div>
        `;
        confirmFieldsList.appendChild(item);
      });
    }

    if (confirmRunModal) {
      confirmRunModal.style.display = 'flex';
      if (btnProceedConfirmModal && typeof btnProceedConfirmModal.focus === 'function') {
        btnProceedConfirmModal.focus();
      }
    }
  }

  /**
   * Cierra el modal de confirmación y restablece la cola pendiente de pruebas.
   */
  function closeConfirmRunModal() {
    if (confirmRunModal) {
      confirmRunModal.style.display = 'none';
    }
    pendingTestQueue = [];
    if (btnRunTests && typeof btnRunTests.focus === 'function') {
      btnRunTests.focus();
    }
  }

  /**
   * Despliega el modal de confirmación de detención de auditoría y pausa el bucle de pruebas.
   */
  function openConfirmStopModal() {
    isTestRunPaused = true;
    if (confirmStopProgressText) {
      const completed = currentRunStats.completed;
      const total = currentRunStats.total;
      confirmStopProgressText.innerText = `Se han completado ${completed} de ${total} prueba${total === 1 ? '' : 's'}.`;
    }
    if (confirmStopModal) {
      confirmStopModal.style.display = 'flex';
      if (btnResumeFromStopModal && typeof btnResumeFromStopModal.focus === 'function') {
        btnResumeFromStopModal.focus();
      }
    }
  }

  /**
   * Cierra la ventana modal de confirmación de detención.
   */
  function closeConfirmStopModal() {
    if (confirmStopModal) {
      confirmStopModal.style.display = 'none';
    }
    if (btnStopTests && typeof btnStopTests.focus === 'function' && !isTestRunCancelled) {
      btnStopTests.focus();
    }
  }

  /**
   * Reanuda la ejecución secuencial de pruebas tras descartar la detención.
   */
  function resumeExecutionFromStop() {
    isTestRunPaused = false;
    closeConfirmStopModal();
    if (progressLabel && !isTestRunCancelled) {
      progressLabel.innerText = 'Reanudando ejecución de pruebas...';
    }
  }

  /**
   * Confirma la detención definitiva solicitada por el operador.
   */
  function proceedStopExecution() {
    isTestRunCancelled = true;
    isTestRunPaused = false;
    closeConfirmStopModal();
    if (btnStopTests) {
      btnStopTests.disabled = true;
      btnStopTests.innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" style="fill: currentColor; stroke: none; margin-right: 4px;"><rect x="6" y="6" width="12" height="12"></rect></svg><span>Deteniendo...</span>';
    }
    if (progressLabel) {
      progressLabel.innerText = 'Detención solicitada. Interrumpiendo ejecución...';
    }
  }

  /**
   * Ejecuta secuencialmente la cola de pruebas confirmada sobre los campos seleccionados.
   * @async
   * @param {Array<Object>} testQueue - Cola de tareas { field, testItem } a inyectar.
   */
  async function executeTestQueue(testQueue) {
    // -------------------------------------------------------------------------------------
    // FASE 2: PREPARACIÓN DE LA INTERFAZ Y LECTURA DE PARÁMETROS
    // -------------------------------------------------------------------------------------
    // Se deshabilitan los controles de interacción para evitar condiciones de carrera durante la prueba.
    isTestRunCancelled = false;
    isTestRunPaused = false;
    currentRunStats = { completed: 0, total: testQueue.length };
    btnRunTests.disabled = true;
    if (btnResetAll) btnResetAll.disabled = true;
    if (btnStopTests) {
      btnStopTests.style.display = 'inline-flex';
      btnStopTests.disabled = false;
      btnStopTests.innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" style="fill: currentColor; stroke: none; margin-right: 4px;"><rect x="6" y="6" width="12" height="12"></rect></svg><span>Detener</span>';
    }
    btnPickField.disabled = true;
    btnAutoDetectForm.disabled = true;
    if (btnChangeSave) btnChangeSave.disabled = true;
    if (btnInspectSave) btnInspectSave.disabled = true;
    runBtnText.innerText = 'Ejecutando pruebas...';
    progressContainer.style.display = 'flex'; // Muestra la barra de progreso animada.
    resultsCard.style.display = 'block'; // Muestra la tarjeta de resultados.
    resultsTbody.innerHTML = ''; // Limpia resultados de auditorías previas.
    testResults = []; // Reinicia el array en memoria de resultados.

    // Se extraen los valores configurados por el usuario en la interfaz:
    const delayMs = parseInt(executionSpeedSelect.value, 10) || 150; // Retardo entre pruebas consecutivas en milisegundos.
    const submitWaitMs = parseInt(submitWaitTimeSelect.value, 10) || 500; // Tiempo de espera para observar respuestas del servidor.
    const triggerSave = checkTriggerSave.checked; // Booleano: auditar clic en botón de guardar.
    const shouldRestore = checkRestoreValue.checked; // Booleano: reponer valor inicial al terminar.
    const shouldFillSiblings = checkEnableSiblingFillers && checkEnableSiblingFillers.checked; // Booleano: auto-llenar campos hermanos.

    let completed = 0; // Contador de pruebas ejecutadas con éxito.

    // -------------------------------------------------------------------------------------
    // FASE 3: BUCLE SECUENCIAL ASÍNCRONO DE PRUEBAS (TEST EXECUTION LOOP)
    // -------------------------------------------------------------------------------------
    // Se utiliza un bucle 'for...of' para garantizar una ejecución rigurosamente secuencial.
    // Esto evita que múltiples pruebas colisionen simultáneamente sobre el mismo formulario del DOM.
    for (const task of testQueue) {
      // Si la ejecución se encuentra en pausa por confirmación de detención, espera de forma no bloqueante:
      while (isTestRunPaused && !isTestRunCancelled) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (isTestRunCancelled) {
        break;
      }
      completed++;
      currentRunStats.completed = completed;
      if (confirmStopModal && confirmStopModal.style.display !== 'none' && confirmStopProgressText) {
        confirmStopProgressText.innerText = `Se han completado ${completed} de ${testQueue.length} prueba${testQueue.length === 1 ? '' : 's'}.`;
      }
      // Cálculo del porcentaje completado (de 0 a 100).
      const pct = Math.round((completed / testQueue.length) * 100);
      progressPercent.innerText = `${pct}%`;
      progressBarFill.style.width = `${pct}%`;
      progressContainer.setAttribute('aria-valuenow', String(pct));
      const formPrefix = task.field.formTitle ? `[${task.field.formTitle}] ` : '';
      progressLabel.innerText = `(${completed}/${testQueue.length}) ${formPrefix}[${task.field.label}]: ${task.testItem.name}...`;

      // Destaca visualmente el chip del campo que se está evaluando actualmente:
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
        // Pre-llenado de datos válidos en los campos hermanos para aislar el campo auditado:
        const siblingFields = selectedFields.filter(f => f !== task.field);
        const siblingFillers = shouldFillSiblings ? siblingFields.map(f => ({
          fieldInfo: f,
          value: (f.fillerValue !== undefined ? f.fillerValue : f.suggestedFillerValue) || 'Dato Válido QA'
        })) : [];

        // Determina el botón de guardar asignado al campo o el global:
        const targetSaveButton = currentSaveButton || task.field.saveButton || null;

        // Envía el mensaje 'RUN_SINGLE_PAYLOAD' al content-script para ejecutar la prueba en la página:
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

        // Evalúa el resultado con el motor de diagnóstico y recomendaciones:
        const evaluation = evaluateTestResult(task.field, task.testItem, res, triggerSave);
        testResults.push(evaluation);
        appendResultRow(evaluation); // Inserta la nueva fila en la tabla visual.
        updateKPICounters(); // Actualiza contadores KPI en tiempo real.
      } catch (err) {
        // Captura de excepciones en caso de que la pestaña web falle o se desconecte:
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

        // Si la pestaña fue cerrada o navegó fuera, se interrumpe el ciclo de pruebas:
        if (isTabFatal) {
          progressLabel.innerText = 'Pestaña cerrada o desconectada. Pruebas detenidas.';
          selectedFieldsList.querySelectorAll('.field-chip-item').forEach(c => c.classList.remove('field-chip-active'));
          btnRunTests.disabled = false;
          if (btnResetAll) btnResetAll.disabled = false;
          if (btnStopTests) {
            btnStopTests.disabled = true;
            btnStopTests.style.display = 'none';
          }
          btnPickField.disabled = false;
          btnAutoDetectForm.disabled = false;
          if (btnChangeSave) btnChangeSave.disabled = false;
          if (btnInspectSave) btnInspectSave.disabled = !currentSaveButton;
          runBtnText.innerText = `Reanudar Verificación (${selectedFields.length} campos)`;
          alert('Se perdió la conexión con la página web bajo prueba. El ciclo de verificación ha sido detenido.');
          return;
        }
      }

      // Pausa configurable entre pruebas para permitir que los scripts del sitio respiren y no saturen la CPU:
      if (!isTestRunCancelled) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    // Remueve el destello activo de todos los chips de campo:
    selectedFieldsList.querySelectorAll('.field-chip-item').forEach(c => c.classList.remove('field-chip-active'));

    // -------------------------------------------------------------------------------------
    // FASE 4: RESTAURACIÓN DE VALORES ORIGINALES Y FINALIZACIÓN
    // -------------------------------------------------------------------------------------
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

    // Restablece el estado de los botones tras concluir o cancelar la batería de pruebas:
    isTestRunPaused = false;
    closeConfirmStopModal();
    if (btnResetAll) btnResetAll.disabled = false;
    if (btnStopTests) {
      btnStopTests.disabled = true;
      btnStopTests.style.display = 'none';
    }
    btnRunTests.disabled = false;
    btnPickField.disabled = false;
    btnAutoDetectForm.disabled = false;
    if (btnChangeSave) btnChangeSave.disabled = false;
    if (btnInspectSave) btnInspectSave.disabled = !currentSaveButton;

    if (isTestRunCancelled) {
      progressLabel.innerText = `Verificación detenida por el usuario (${completed}/${testQueue.length} casos ejecutados).`;
      runBtnText.innerText = `Reanudar Verificación (${selectedFields.length} campos)`;
    } else {
      progressLabel.innerText = `Pruebas completadas (${testQueue.length} casos).`;
      runBtnText.innerText = `Volver a Iniciar (${selectedFields.length} campos)`;
    }
    // Actualiza la vista de Dashboard con los nuevos datos recopilados:
    renderDashboardView();
    // Oculta la barra de progreso tras 2.5 segundos de gracia si concluyó normalmente:
    if (!isTestRunCancelled) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 2500);
    }
  }

  // Listener para el botón secundario de detención de pruebas (SEC2-H12):
  // Al hacer clic, se abre el modal de confirmación pausando la ejecución para evitar detenciones accidentales.
  if (btnStopTests) {
    btnStopTests.addEventListener('click', () => {
      openConfirmStopModal();
    });
  }

  // =======================================================================================
  // MOTOR DE EVALUACIÓN Y GENERACIÓN DE RECOMENDACIONES (EVALUATION ENGINE)
  // =======================================================================================

  /**
   * Analiza el resultado obtenido tras inyectar un payload y opcionalmente pulsar Guardar.
   * Clasifica el comportamiento del sistema en una de las categorías:
   * - 'conforme': El valor válido fue aceptado normalmente según las reglas esperadas.
   * - 'truncated': El campo recortó el texto antes de guardar (maxlength o máscara activa).
   * - 'restricted_field': El campo impidió la escritura o borró de inmediato el valor inválido.
   * - 'restricted_save': El campo aceptó el valor al teclear pero el botón Guardar o backend lo bloqueó.
   * - 'warning': Se aceptó un valor anómalo de formato o regla de negocio (espacios, ceros, etc.).
   * - 'risk': Se aceptó un vector malicioso de seguridad o sobrecarga (XSS, SQL, DoS, SSRF).
   * - 'error': Fallo técnico o cierre inesperado del formulario durante la prueba.
   * 
   * @param {Object} field - Descriptor del campo auditado.
   * @param {Object} testItem - Caso de prueba ejecutado con su payload y banderas.
   * @param {Object} res - Respuesta devuelta por 'picker.js' tras la inyección.
   * @param {boolean} triggerSave - Si se solicitó la acción de guardado real.
   * @returns {Object} Objeto estructurado con estado, badges, diagnósticos técnicos y recomendaciones.
   */
  function evaluateTestResult(field, testItem, res, triggerSave) {
    const payload = testItem.payload;

    // -------------------------------------------------------------------------------------
    // CASO 0: DETECCIÓN EXPLÍCITA DE CIERRE DEL FORMULARIO O MODAL
    // -------------------------------------------------------------------------------------
    // Si un modal se cerró tras el guardado anterior, el campo ya no existe en el DOM visible.
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

    // Si hubo un error no controlado o no se recibió respuesta de la pestaña web:
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

    // Se extraen valores resultantes y longitudes de caracteres para la comparación:
    const resVal = res.resultingValue !== undefined ? res.resultingValue : '';
    const resLen = res.resultingLength !== undefined ? res.resultingLength : resVal.length;
    const payLen = payload.length;
    const fType = (field.type || 'text').toLowerCase();
    const isNumericText = fType === 'tel' || /\b(cp|postal|zip|telefono|tel|phone|identificacion|dni|cedula|nif|cif)\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);

    // Inicialización de variables de clasificación con valores por defecto:
    let status = 'conforme'; // 'restricted_save' | 'restricted_field' | 'truncated' | 'conforme' | 'risk' | 'error'
    let badgeText = 'Conforme (Guardado)';
    let badgeClass = 'res-conforme';
    let detail = '';
    let recommendation = '';

    // Variables de verificación de estado y validaciones HTML5 nativas:
    const validity = res.validity;
    const hasHTML5Error = validity && !validity.valid;
    const saveBlocked = !!res.saveBlocked;
    const saveErrorMessage = res.saveErrorMessage || '';

    // -------------------------------------------------------------------------------------
    // CASO 1: TRUNCAMIENTO ACTIVO EN EL CAMPO (HTML5 MAXLENGTH O MÁSCARA JS)
    // -------------------------------------------------------------------------------------
    // Si la longitud resultante en el campo es inferior a la del payload inyectado:
    // Excluimos del diagnóstico de truncamiento la reducción normalizada de ceros a la izquierda en inputs nativos type="number" (SEC2-H08):
    const isNumberLeadingZerosNormalized = fType === 'number' &&
      resVal !== '' &&
      (testItem.id === 'num_leading_zeros' || /^0+\d+$/.test(payload)) &&
      Number(resVal) === Number(payload);

    if (resLen < payLen && payLen > 1 && !isNumberLeadingZerosNormalized) {
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
    // -------------------------------------------------------------------------------------
    // CASO 2: RECHAZO DIRECTO E INMEDIATO EN EL CAMPO (VALOR LIMPIADO O RECHAZADO)
    // -------------------------------------------------------------------------------------
    // Si el valor resultante quedó vacío cuando el payload no era vacío:
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
    // -------------------------------------------------------------------------------------
    // CASO 3: EMOJIS O GLIFOS ELIMINADOS POR FILTRO DE CARACTERES
    // -------------------------------------------------------------------------------------
    else if (testItem.category === 'emoji' && resVal !== payload && resLen < payLen) {
      status = 'restricted_field';
      badgeText = 'Restringido en Campo';
      badgeClass = 'res-restricted-field';
      detail = `Los emojis o símbolos fueron filtrados o eliminados del campo automáticamente. (Recibido: "${resVal.slice(0, 15)}...").`;
      recommendation = 'Comportamiento esperado si el campo prohíbe caracteres especiales. Si se esperan nombres internacionales, verificar soporte UTF-8.';
    }
    // -------------------------------------------------------------------------------------
    // CASO 4: BLOQUEO AL PULSAR EL BOTÓN DE GUARDAR (VALIDACIÓN DE FORMULARIO O BACKEND)
    // -------------------------------------------------------------------------------------
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
    // -------------------------------------------------------------------------------------
    // CASO 5: ERROR NATIVO HTML5 O MENSAJES DE ERROR VISIBLES EN EL DOM (SIN GUARDAR)
    // -------------------------------------------------------------------------------------
    else if (hasHTML5Error || (res.postInputErrors && res.postInputErrors.length > 0)) {
      // Verificación de intento de guardado sin bloqueo efectivo (SEC2-H14):
      if (triggerSave && !saveBlocked) {
        status = 'warning';
        badgeText = 'Omisión de Validación al Enviar';
        badgeClass = 'res-format';
        const msgList = [];
        if (res.validationMessage) msgList.push(`HTML5: "${res.validationMessage}"`);
        if (validity?.patternMismatch && field.pattern) {
          msgList.push(`Violación de patrón: pattern="${field.pattern}"`);
        }
        if (res.postInputErrors?.length > 0) msgList.push(`Alerta: "${res.postInputErrors[0]}"`);
        detail = `El campo acusó una irregularidad (${msgList.join(' | ') || 'Error de validación'}), pero el formulario permitió el envío sin bloquear la acción y procesó los datos.`;
        recommendation = field.pattern && validity?.patternMismatch
          ? `Garantizar que el formulario bloquee el envío cuando el valor incumpla la expresión regular declarada (pattern="${field.pattern}") en frontend y backend.`
          : 'Asegurar que el formulario no omita la validación nativa (evitar atributo novalidate sin validaciones suplementarias) y bloquear el envío ante errores.';
      } else {
        status = 'restricted_field';
        badgeText = 'Restringido en Campo';
        badgeClass = 'res-restricted-field';
        const msgList = [];
        if (res.validationMessage) msgList.push(`HTML5: "${res.validationMessage}"`);
        if (validity?.patternMismatch && field.pattern) {
          msgList.push(`Patrón requerido: pattern="${field.pattern}"`);
        }
        if (res.postInputErrors?.length > 0) msgList.push(`Alerta: "${res.postInputErrors[0]}"`);
        detail = `El sitio detectó la irregularidad: ${msgList.join(' | ') || 'Validación activa'}.`;
        recommendation = field.pattern && validity?.patternMismatch
          ? `Correcto: El campo avisa de inmediato que la entrada no coincide con el patrón especificado (pattern="${field.pattern}").`
          : 'Correcto: El campo avisa de inmediato al usuario que el valor no es válido.';
      }
    }
    // -------------------------------------------------------------------------------------
    // CASO 6: VALOR ACEPTADO Y GUARDADO SIN NINGÚN ERROR DETECTADO
    // -------------------------------------------------------------------------------------
    else {
      // Se discrimina si el caso ejecutado era intencionalmente un valor inválido o ataque:
      if (testItem.isInvalidCase) {
        // Diagnóstico minucioso por tipo de anomalía:
        // Caso A: Solo espacios en blanco
        if (testItem.id === 'txt_only_spaces' || (typeof payload === 'string' && payload.length > 0 && payload.trim() === '')) {
          status = 'warning';
          badgeText = 'Defecto de Formato (Espacios)';
          badgeClass = 'res-logic';
          detail = `Se ingresó una cadena compuesta únicamente por espacios en blanco (${payLen} caracteres). El formulario permitió guardarla sin recortar ni requerir texto visible, generando registros vacíos o invisibles.`;
          recommendation = 'Aplicar .trim() obligatorio en frontend y backend antes de evaluar minLength > 0 para impedir el almacenamiento de registros vacíos.';
        } 
        // Caso B: Caracteres invisibles de ancho cero [Zero-Width]
        else if (testItem.id === 'txt_zero_width' || (typeof payload === 'string' && /[\u200B-\u200D\uFEFF]/.test(payload))) {
          status = 'warning';
          badgeText = 'Riesgo de Integridad (Spoofing)';
          badgeClass = 'res-integrity';
          detail = `El campo aceptó ${resLen} caracteres incluyendo caracteres invisibles de control Unicode (\\u200B-\\u200D, \\uFEFF). Esto puede facilitar la suplantación visual de identidad o evasión de filtros.`;
          recommendation = 'Filtrar caracteres de control y formato Unicode (rangos \\u200B-\\u200D, \\uFEFF) mediante expresión regular o normalización previa al almacenamiento.';
        } 
        // Caso C: Cadena excesiva de dígitos en campo alfabético (nombres, títulos) (SEC2-H06)
        else if ((testItem.id === 'txt_15_digits' || (typeof payload === 'string' && /^\d{10,}$/.test(payload))) && fType !== 'number' && fType !== 'tel' && fType !== 'textarea' && field.tag !== 'textarea' && !isNumericText && !/\b(comentario|direccion|nota|address|comment|desc|detalles|mensaje|message|street|calle|observacion)\b/i.test(`${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`)) {
          status = 'warning';
          badgeText = 'Regla de Negocio (Formato)';
          badgeClass = 'res-format';
          detail = `Se ingresó una cadena de ${payLen} dígitos numéricos ('${payload}'). El formulario la aceptó en un campo textual sin verificar regla alfabética ni restricción de tipo de dato.`;
          recommendation = 'Validar formato con expresión regular que restrinja dígitos y exija caracteres alfabéticos para nombres personales o campos lingüísticos.';
        } 
        // Caso D: Sobrecarga de longitud extensa [1000 a 5000 caracteres] (SEC2-H09)
        else if (testItem.id === 'txt_1000' || testItem.id === 'txt_5000' || payLen >= 1000) {
          status = 'risk';
          badgeText = 'Riesgo de Capacidad (DoS / Búfer)';
          badgeClass = 'res-capacity';
          detail = `El formulario aceptó y guardó una carga extensa de ${resLen} caracteres sin aplicar límite maxlength ni validación de longitud máxima en frontend o backend.`;
          recommendation = (fType === 'textarea' || field.tag === 'textarea')
            ? 'Definir atributo maxlength en HTML y restringir rígidamente en el backend (ej. límite de 2,000 a 5,000 caracteres para áreas multilínea) para mitigar sobrecarga de memoria y denegación de servicio.'
            : 'Definir atributo maxlength en HTML y restringir rígidamente en el backend (ej. máximo 100-150 caracteres para nombres o datos breves) para mitigar desbordamientos y denegación de servicio.';
        } 
        // Caso E: Inyección XSS [Cross-Site Scripting]
        else if (testItem.id === 'sec_script' || testItem.id === 'sec_img_onerror' || testItem.id === 'sec_html_tags' || (testItem.category === 'security' && /<[a-z][\s\S]*>/i.test(payload))) {
          status = 'risk';
          badgeText = 'Indicador: Falta de Filtrado (XSS)';
          badgeClass = 'res-risk';
          const sample = payload.length > 32 ? payload.slice(0, 30) + '...' : payload;
          detail = `El campo guardó sintaxis HTML/JavaScript ('${sample}') sin validación de lista blanca (allowlist). Nota técnica: La aceptación en el input no implica XSS ejecutable automático; el riesgo real surge si la aplicación renderiza este contenido en el navegador sin escapado contextual (output encoding).`;
          recommendation = 'Validar caracteres permitidos en el input mediante lista blanca (allowlist) y garantizar sanitización y escapado HTML context-aware al renderizar los datos en el navegador.';
        } 
        // Caso F: Inyección SQL
        else if (testItem.id === 'sec_sql_basic' || (testItem.category === 'security' && /('|--|\bOR\b|\bAND\b)/i.test(payload))) {
          status = 'risk';
          badgeText = 'Indicador: Falta de Filtrado (SQL)';
          badgeClass = 'res-risk';
          detail = `El formulario aceptó caracteres de sintaxis SQL ('${payload}'). Nota técnica: Aceptar sintaxis SQL en la entrada no implica inyección ejecutable por sí sola; el riesgo existe únicamente si la capa de persistencia concatena sentencias sin consultas preparadas.`;
          recommendation = 'Implementar sentencias preparadas (parameterized queries) o uso estricto de ORM en backend; restringir caracteres de sintaxis SQL innecesarios en la capa de entrada.';
        } 
        // Caso G: Byte Nulo [%00]
        else if (testItem.id === 'sec_null_byte' || (typeof payload === 'string' && payload.includes('\u0000'))) {
          status = 'risk';
          badgeText = 'Indicador: Falta de Filtrado (Null Byte)';
          badgeClass = 'res-risk';
          detail = `El campo aceptó el carácter de terminación nula (\\0). Aunque JavaScript maneja cadenas con terminador nulo, puede truncar cadenas al interactuar con librerías nativas C/C++ o rutas del sistema de archivos en el backend.`;
          recommendation = 'Rechazar o filtrar caracteres de control ASCII (código 0 / \\0) en la capa de validación de entrada antes de procesar o persistir.';
        } 
        // Caso H: Fechas imposibles en calendario
        else if (testItem.category === 'date') {
          status = 'warning';
          badgeText = 'Fecha Inválida Aceptada';
          badgeClass = 'res-format';
          detail = `El formulario permitió ingresar y guardar la fecha '${payload}', la cual no corresponde a un día o mes válido en el calendario o se encuentra fuera del rango de negocio.`;
          recommendation = 'Utilizar un control nativo con tipo date o implementar validación estricta de calendario (año bisiesto, 28-31 días, meses 1-12) en frontend y backend.';
        } 
        // Caso I.1: Desbordamiento numérico [num_overflow] (SEC2-H07)
        else if (testItem.id === 'num_overflow') {
          status = 'risk';
          badgeText = 'Desbordamiento Numérico Aceptado';
          badgeClass = 'res-capacity';
          detail = `El campo aceptó un valor numérico masivo (${payload}) que supera la precisión de enteros seguros en JavaScript (Number.MAX_SAFE_INTEGER) o límites de columnas enteras en base de datos.`;
          recommendation = 'Configurar atributo max en HTML y aplicar validación estricta de rangos numéricos seguros (ej. 32 o 64 bits) en el backend.';
        }
        // Caso I.2: Cantidades negativas no deseadas [num_negative] (SEC2-H07)
        else if (testItem.id === 'num_negative') {
          status = 'warning';
          badgeText = 'Número Negativo Aceptado';
          badgeClass = 'res-format';
          detail = `El campo numérico aceptó un número con signo negativo ('${payload}') en un contexto que podría requerir magnitudes exclusivamente positivas o cero.`;
          recommendation = 'Si el campo representa cantidades o importes no negativos, definir el atributo min="0" en HTML y verificar el signo en frontend y backend.';
        }
        // Caso I.3: Texto o caracteres no numéricos en campo de número [num_non_numeric, etc.] (SEC2-H07)
        else if (testItem.category === 'number') {
          status = 'warning';
          badgeText = 'Dato No Numérico Aceptado';
          badgeClass = 'res-format';
          detail = `El campo numérico aceptó el valor '${payload}' sin forzar formato numérico ni validar límites de tipo de dato.`;
          recommendation = 'Configurar el atributo type="number" o regex de validación numérica, y validar estrictamente en el backend.';
        } 
        // Caso J: URL sin protocolo [falta https://]
        else if (testItem.id === 'url_missing_scheme') {
          status = 'warning';
          badgeText = 'Defecto de Formato (Sin Protocolo)';
          badgeClass = 'res-format';
          detail = `Se ingresó la URL '${payload}' sin especificar protocolo (http:// o https://). El sitio la aceptó y guardó directamente.`;
          recommendation = 'Exigir protocolo obligatorio en frontend/backend (ej. https://) o anteponerlo automáticamente antes de guardar para evitar enlaces relativos rotos en la interfaz.';
        } 
        // Caso K: URL con espacios sin codificar [%20]
        else if (testItem.id === 'url_unencoded_spaces') {
          status = 'warning';
          badgeText = 'Defecto de Sintaxis (RFC 3986)';
          badgeClass = 'res-format';
          detail = `El campo aceptó la dirección '${payload}' con espacios en blanco sin codificar, violando la especificación estándar de URIs RFC 3986.`;
          recommendation = 'Rechazar URLs con espacios o aplicar percent-encoding (%20) automático antes de procesar o almacenar el recurso.';
        } 
        // Caso L: Dominio o host con puntos dobles
        else if (testItem.id === 'url_invalid_domain') {
          status = 'warning';
          badgeText = 'Hostname Malformado';
          badgeClass = 'res-format';
          detail = `El formulario aceptó la dirección '${payload}' con un nombre de host inválido (etiquetas vacías o puntos consecutivos).`;
          recommendation = 'Validar la estructura del hostname mediante el constructor estándar URL o expresiones regulares basadas en RFC 1123.';
        } 
        // Caso M: Esquemas peligrosos en URLs [javascript:, data:]
        else if (testItem.id === 'url_xss_javascript' || testItem.id === 'url_data_scheme') {
          status = 'risk';
          badgeText = 'Indicador: Esquema Peligroso';
          badgeClass = 'res-risk';
          detail = `El campo aceptó el esquema no seguro ('${payload.slice(0, 20)}...'). Si este enlace es renderizado en una etiqueta <a> o iframe sin filtrado, puede provocar ejecución de scripts (XSS).`;
          recommendation = 'Implementar una lista blanca estricta de esquemas permitidos (únicamente http: y https:) y rechazar explícitamente esquemas como javascript:, data:, vbscript: o file:.';
        } 
        // Caso N: URL relativa de protocolo [//ejemplo.com]
        else if (testItem.id === 'url_protocol_relative') {
          status = 'warning';
          badgeText = 'URL Relativa de Protocolo';
          badgeClass = 'res-format';
          detail = `El campo aceptó la sintaxis dependiente de protocolo ('${payload}'). Dependiendo del contexto, puede heredar esquemas inesperados o conectar a destinos imprevistos.`;
          recommendation = 'Normalizar la URL forzando esquema explícito seguro https://.';
        } 
        // Caso O: Host local o intranet [Riesgo SSRF] (SEC2-H10)
        else if (testItem.id === 'url_internal_ssrf') {
          status = 'risk';
          badgeText = 'Riesgo de Seguridad SSRF (Host Interno)';
          badgeClass = 'res-risk';
          detail = `El formulario aceptó una dirección dirigida a la interfaz loopback local o red privada ('${payload}'). Si el backend consulta o descarga recursos de esta URL, existe riesgo de Server-Side Request Forgery (SSRF).`;
          recommendation = 'Si el servidor realiza peticiones fetch/webhook hacia las URLs guardadas, validar y bloquear resolución a IPs locales (127.0.0.1, localhost) y rangos privados RFC 1918.';
        } 
        // Caso O.2: Formato de correo electrónico inválido [email_invalid_format] (SEC2-H04)
        else if (testItem.id === 'email_invalid_format') {
          status = 'warning';
          badgeText = 'Formato de Correo Inválido';
          badgeClass = 'res-format';
          detail = `El formulario aceptó la dirección '${payload}' carente de arroba (@) o estructura canónica de correo conforme a RFC 5322.`;
          recommendation = 'Configurar el atributo type="email" con validación obligatoria de sintaxis de correo en frontend y backend.';
        }
        // Caso P: Longitud extrema de URL [>2000 caracteres]
        else if (testItem.id === 'url_excessive_length') {
          status = 'risk';
          badgeText = 'Indicador: Búfer / Longitud Extensa';
          badgeClass = 'res-capacity';
          detail = `El campo aceptó una URL extensa de ${resLen} caracteres sin aplicar límite razonable de longitud.`;
          recommendation = 'Definir atributo maxlength="2048" en el campo HTML y validar en backend el límite estándar de navegadores y servidores web.';
        } 
        // Caso Q: Caso inválido genérico (SEC2-H13, SEC2-H15)
        else {
          // Evaluación taxonómica: si el vector pertenece a categorías estándar sin patrones de inyección comprobados:
          const isStandardCategory = ['text', 'number', 'date', 'url'].includes(testItem.category);
          const hasInjectionPattern = /<[a-z][\s\S]*>/i.test(payload) ||
                                      /('|--|\bOR\b|\bAND\b)/i.test(payload) ||
                                      (typeof payload === 'string' && payload.includes('\u0000')) ||
                                      /^(javascript|data):/i.test(payload);

          let patternMismatchDetected = false;
          if (field.pattern && typeof payload === 'string') {
            try {
              const rx = new RegExp('^(?:' + field.pattern + ')$');
              if (!rx.test(payload)) patternMismatchDetected = true;
            } catch (e) {}
          }

          if (isStandardCategory && !hasInjectionPattern) {
            status = 'warning';
            badgeText = 'Regla de Validación / Formato';
            badgeClass = 'res-format';
            detail = triggerSave 
              ? `El formulario guardó ${resLen} caracteres ('${payload.slice(0, 25)}...') sin aplicar validación de regla de negocio o formato.`
              : `Aceptó ${resLen} caracteres en el campo sin recortar ni validar el formato esperado.`;
            if (patternMismatchDetected) {
              detail += ` El valor no cumple con la expresión regular declarada (pattern="${field.pattern}").`;
            }
            recommendation = patternMismatchDetected
              ? `Garantizar que la validación en frontend y backend aplique estrictamente el patrón declarado (pattern="${field.pattern}") antes de procesar el envío.`
              : 'Definir reglas de validación en frontend y backend para delimitar los valores permitidos según las especificaciones del campo.';
          } else {
            status = 'risk';
            badgeText = 'Hallazgo Potencial: Sin Restricción';
            badgeClass = 'res-risk';
            detail = triggerSave 
              ? `El formulario guardó ${resLen} caracteres anómalos ('${payload.slice(0, 25)}...') sin disparar alertas ni validaciones.`
              : `Aceptó ${resLen} caracteres anómalos en el campo sin recortar ni validar.`;
            recommendation = 'Definir reglas de validación en frontend y backend para delimitar los valores permitidos según las especificaciones del campo.';
          }
        }
      } else {
        // Caso de prueba benigno y esperado:
        // Verificación de superación de maxlength declarado (SEC2-H05):
        if (field.maxLength && field.maxLength > 0 && resLen > field.maxLength) {
          status = 'risk';
          badgeText = 'Límite Maxlength Superado';
          badgeClass = 'res-capacity';
          detail = triggerSave
            ? `El formulario aceptó y guardó ${resLen} caracteres, superando la longitud máxima declarada en HTML (maxlength="${field.maxLength}"). No se recortó ni validó en frontend ni backend.`
            : `El campo aceptó ${resLen} caracteres, superando la longitud máxima declarada en HTML (maxlength="${field.maxLength}"). No se recortó en frontend.`;
          recommendation = 'Garantizar que el atributo maxlength impida el ingreso en frontend y validar rígidamente en el backend que la longitud no exceda el límite permitido.';
        } else {
          status = 'conforme';
          badgeText = triggerSave ? 'Conforme (Guardado)' : 'Conforme (Aceptado)';
          badgeClass = 'res-conforme';
          detail = `Valor válido aceptado y guardado correctamente por el formulario (${resLen} caracteres).`;
          recommendation = 'Comportamiento estándar y conforme según las reglas de negocio del formulario.';
        }
      }
    }

    // Devuelve el objeto completo de auditoría para su registro y renderizado:
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

  // =======================================================================================
  // INSERCIÓN DE FILAS Y RENDERIZADO EN LA TABLA DE RESULTADOS
  // =======================================================================================

  /**
   * Genera y agrega una nueva fila tr en el cuerpo de la tabla (#results-tbody).
   * Asigna atributos de datos HTML5 (dataset) para permitir el filtrado reactivo en tiempo real
   * y configura la apertura del modal visor al hacer clic sobre el código del payload.
   * @param {Object} result - Objeto de resultado generado por evaluateTestResult.
   */
  function appendResultRow(result) {
    // Se crea el elemento tr para la fila de la tabla:
    const tr = document.createElement('tr');
    // Atributos dataset para permitir búsquedas y filtrados dinámicos sin consultar el objeto:
    tr.dataset.status = result.status;
    tr.dataset.fieldName = result.fieldName;
    tr.dataset.fieldKey = result.fieldKey || result.fieldName;

    // Si el texto del payload es muy largo, se trunca a 25 caracteres con elipsis visual:
    let displayInput = result.input;
    if (displayInput.length > 28) {
      displayInput = displayInput.slice(0, 25) + '...';
    }

    // Se inyecta la estructura de celdas con escape de entidades HTML para evitar inyección:
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

    // Asocia un escucha al elemento <code> para desplegar el modal con el texto completo del payload:
    const codeEl = tr.querySelector('code');
    if (codeEl) {
      codeEl.addEventListener('click', () => {
        showViewerModal(result.testItem.name, result.input);
      });
    }

    // Se inserta la fila al final del tbody:
    resultsTbody.appendChild(tr);
    try {
      // Desplazamiento suave para mantener la última prueba ejecutada a la vista del usuario:
      tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {}
    // Aplica los filtros activos para determinar si la nueva fila debe ser visible o permanecer oculta:
    applyResultsFilter();
  }

  // =======================================================================================
  // CONTADORES KPI (KEY PERFORMANCE INDICATORS)
  // =======================================================================================

  /**
   * Recalcula y actualiza los cuatro contadores numéricos de la tarjeta de resumen:
   * - Total de pruebas evaluadas
   * - Pruebas con defensas activas detectadas (restringidas al guardar o en el campo)
   * - Pruebas conformes aceptadas legítimamente
   * - Anomalías categorizadas como riesgo o advertencia
   */
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

  // =======================================================================================
  // FILTRADO DINÁMICO DE LA TABLA DE RESULTADOS
  // =======================================================================================

  // Escuchas para conmutar los chips de filtro por severidad/estado (Todos, Restringidos, Conformes, Riesgos):
  resultsFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      resultsFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      applyResultsFilter();
    });
  });

  // Escucha del dropdown para filtrar la tabla por un campo de entrada específico:
  filterFieldSelect.addEventListener('change', (e) => {
    activeFieldFilter = e.target.value;
    applyResultsFilter();
  });

  /**
   * Oculta o muestra cada fila de la tabla evaluando si coincide simultáneamente
   * con el filtro de severidad activo y el filtro de campo seleccionado.
   */
  function applyResultsFilter() {
    const rows = resultsTbody.querySelectorAll('tr');
    rows.forEach(r => {
      const status = r.dataset.status;
      const fieldName = r.dataset.fieldName;
      const fieldKey = r.dataset.fieldKey;

      // Evalúa concordancia con el filtro de estado:
      const matchesStatus = 
        activeFilter === 'all' ||
        (activeFilter === 'restricted' && (status === 'restricted_save' || status === 'restricted_field')) ||
        (activeFilter === 'conforme' && status === 'conforme') ||
        (activeFilter === 'truncated' && status === 'truncated') ||
        (activeFilter === 'risk' && (status === 'risk' || status === 'warning'));

      // Evalúa concordancia con el filtro de campo:
      const matchesField = 
        activeFieldFilter === 'all' || 
        fieldName === activeFieldFilter ||
        fieldKey === activeFieldFilter;

      // Si cumple ambas condiciones se mantiene visible; caso contrario se oculta con CSS display none:
      if (matchesStatus && matchesField) {
        r.style.display = '';
      } else {
        r.style.display = 'none';
      }
    });
  }

  // Botón para vaciar la tabla de resultados y restablecer los KPIs a cero:
  btnClearResults.addEventListener('click', () => {
    resultsTbody.innerHTML = '';
    testResults = [];
    updateKPICounters();
    resetDashboardState();
    resultsCard.style.display = 'none';
  });

  // =======================================================================================
  // TAXONOMÍA DE RIESGOS Y MOTOR DEL DASHBOARD (RISK TAXONOMY & DASHBOARD ENGINE)
  // =======================================================================================

  /**
   * Clasifica un resultado de prueba en una de las 5 categorías oficiales de diagnóstico:
   * 1. 'security': Prioritario (Vectores XSS, SQLi, null byte o esquemas URI no permitidos).
   * 2. 'capacity': Alto (Sobrecargas masivas de 1000 a 5000 chars o URLs enormes sin maxlength).
   * 3. 'integrity': Medio (Caracteres invisibles Unicode zero-width o secuencias compuestas).
   * 4. 'format_logic': Medio (Ausencia de trim, validación alfabética, fechas o números).
   * 5. 'conforme': Conforme (Comportamiento conforme o defensas activas del frontend/servidor).
   * 
   * @param {Object} r - Objeto de resultado individual.
   * @returns {Object} Descriptor taxonómico con clave, título, severidad, clase CSS e icono SVG.
   */
  function categorizeTestRisk(r) {
    const item = r.testItem || {};
    const itemId = item.id || '';
    const itemCat = item.category || '';
    const payload = typeof r.input === 'string' ? r.input : String(r.input || '');
    const isAnomalous = r.status === 'risk' || r.status === 'warning' || r.status === 'error';

    // Si el resultado demostró defensas activas (bloqueo al guardar, truncamiento o conforme):
    if (!isAnomalous) {
      return {
        key: 'conforme',
        title: 'Validaciones Efectivas y Casos Conformes',
        severity: 'CONFORME',
        severityClass: 'cat-safe',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        desc: 'Validaciones donde el campo o el servidor demostraron defensas activas (bloqueo al guardar, recorte por longitud o procesamiento conforme).'
      };
    }

    // 1. Grupo Seguridad e Inyecciones (Atención Prioritaria):
    if (
      itemCat === 'security' ||
      itemId === 'url_xss_javascript' ||
      itemId === 'url_data_scheme' ||
      itemId === 'url_internal_ssrf' ||
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
        severity: 'PRIORITARIO',
        severityClass: 'cat-critical',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
        desc: 'Vectores de XSS, sintaxis SQL, caracteres nulos o esquemas ejecutables aceptados sin lista blanca ni filtrado en entrada.'
      };
    }

    // 2. Grupo Capacidad y Resistencia DoS (Severidad Alta):
    if (
      itemId === 'txt_1000' ||
      itemId === 'txt_5000' ||
      itemId === 'url_excessive_length' ||
      r.badgeClass === 'res-capacity' ||
      payload.length >= 1000
    ) {
      return {
        key: 'capacity',
        title: 'Capacidad y Resistencia de Búfer',
        severity: 'ALTO',
        severityClass: 'cat-high',
        iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
        desc: 'Cargas masivas de texto y URLs de longitud excesiva sin límite maxlength ni control de tamaño en el backend.'
      };
    }

    // 3. Grupo Integridad y Spoofing Unicode (Severidad Media):
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

    // 4. Grupo Lógica de Negocio y Reglas de Formato (Severidad Media / Observación):
    return {
      key: 'format_logic',
      title: 'Integridad y Lógica de Formato',
      severity: 'MEDIO',
      severityClass: 'cat-medium',
      iconSvg: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
      desc: 'Omisión de recorte de espacios (trim), formato alfabético, calendarios de fecha o sintaxis estándar RFC.'
    };
  }

  // ============================================================================
  // FUNCIÓN: renderDashboardView
  // ============================================================================
  // PROPÓSITO:
  // Renderizar la vista analítica del Dashboard dentro del contenedor visual del Sidepanel.
  // Transforma la lista plana de resultados de pruebas (testResults) en un resumen
  // estructurado por severidad, calcula una métrica porcentual de robustez del formulario,
  // dibuja la barra visual de distribución proporcional de riesgos y genera tarjetas
  // colapsables interactivas (tipo acordeón) para cada una de las 5 categorías analizadas.
  //
  // PARÁMETROS: Ninguno (utiliza el estado global 'testResults' del Sidepanel).
  // RETORNO: Ninguno. Modifica directamente el DOM y sincroniza el almacenamiento local.
  // ============================================================================
  function renderDashboardView() {
    // 1. Verificación defensiva previa de la existencia de contenedores en el DOM:
    // Si los contenedores principales no existen en el árbol HTML, abortamos de inmediato.
    if (!dashboardViewContainer || !dashboardRiskGroups) return;

    // 2. Control de Estado Vacío (Empty State):
    // Si aún no se han ejecutado pruebas, mostramos un mensaje orientativo al usuario
    // y reseteamos los indicadores visuales a sus valores neutros predeterminados.
    if (testResults.length === 0) {
      // Inyectamos el aviso informativo indicando que se requiere correr la auditoría:
      dashboardRiskGroups.innerHTML = `
        <div class="empty-notice" style="margin: 10px 0;">
          No hay resultados evaluados aún. Ejecuta la verificación para generar el dashboard.
        </div>
      `;
      // Restablecemos el texto del porcentaje a un indicador nulo:
      if (dashboardScoreVal) dashboardScoreVal.innerText = '--%';

      // Asignamos la insignia de estado inactivo:
      if (dashboardRiskLevelBadge) {
        dashboardRiskLevelBadge.className = 'badge badge-idle';
        dashboardRiskLevelBadge.innerText = 'Sin pruebas';
      }

      // Localizamos los elementos de texto de la barra de distribución proporcional:
      const spDistCrit = document.getElementById('sp-dist-crit-val');
      const spDistHigh = document.getElementById('sp-dist-high-val');
      const spDistMed = document.getElementById('sp-dist-med-val');
      const spDistSafe = document.getElementById('sp-dist-safe-val');

      // Restablecemos los contadores numéricos y porcentuales a cero absoluto:
      if (spDistCrit) spDistCrit.innerText = '0 (0%)';
      if (spDistHigh) spDistHigh.innerText = '0 (0%)';
      if (spDistMed) spDistMed.innerText = '0 (0%)';
      if (spDistSafe) spDistSafe.innerText = '0 (0%)';
      return;
    }

    // 3. Variables de agregación y conteo global:
    const total = testResults.length; // Total absoluto de evaluaciones realizadas
    let criticalCount = 0; // Acumulador de indicadores de severidad Prioritaria (Inyecciones, XSS)
    let highCount = 0;     // Acumulador de fallas de severidad Alta (Capacidad, Desbordamiento DoS)
    let mediumCount = 0;   // Acumulador de anomalías de severidad Media (Unicode, Lógica, Formato)
    let safeCount = 0;     // Acumulador de pruebas superadas con éxito (Comportamiento Seguro)

    // Diccionario clasificador que agrupará los objetos de prueba según su clave de riesgo:
    const grouped = {
      security: [],
      capacity: [],
      integrity: [],
      format_logic: [],
      conforme: []
    };

    // 4. Iteración y distribución de cada resultado en su categoría correspondiente:
    testResults.forEach(r => {
      // Obtenemos la definición taxonómica de riesgo evaluando el resultado individual:
      const cat = categorizeTestRisk(r);

      // Agregamos el resultado al arreglo de la categoría detectada:
      grouped[cat.key].push(r);

      // Incrementamos los acumuladores numéricos correspondientes para métricas y gráficos:
      if (cat.key === 'security') criticalCount++;
      else if (cat.key === 'capacity') highCount++;
      else if (cat.key === 'integrity' || cat.key === 'format_logic') mediumCount++;
      else if (cat.key === 'conforme') safeCount++;
    });

    // 5. Cálculo Matemático del Índice de Robustez:
    // La fórmula calcula el porcentaje de pruebas seguras respecto al total evaluado:
    // Índice = redondear((safeCount / total) * 100).
    // Se utiliza Math.max(0, Math.min(100, ...)) para garantizar que el valor siempre
    // se encuentre dentro del rango acotado entre 0% y 100%.
    const score = Math.max(0, Math.min(100, Math.round((safeCount / total) * 100)));

    // Actualizamos el elemento visual que exhibe la cifra del puntaje:
    if (dashboardScoreVal) {
      dashboardScoreVal.innerText = `${score}%`;
    }

    // 6. Asignación Dinámica de la Insignia de Nivel Global de Riesgo y Mensaje Contextual:
    // Se evalúa la presencia de incidencias en orden descendente de severidad:
    if (dashboardRiskLevelBadge) {
      if (criticalCount > 0) {
        // Presencia de indicadores de inyección o seguridad en capa de entrada:
        dashboardRiskLevelBadge.className = 'badge badge-danger';
        dashboardRiskLevelBadge.innerText = 'Atención Prioritaria';
        // Resaltamos el borde del contenedor del puntaje con color rojo de alerta:
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#f87171';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `Se detectaron <strong>${criticalCount} indicador(es) de seguridad</strong>. Requiere revisión prioritaria de filtrado y escapado.`;
        }
      } else if (highCount > 0) {
        // Presencia de riesgos de denegación de servicio o longitudes excesivas:
        dashboardRiskLevelBadge.className = 'badge badge-warning';
        dashboardRiskLevelBadge.innerText = 'Capacidad y Búfer';
        // Resaltamos el borde del puntaje con color rosa-naranja de precaución:
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#fb7185';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `El formulario admitió sobrecargas extensas sin límite maxlength. Riesgo de degradación o desbordamiento.`;
        }
      } else if (mediumCount > 0) {
        // Presencia de fallas en saneamiento o lógica de formato:
        dashboardRiskLevelBadge.className = 'badge badge-warning';
        dashboardRiskLevelBadge.innerText = 'Observaciones Leves';
        // Resaltamos el borde del puntaje con color ámbar:
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#fbbf24';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `Validaciones funcionales incompletas (espacios en blanco, formato numérico o caracteres Unicode).`;
        }
      } else {
        // Ausencia total de fallas; todas las pruebas fueron debidamente contenidas:
        dashboardRiskLevelBadge.className = 'badge badge-active';
        dashboardRiskLevelBadge.innerText = 'Resiliencia Alta';
        // Resaltamos el borde del puntaje con color esmeralda satisfactorio:
        if (dashboardScoreVal?.parentElement) dashboardScoreVal.parentElement.style.borderColor = '#34d399';
        if (dashboardSummaryMsg) {
          dashboardSummaryMsg.innerHTML = `¡Excelente! Todas las pruebas evaluadas fueron restringidas al guardar o cumplieron el comportamiento esperado.`;
        }
      }
    }

    // 7. Actualización de las tarjetas numéricas de KPIs (Key Performance Indicators):
    if (statCriticalCount) statCriticalCount.innerText = `${criticalCount} ${criticalCount === 1 ? 'Prioritario' : 'Prioritarios'}`;
    if (statHighCount) statHighCount.innerText = `${highCount} ${highCount === 1 ? 'Alto' : 'Altos'}`;
    if (statMediumCount) statMediumCount.innerText = `${mediumCount} ${mediumCount === 1 ? 'Medio' : 'Medios'}`;
    if (statSafeCount) statSafeCount.innerText = `${safeCount} ${safeCount === 1 ? 'Conforme' : 'Conformes'}`;

    // 8. Dibujo y dimensionamiento de la Barra de Distribución Proporcional de Riesgos:
    if (dashboardDistBar) {
      // Calculamos los porcentajes relativos de cada nivel respecto al total:
      const pCrit = total > 0 ? (criticalCount / total) * 100 : 0;
      const pHigh = total > 0 ? (highCount / total) * 100 : 0;
      const pMed = total > 0 ? (mediumCount / total) * 100 : 0;
      const pSafe = total > 0 ? (safeCount / total) * 100 : 0;

      // Localizamos los segmentos coloreados individuales dentro de la barra compuesta:
      const segCrit = dashboardDistBar.querySelector('.seg-critical');
      const segHigh = dashboardDistBar.querySelector('.seg-high');
      const segMed = dashboardDistBar.querySelector('.seg-medium');
      const segSafe = dashboardDistBar.querySelector('.seg-safe');

      // Modificamos el ancho CSS de cada segmento según su proporción calculada:
      if (segCrit) { segCrit.style.width = `${pCrit}%`; segCrit.title = `Seguridad: ${criticalCount} (${Math.round(pCrit)}%)`; }
      if (segHigh) { segHigh.style.width = `${pHigh}%`; segHigh.title = `Capacidad DoS: ${highCount} (${Math.round(pHigh)}%)`; }
      if (segMed) { segMed.style.width = `${pMed}%`; segMed.title = `Integridad/Formato: ${mediumCount} (${Math.round(pMed)}%)`; }
      if (segSafe) { segSafe.style.width = `${pSafe}%`; segSafe.title = `Conformes: ${safeCount} (${Math.round(pSafe)}%)`; }

      // Actualizamos las etiquetas de texto complementarias ubicadas debajo de la barra:
      const spDistCrit = document.getElementById('sp-dist-crit-val');
      const spDistHigh = document.getElementById('sp-dist-high-val');
      const spDistMed = document.getElementById('sp-dist-med-val');
      const spDistSafe = document.getElementById('sp-dist-safe-val');
      if (spDistCrit) spDistCrit.innerText = `${criticalCount} (${Math.round(pCrit)}%)`;
      if (spDistHigh) spDistHigh.innerText = `${highCount} (${Math.round(pHigh)}%)`;
      if (spDistMed) spDistMed.innerText = `${mediumCount} (${Math.round(pMed)}%)`;
      if (spDistSafe) spDistSafe.innerText = `${safeCount} (${Math.round(pSafe)}%)`;
    }

    // 9. Generación de las Tarjetas Acordeón Desplegables de Categorías de Riesgo:
    // Vaciamos el contenedor previo para evitar duplicaciones acumuladas:
    dashboardRiskGroups.innerHTML = '';

    // Catálogo maestro de definiciones estéticas y metadatos para cada grupo:
    const categoriesDef = [
      { key: 'security', title: '1. Seguridad e Inyecciones', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>', severity: 'PRIORITARIO', severityClass: 'cat-critical' },
      { key: 'capacity', title: '2. Capacidad y Resistencia DoS', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>', severity: 'ALTO', severityClass: 'cat-high' },
      { key: 'integrity', title: '3. Integridad y Spoofing Unicode', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', severity: 'MEDIO', severityClass: 'cat-medium' },
      { key: 'format_logic', title: '4. Lógica de Negocio y Formato', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>', severity: 'MEDIO', severityClass: 'cat-medium' },
      { key: 'conforme', title: '5. Validaciones Efectivas y Conformes', icon: '<svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>', severity: 'CONFORME', severityClass: 'cat-safe' }
    ];

    // Construcción dinámica de cada tarjeta en el DOM:
    categoriesDef.forEach(catDef => {
      const items = grouped[catDef.key] || [];
      const count = items.length;

      // Si una categoría de riesgo no contiene anomalías, omitimos su renderizado
      // para mantener la interfaz limpia y concisa, salvo la categoría de casos conformes:
      if (count === 0 && catDef.key !== 'conforme') return;

      const card = document.createElement('div');
      // Las categorías con incidencias de riesgo se expanden por defecto para llamar la atención del auditor:
      const shouldAutoExpand = count > 0 && catDef.key !== 'conforme';
      card.className = `risk-category-card ${catDef.severityClass} ${shouldAutoExpand ? 'expanded' : ''}`;

      let findingsHtml = '';
      if (count === 0) {
        findingsHtml = `<div style="font-size: 10px; color: var(--text-muted); font-style: italic;">Sin incidencias registradas en esta categoría.</div>`;
      } else {
        // Iteramos los hallazgos individuales para construir su estructura visual detallada:
        items.forEach(r => {
          // Truncamos la representación visual de la carga útil si excede 55 caracteres:
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

      // Estructura HTML de la cabecera interactiva y del cuerpo colapsable:
      card.innerHTML = `
        <div class="risk-category-header" role="button" tabindex="0" aria-expanded="${shouldAutoExpand}">
          <div class="risk-cat-title-wrap">
            ${catDef.icon}
            <span>${escapeHtml(catDef.title)}</span>
          </div>
          <div class="risk-cat-badges">
            <span class="mini-tag tag-${(catDef.severity === 'PRIORITARIO' || catDef.severity === 'CRÍTICO') ? 'critical' : catDef.severity === 'ALTO' ? 'high' : catDef.severity === 'MEDIO' ? 'medium' : 'safe'}">
              ${count} ${catDef.key === 'conforme' ? 'conformes' : count === 1 ? 'incidencia' : 'incidencias'}
            </span>
            <span class="risk-cat-chevron">&#9660;</span>
          </div>
        </div>
        <div class="risk-category-body">
          ${findingsHtml}
        </div>
      `;

      // Añadimos el manejador de clic para alternar el estado expandido/colapsado (tipo acordeón):
      const header = card.querySelector('.risk-category-header');
      header.addEventListener('click', () => {
        const isExp = card.classList.toggle('expanded');
        header.setAttribute('aria-expanded', String(isExp));
      });

      // Añadimos la tarjeta construida al contenedor principal del Sidepanel:
      dashboardRiskGroups.appendChild(card);
    });

    // 10. Persistencia y Sincronización Automática con la Pestaña Standalone del Dashboard:
    // Extraemos la estructura completa y la guardamos en chrome.storage.local para que
    // cualquier pestaña abierta de dashboard.html pueda reflejar inmediatamente los datos:
    const structuredData = getStructuredAuditData();
    if (structuredData && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ qa_audit_dashboard_data: structuredData });
    }
  }

  // ============================================================================
  // FUNCIÓN: resetDashboardState
  // ============================================================================
  // PROPÓSITO:
  // Restablecer por completo el estado visual y de memoria del Dashboard analítico.
  // Se invoca cuando el usuario limpia los resultados de las pruebas o reinicia la
  // extensión, asegurando que no queden datos obsoletos en pantalla ni en almacenamiento.
  //
  // PARÁMETROS: Ninguno.
  // RETORNO: Ninguno. Modifica el DOM y limpia chrome.storage.local.
  // ============================================================================
  function resetDashboardState() {
    // 1. Regresamos la vista activa a la modalidad de Tabla tradicional:
    switchResultsView('table');

    // 2. Eliminamos los datos serializados persistentes del almacenamiento local de Chrome:
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove(['qa_audit_dashboard_data']);
    }

    // 3. Vaciamos las tarjetas de hallazgos del contenedor de grupos de riesgo:
    if (dashboardRiskGroups) dashboardRiskGroups.innerHTML = '';

    // 4. Reiniciamos el ancho de todos los segmentos de la barra de distribución a 0%:
    if (dashboardDistBar) {
      dashboardDistBar.querySelectorAll('.dist-seg').forEach(s => s.style.width = '0%');
    }

    // 5. Restablecemos el indicador numérico del puntaje a su valor por defecto:
    if (dashboardScoreVal) dashboardScoreVal.innerText = '--%';

    // 6. Restablecemos la insignia de severidad al estado inactivo:
    if (dashboardRiskLevelBadge) {
      dashboardRiskLevelBadge.className = 'badge badge-idle';
      dashboardRiskLevelBadge.innerText = 'Sin pruebas';
    }

    // 7. Reiniciamos los contadores numéricos de las tarjetas de métricas:
    if (statCriticalCount) statCriticalCount.innerText = '0 Prioritarios';
    if (statHighCount) statHighCount.innerText = '0 Altos';
    if (statMediumCount) statMediumCount.innerText = '0 Medios';
    if (statSafeCount) statSafeCount.innerText = '0 Conformes';

    // 8. Restablecemos el mensaje orientativo inferior del Dashboard:
    if (dashboardSummaryMsg) {
      dashboardSummaryMsg.innerText = 'Inicia las pruebas para ver el análisis de riesgo estructurado.';
    }

    // 9. Devolvemos el color del borde del círculo del puntaje al color primario neutro:
    if (dashboardScoreVal?.parentElement) {
      dashboardScoreVal.parentElement.style.borderColor = 'var(--primary)';
    }
  }

  // ============================================================================
  // FUNCIÓN: switchResultsView
  // ============================================================================
  // PROPÓSITO:
  // Alternar dinámicamente entre la vista tabular clásica y la vista analítica Dashboard.
  // Gestiona el intercambio de clases CSS activas, accesibilidad ARIA y visibilidad
  // en el DOM mediante la propiedad style.display.
  //
  // PARÁMETROS:
  // - viewMode (string): Modo de visualización deseado ('table' o 'dashboard').
  // RETORNO: Ninguno. Modifica directamente los estilos y atributos del DOM.
  // ============================================================================
  function switchResultsView(viewMode) {
    if (viewMode === 'dashboard') {
      // Caso A: Activación de la vista Dashboard analítica:
      if (btnViewTable) {
        btnViewTable.classList.remove('active');
        btnViewTable.setAttribute('aria-selected', 'false');
      }
      if (btnViewDashboard) {
        btnViewDashboard.classList.add('active');
        btnViewDashboard.setAttribute('aria-selected', 'true');
      }
      // Ocultamos el contenedor de la tabla y mostramos el del dashboard:
      if (tableViewContainer) tableViewContainer.style.display = 'none';
      if (dashboardViewContainer) dashboardViewContainer.style.display = 'block';

      // Disparamos la generación y renderizado visual del Dashboard:
      renderDashboardView();
    } else {
      // Caso B: Activación de la vista Tabular tradicional:
      if (btnViewDashboard) {
        btnViewDashboard.classList.remove('active');
        btnViewDashboard.setAttribute('aria-selected', 'false');
      }
      if (btnViewTable) {
        btnViewTable.classList.add('active');
        btnViewTable.setAttribute('aria-selected', 'true');
      }
      // Ocultamos el contenedor del dashboard y mostramos el de la tabla:
      if (dashboardViewContainer) dashboardViewContainer.style.display = 'none';
      if (tableViewContainer) tableViewContainer.style.display = 'block';

      // Aplicamos los filtros actuales de campo y severidad sobre la tabla:
      applyResultsFilter();
    }
  }

  // Asignación de escuchadores de eventos para los botones de pestañas superiores:
  if (btnViewTable) {
    btnViewTable.addEventListener('click', () => switchResultsView('table'));
  }
  if (btnViewDashboard) {
    btnViewDashboard.addEventListener('click', () => switchResultsView('dashboard'));
  }

  // ============================================================================
  // FUNCIÓN: getStructuredAuditData
  // ============================================================================
  // PROPÓSITO:
  // Motor central de estructuración y serialización de datos de la auditoría.
  // Transforma todas las pruebas ejecutadas en un objeto JSON integral y enriquecido,
  // calculando penalizaciones ponderadas, puntaje de robustez técnica, desglose
  // porcentual con un decimal y agrupaciones listas para ser consumidas por:
  // 1. La ventana independiente del Dashboard (dashboard/dashboard.html).
  // 2. El almacenamiento persistente (chrome.storage.local y localStorage).
  // 3. Los exportadores (HTML para Notion, Markdown, CSV, Imprimir PDF).
  //
  // PARÁMETROS: Ninguno (lee variables globales del Sidepanel).
  // RETORNO: Objeto estructurado completo con métricas y hallazgos, o null si no hay pruebas.
  // ============================================================================
  function getStructuredAuditData() {
    // Si no existen resultados evaluados, retornamos valor nulo:
    if (testResults.length === 0) return null;

    const total = testResults.length;
    let criticalCount = 0; // Conteo de indicadores de severidad Prioritaria
    let highCount = 0;     // Conteo de anomalías de severidad Alta
    let mediumCount = 0;   // Conteo de observaciones de severidad Media
    let safeCount = 0;     // Conteo de pruebas con comportamiento Conforme / Seguro

    // Agrupador estructurado por identificador de categoría:
    const grouped = {
      security: [],
      capacity: [],
      integrity: [],
      format_logic: [],
      conforme: []
    };

    // Clasificamos cada resultado dentro de su grupo correspondiente:
    testResults.forEach(r => {
      const cat = categorizeTestRisk(r);
      const catKey = (cat && cat.key) ? cat.key : 'conforme';
      if (!grouped[catKey]) {
        grouped[catKey] = [];
      }
      grouped[catKey].push(r);

      // Totalizamos según el nivel de severidad asignado:
      if (catKey === 'security') {
        criticalCount++;
      } else if (catKey === 'capacity') {
        highCount++;
      } else if (catKey === 'integrity' || catKey === 'format_logic') {
        mediumCount++;
      } else {
        safeCount++;
      }
    });

    // 1. Fórmula de Penalización Ponderada de Riesgo:
    // Se asigna un peso relativo a cada tipo de fallo según su impacto en seguridad:
    // - Fallo Prioritario (Inyecciones): 25 puntos de penalización cada uno.
    // - Fallo Alto (Desbordamiento DoS): 15 puntos de penalización cada uno.
    // - Fallo Medio (Lógica, Espacios, Unicode): 5 puntos de penalización cada uno.
    const penalty = (criticalCount * 25) + (highCount * 15) + (mediumCount * 5);

    // 2. Cálculo del Puntaje Global de Robustez:
    // Restamos la penalización proporcional del puntaje base de 100 puntos:
    // Puntaje = redondear(100 - (penalización / total) * 20).
    // Acotamos el resultado con Math.max(0, Math.min(100, ...)) para garantizar rango 0-100:
    const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / (total || 1)) * 20)));

    // 3. Determinación Cualitativa del Diagnóstico Global y Recomendación Ejecutiva:
    let overallLevel = 'Resiliencia Alta';
    let overallMessage = 'El formulario cuenta con defensas preventivas efectivas ante la mayoría de pruebas evaluadas.';
    if (criticalCount > 0) {
      overallLevel = 'Atención Prioritaria';
      overallMessage = 'Se identificaron señales de omisión de filtrado en la capa de entrada ante vectores potenciales de inyección.';
    } else if (highCount > 0) {
      overallLevel = 'Capacidad y Búfer';
      overallMessage = 'El formulario admitió entradas masivas sin atributo maxlength preventivo ni control de longitud.';
    } else if (mediumCount > 0) {
      overallLevel = 'Observaciones Leves';
      overallMessage = 'Se observaron inconsistencias en recorte de espacios, sintaxis o reglas de formato.';
    }

    // 4. Cálculo de Porcentajes Relativos formateados con un dígito decimal:
    const pCrit = total > 0 ? Number(((criticalCount / total) * 100).toFixed(1)) : 0;
    const pHigh = total > 0 ? Number(((highCount / total) * 100).toFixed(1)) : 0;
    const pMed = total > 0 ? Number(((mediumCount / total) * 100).toFixed(1)) : 0;
    const pSafe = total > 0 ? Number(((safeCount / total) * 100).toFixed(1)) : 0;

    // 5. Definición Maestra de Metadatos de Categorías para el Dashboard y Reportes:
    const categoriesDef = [
      { key: 'security', title: '1. Seguridad e Inyecciones', desc: 'Indicadores de entrada: falta de filtrado ante vectores potenciales de XSS, inyección SQL, terminación nula o esquemas ejecutables.', severity: 'PRIORITARIO', color: '#f87171', borderLeft: '#f87171' },
      { key: 'capacity', title: '2. Capacidad y Resistencia de Búfer', desc: 'Sobrecargas masivas de texto y URLs de longitud excesiva sin límite maxlength preventivo.', severity: 'ALTO', color: '#fb7185', borderLeft: '#fb7185' },
      { key: 'integrity', title: '3. Integridad y Spoofing Unicode', desc: 'Caracteres invisibles de ancho cero, secuencias compuestas y evasión de filtros.', severity: 'MEDIO', color: '#fbbf24', borderLeft: '#fbbf24' },
      { key: 'format_logic', title: '4. Integridad y Lógica de Formato', desc: 'Recorte de espacios, validación numérica, calendarios y sintaxis RFC.', severity: 'MEDIO', color: '#fbbf24', borderLeft: '#fbbf24' },
      { key: 'conforme', title: '5. Validaciones Efectivas y Conformes', desc: 'Casos rechazados con éxito por el validador, truncados por límite o datos conformes.', severity: 'CONFORME', color: '#34d399', borderLeft: '#34d399' }
    ];

    // 6. Retorno del objeto JSON integral con el esquema unificado de auditoría:
    return {
      formulario: (inputFormTitle?.value?.trim() || activeFormTitle || 'Formulario Principal'),
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
      // Mapeo detallado de hallazgos por cada categoría taxonómica:
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
      // Mapeo plano de todos los resultados con su categoría asociada:
      resultados: testResults.map(r => {
        const cat = categorizeTestRisk(r);
        return {
          fieldName: r.fieldName,
          fieldType: r.fieldType,
          testName: r.testItem?.name || 'Prueba',
          input: r.input,
          badgeText: r.badgeText,
          badgeClass: r.badgeClass,
          status: r.status,
          categoryKey: (cat && cat.key) ? cat.key : 'conforme',
          detail: r.detail,
          recommendation: r.recommendation
        };
      })
    };
  }

  // ============================================================================
  // BOTÓN: btnOpenDashboard (Generador y Lanzador de Ventana Standalone)
  // ============================================================================
  // PROPÓSITO:
  // Abrir el Dashboard en una pestaña independiente a pantalla completa.
  // Permite una visualización amplia, interactiva y desacoplada del panel lateral,
  // facilitando la presentación ejecutiva de resultados a stakeholders y desarrolladores.
  // ============================================================================
  if (btnOpenDashboard) {
    btnOpenDashboard.addEventListener('click', async () => {
      // 1. Verificamos que existan resultados para auditar:
      if (testResults.length === 0) {
        alert('No hay resultados para mostrar en el Dashboard. Inicia la verificación de campos primero.');
        return;
      }

      try {
        // 2. Obtenemos el esquema de datos estructurado completo:
        const auditData = getStructuredAuditData();

        // 3. Persistimos los datos en el almacenamiento local de la extensión (chrome.storage.local):
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ qa_audit_dashboard_data: auditData });
        }

        // 4. Guardamos también en localStorage como mecanismo redundante de respaldo:
        try {
          localStorage.setItem('qa_audit_dashboard_data', JSON.stringify(auditData));
        } catch (e) {}

        // 5. Construimos la URL canónica absoluta del recurso HTML de la extensión:
        const dashboardUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('dashboard/dashboard.html')
          : 'dashboard/dashboard.html';

        // 6. Apertura de la pestaña mediante la API nativa de Chrome o ventana web:
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          chrome.tabs.create({ url: dashboardUrl }, () => {
            // Si la API tabs arroja un error inesperado, recurrimos a window.open:
            if (chrome.runtime.lastError) {
              window.open(dashboardUrl, '_blank');
            }
          });
        } else {
          // Entorno estándar sin API de pestañas de Chrome:
          window.open(dashboardUrl, '_blank');
        }
      } catch (err) {
        // Registro y notificación de cualquier fallo en la invocación:
        console.error('Error al abrir dashboard:', err);
        alert('Error al abrir el dashboard: ' + err.message);
      }
    });
  }


  // ============================================================================
  // MOTOR DE EXPORTACIONES MULTIFORMATO
  // ============================================================================
  // Ofrece 4 mecanismos de extracción y difusión de los resultados de la auditoría:
  // 1. Exportación enriquecida a Portapapeles para Notion (HTML nativo + texto plano).
  // 2. Exportación a Markdown estándar GitHub Flavored (GFM).
  // 3. Exportación a archivo CSV con cabecera BOM UTF-8 y codificación RFC 4180.
  // 4. Reporte imprimible / Generación de PDF profesional mediante el Dashboard.
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. EXPORTADOR A NOTION (TABLA NATIVA EN PORTAPAPELES)
  // ----------------------------------------------------------------------------
  btnCopyNotion.addEventListener('click', async () => {
    // Verificamos previamente si existen resultados disponibles para exportar:
    if (testResults.length === 0) {
      alert('No hay resultados para copiar.');
      return;
    }

    // Título descriptivo para la cabecera del reporte:
    const formTitleDisplay = (inputFormTitle?.value?.trim() || activeFormTitle || 'Formulario Principal');

    // Construcción de la tabla HTML enriquecida que Notion, Word y Google Docs
    // reconocen e interpretan automáticamente al momento de pegar con Ctrl + V:
    let htmlTable = `<p><strong>Formulario:</strong> ${escapeHtml(formTitleDisplay)} &bull; <strong>Fecha:</strong> ${escapeHtml(new Date().toLocaleString())}</p><table><thead><tr>`;
    htmlTable += `<th>Campo</th>`;
    htmlTable += `<th>Tipo</th>`;
    htmlTable += `<th>Prueba / Input</th>`;
    htmlTable += `<th>Resultado</th>`;
    htmlTable += `<th>Detalle del Sitio</th>`;
    htmlTable += `<th>Recomendación</th>`;
    htmlTable += `</tr></thead><tbody>`;

    // Generamos las filas de datos recorriendo los resultados evaluados:
    testResults.forEach(r => {
      // Limitamos visualmente el tamaño del texto para preservar la estética de la tabla:
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

    // Formato de texto plano separado por tabulaciones (\t) como respaldo para editores simples:
    let plainText = `Formulario: ${formTitleDisplay}\nFecha: ${new Date().toLocaleString()}\n\nCampo\tTipo\tPrueba / Input\tResultado\tDetalle\tRecomendación\n`;
    testResults.forEach(r => {
      plainText += `${r.fieldName}\t${r.fieldType}\t${r.testItem.name} (${r.input})\t${r.badgeText}\t${r.detail}\t${r.recommendation}\n`;
    });

    try {
      // Creamos dos objetos Blob con sus tipos MIME correspondientes:
      const blobHtml = new Blob([htmlTable], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });

      // Instanciamos el ClipboardItem con soporte dual para texto enriquecido y texto plano:
      const clipboardItem = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });

      // Escribimos el objeto al portapapeles global del sistema operativo:
      await navigator.clipboard.write([clipboardItem]);
      alert('¡Tabla formateada copiada con éxito!\n\nVe a tu página en NOTION y presiona Ctrl + V para pegarla como tabla.');
    } catch (err) {
      // Manejo de contingencia si el navegador bloquea ClipboardItem por directivas de seguridad:
      console.warn('ClipboardItem error, fallback to plain text copy:', err);
      try {
        await navigator.clipboard.writeText(plainText);
        alert('Tabla copiada al portapapeles. Puedes pegarla en Notion con Ctrl + V.');
      } catch (e) {
        // En caso extremo, mostramos un diálogo modal para copia manual:
        prompt('Copia manualmente:', plainText);
      }
    }
  });

  // ----------------------------------------------------------------------------
  // 2. EXPORTADOR A MARKDOWN (GFM - GITHUB FLAVORED MARKDOWN)
  // ----------------------------------------------------------------------------
  btnCopyMarkdown.addEventListener('click', async () => {
    // Comprobamos la existencia de resultados previos:
    if (testResults.length === 0) {
      alert('No hay resultados para copiar.');
      return;
    }

    const formTitleDisplay = (inputFormTitle?.value?.trim() || activeFormTitle || 'Formulario Principal');

    // Construcción de la cabecera del documento Markdown:
    let md = `## Reporte de Validación Multi-Campo Web\n\n`;
    md += `**Formulario:** ${formTitleDisplay}\n`;
    md += `**Campos auditados:** ${selectedFields.map(f => f.label).join(', ')}\n`;
    md += `**Botón Guardar:** ${currentSaveButton ? (currentSaveButton.text || currentSaveButton.value) : 'Envío nativo / No asignado'}\n`;
    md += `**Fecha:** ${new Date().toLocaleString()}\n\n`;

    // Encabezado de la tabla con delimitadores de columnas estilo GFM:
    md += `| Campo | Tipo | Input / Prueba | Resultado | Detalle Observado | Recomendación |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    // Iteramos cada prueba escapando los caracteres de pleca vertical (|)
    // para evitar que rompan la estructura de las columnas en Markdown:
    testResults.forEach(r => {
      const safeInput = r.input.length > 30 ? r.input.slice(0, 27) + '...' : r.input;
      const cleanInput = safeInput.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const cleanDetail = r.detail.replace(/\|/g, '\\|');
      const cleanRec = r.recommendation.replace(/\|/g, '\\|');
      md += `| ${r.fieldName} | ${r.fieldType} | **${r.testItem.name}**: \`${cleanInput}\` | ${r.badgeText} | ${cleanDetail} | ${cleanRec} |\n`;
    });

    try {
      // Escribimos la cadena Markdown directamente en el portapapeles del sistema:
      await navigator.clipboard.writeText(md);
      alert('¡Tabla en formato Markdown copiada al portapapeles!');
    } catch (e) {
      // Respaldo manual ante bloqueo de permisos:
      prompt('Copia manualmente:', md);
    }
  });

  // ----------------------------------------------------------------------------
  // 3. EXPORTADOR A ARCHIVO CSV (COMPATIBLE EXCEL Y RFC 4180)
  // ----------------------------------------------------------------------------
  btnExportCsv.addEventListener('click', () => {
    // Comprobamos la disponibilidad de resultados:
    if (testResults.length === 0) {
      alert('No hay resultados para exportar.');
      return;
    }

    const formTitleDisplay = (inputFormTitle?.value?.trim() || activeFormTitle || 'Formulario Principal');

    // Nombres de las columnas del archivo CSV:
    const headers = ['Formulario', 'Campo', 'Tipo de Campo', 'Prueba', 'Input Probado', 'Resultado', 'Detalle del Sitio', 'Recomendación'];

    // Transformamos cada resultado en un registro con campos entrecomillados.
    // Según el estándar RFC 4180, si un valor contiene comillas dobles ("),
    // estas deben ser escapadas duplicándolas (""):
    const rows = testResults.map(r => [
      `"${formTitleDisplay.replace(/"/g, '""')}"`,
      `"${r.fieldName.replace(/"/g, '""')}"`,
      `"${(r.fieldType || '').replace(/"/g, '""')}"`,
      `"${r.testItem.name.replace(/"/g, '""')}"`,
      `"${r.input.replace(/"/g, '""').replace(/\n/g, '\\n')}"`,
      `"${r.badgeText.replace(/"/g, '""')}"`,
      `"${r.detail.replace(/"/g, '""')}"`,
      `"${r.recommendation.replace(/"/g, '""')}"`
    ]);

    // PREFIJO BOM (Byte Order Mark) UTF-8 (\uFEFF):
    // Garantiza que Microsoft Excel en Windows abra el archivo interpretando
    // correctamente tildes, letras ñ y caracteres especiales sin deformaciones.
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');

    // Creamos el archivo en memoria como un Blob:
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Creamos un elemento <a> invisible para detonar la descarga automática:
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_qa_multicampo_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();

    // Limpieza de recursos en el DOM y liberación de la URL en memoria:
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // ----------------------------------------------------------------------------
  // 4. INFORME IMPRIMIBLE Y GENERACIÓN DE PDF PROFESIONAL
  // ----------------------------------------------------------------------------
  btnPrintReport.addEventListener('click', async () => {
    // Validación previa de resultados:
    if (testResults.length === 0) {
      alert('No hay resultados para imprimir.');
      return;
    }

    try {
      // Sincronizamos los datos estructurados en el almacenamiento de Chrome:
      const auditData = getStructuredAuditData();
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ qa_audit_dashboard_data: auditData });
      }
      try {
        localStorage.setItem('qa_audit_dashboard_data', JSON.stringify(auditData));
      } catch (e) {}

      // Generamos la URL con el parámetro 'autoPrint=true' para que el Dashboard
      // abra de forma automática el cuadro de diálogo de impresión del navegador:
      const reportUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('dashboard/dashboard.html?autoPrint=true')
        : 'dashboard/dashboard.html?autoPrint=true';

      // Apertura de la pestaña a través de las APIs de Chrome:
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: reportUrl }, () => {
          if (chrome.runtime.lastError) {
            window.open(reportUrl, '_blank');
          }
        });
      } else {
        window.open(reportUrl, '_blank');
      }
    } catch (err) {
      console.error('Error al abrir informe:', err);
      alert('Error al abrir el informe: ' + err.message);
    }
  });

  // ----------------------------------------------------------------------------
  // 5. APERTURA SEGURA DE TÉRMINOS Y CONDICIONES DE USO
  // ----------------------------------------------------------------------------
  function openTermsAndConditions() {
    try {
      const termsUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('dashboard/terms.html')
        : '../dashboard/terms.html';

      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: termsUrl }, () => {
          if (chrome.runtime.lastError) {
            window.open(termsUrl, '_blank');
          }
        });
      } else {
        window.open(termsUrl, '_blank');
      }
    } catch (err) {
      console.error('Error al abrir términos y condiciones:', err);
    }
  }

  if (linkSidepanelTerms) {
    linkSidepanelTerms.addEventListener('click', (e) => {
      e.preventDefault();
      openTermsAndConditions();
    });
  }

  if (btnHeaderTerms) {
    btnHeaderTerms.addEventListener('click', (e) => {
      e.preventDefault();
      openTermsAndConditions();
    });
  }

  // ============================================================================
  // GESTIÓN DE MODALES Y ACCESIBILIDAD (FOCUS TRAPPING WCAG 2.1)
  // ============================================================================
  // Variable de estado que almacena una referencia al elemento HTML que tenía
  // el foco antes de abrir un cuadro modal. Esto permite restaurar la navegación
  // por teclado exactamente donde el usuario la dejó al momento de cerrar el modal:
  let lastFocusedElement = null;

  // ----------------------------------------------------------------------------
  // FUNCIÓN: trapFocus
  // ----------------------------------------------------------------------------
  // PROPÓSITO:
  // Implementar el patrón de accesibilidad "Focus Trap" requerido por los estándares
  // WCAG 2.1 (Web Content Accessibility Guidelines). Impide que la navegación
  // por teclado (tecla Tab) escape del modal abierto hacia el fondo de la página,
  // creando un ciclo cerrado entre el primer y último elemento interactivo del diálogo.
  //
  // PARÁMETROS:
  // - modalEl (HTMLElement): Elemento contenedor del diálogo modal.
  // - e (KeyboardEvent): Evento de pulsación de tecla emitido por el navegador.
  // RETORNO: Ninguno. Modifica el foco del cursor e intercepta la acción por defecto.
  // ----------------------------------------------------------------------------
  function trapFocus(modalEl, e) {
    // Si la tecla presionada no es 'Tab', no interferimos en el flujo normal:
    if (e.key !== 'Tab') return;

    // Obtenemos todos los elementos interactivos enfocables del modal que no estén deshabilitados:
    const focusable = Array.from(modalEl.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled);
    if (focusable.length === 0) return;

    const first = focusable[0]; // Primer elemento interactivo del modal
    const last = focusable[focusable.length - 1]; // Último elemento interactivo del modal

    // Si el usuario presiona Shift + Tab (navegación hacia atrás) y está en el primer elemento:
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); // Prevenimos que el foco salte fuera del diálogo
      last.focus();      // Movemos el cursor al último elemento enfocado
    }
    // Si el usuario presiona Tab simple (navegación hacia adelante) y está en el último elemento:
    else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); // Prevenimos la salida del modal
      first.focus();     // Movemos el cursor de regreso al primer elemento
    }
  }

  // ----------------------------------------------------------------------------
  // ESCUCHADOR GLOBAL DE TECLADO: TECLA ESCAPE
  // ----------------------------------------------------------------------------
  // Permite cerrar cualquier diálogo modal activo al presionar la tecla física 'Escape',
  // cumpliendo con el criterio de disipación accesible de contenido superpuesto:
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (customModal && customModal.style.display === 'flex') {
        closeCustomModal();
      } else if (payloadViewerModal && payloadViewerModal.style.display === 'flex') {
        closeViewerModal();
      }
    }
  });

  // ----------------------------------------------------------------------------
  // MODAL DE CREACIÓN DE PRUEBAS PERSONALIZADAS (CUSTOM PAYLOAD)
  // ----------------------------------------------------------------------------
  // Abre el modal para que el usuario defina sus propias cargas útiles de auditoría:
  function openCustomModal() {
    lastFocusedElement = document.activeElement; // Guardamos el elemento activo previo
    customName.value = '';                      // Limpiamos el nombre de la prueba
    customValue.value = '';                     // Limpiamos el valor de entrada
    customDesc.value = '';                      // Limpiamos la descripción explicativa
    customIsInvalid.checked = true;             // Marcamos por defecto como caso inválido
    customModal.style.display = 'flex';         // Hacemos visible el modal superpuesto
    customName.focus();                         // Dirigimos el foco al primer campo de texto
  }

  // Cierra el modal y devuelve el foco al elemento que detonó su apertura:
  function closeCustomModal() {
    customModal.style.display = 'none';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  // Asignamos los escuchadores para el ciclo de vida del modal de pruebas custom:
  customModal.addEventListener('keydown', (e) => trapFocus(customModal, e));
  btnOpenCustomModal.addEventListener('click', openCustomModal);
  btnCloseModal.addEventListener('click', closeCustomModal);
  btnCancelCustom.addEventListener('click', closeCustomModal);

  // BOTÓN: btnSaveCustom (Guardado y Persistencia de Prueba Personalizada)
  btnSaveCustom.addEventListener('click', async () => {
    // Obtenemos y saneamos las entradas del formulario modal:
    const name = customName.value.trim();
    const val = customValue.value;
    const cat = customCategory.value;
    const desc = customDesc.value.trim() || (val === '' ? 'Cadena vacía' : (val.trim() === '' ? 'Espacios en blanco' : 'Prueba personalizada'));
    const isInv = customIsInvalid.checked;

    // Validación de campos requeridos indispensables (SEC2-H11):
    if (!name) {
      alert('Por favor ingresa un nombre para la prueba personalizada.');
      return;
    }
    if (val === undefined || val === null) {
      alert('Por favor especifica un valor de entrada para la prueba.');
      return;
    }

    // Construcción del nuevo objeto payload personalizado:
    const newPayload = {
      id: `custom_${Date.now()}`, // Identificador único temporal
      category: cat,
      name: name,
      payload: val,
      desc: desc,
      isInvalidCase: isInv,
      isCustom: true,
      selected: true
    };

    // Agregamos al arreglo de pruebas personalizadas:
    customPayloads.push(newPayload);

    // Persistimos en chrome.storage.local:
    await saveCustomPayloads();

    // Cerramos el modal:
    closeCustomModal();

    // Re-renderizamos la lista de pruebas para reflejar la nueva entrada:
    renderPayloads();
  });

  // ----------------------------------------------------------------------------
  // MODAL VISOR DE PAYLOADS EXTENSOS (VIEWER MODAL)
  // ----------------------------------------------------------------------------
  // Permite inspeccionar en detalle contenidos extensos (cargas útiles masivas, XSS
  // largos, secuencias Unicode complejas) sin desbordar el diseño del panel:
  function showViewerModal(title, content) {
    lastFocusedElement = document.activeElement;
    viewerTitle.innerText = title;
    viewerContent.innerText = content;
    payloadViewerModal.style.display = 'flex';
    btnCloseViewer.focus();
  }

  // Cierra el visor y restituye el foco del cursor:
  function closeViewerModal() {
    payloadViewerModal.style.display = 'none';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  // Escuchadores de eventos para el visor modal:
  payloadViewerModal.addEventListener('keydown', (e) => trapFocus(payloadViewerModal, e));
  btnCloseViewer.addEventListener('click', closeViewerModal);
  btnDismissViewer.addEventListener('click', closeViewerModal);

  // Copia el contenido exhibido en el visor directamente al portapapeles:
  btnCopyViewer.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(viewerContent.innerText);
      alert('¡Valor copiado al portapapeles!');
    } catch {
      prompt('Copia manualmente:', viewerContent.innerText);
    }
  });

  // ----------------------------------------------------------------------------
  // MODAL DE CONFIRMACIÓN PREVIA DE AUDITORÍA (CONFIRM RUN MODAL)
  // ----------------------------------------------------------------------------
  if (confirmRunModal) {
    confirmRunModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeConfirmRunModal();
        return;
      }
      trapFocus(confirmRunModal, e);
    });
    confirmRunModal.addEventListener('click', (e) => {
      if (e.target === confirmRunModal) closeConfirmRunModal();
    });
  }
  if (btnCloseConfirmModal) btnCloseConfirmModal.addEventListener('click', closeConfirmRunModal);
  if (btnCancelConfirmModal) btnCancelConfirmModal.addEventListener('click', closeConfirmRunModal);
  if (btnProceedConfirmModal) {
    btnProceedConfirmModal.addEventListener('click', async () => {
      if (!pendingTestQueue || pendingTestQueue.length === 0) {
        closeConfirmRunModal();
        return;
      }
      const queueToRun = pendingTestQueue;
      closeConfirmRunModal();
      await executeTestQueue(queueToRun);
    });
  }

  // ----------------------------------------------------------------------------
  // MODAL DE CONFIRMACIÓN DE DETENCIÓN DE PRUEBAS (CONFIRM STOP MODAL)
  // ----------------------------------------------------------------------------
  if (confirmStopModal) {
    confirmStopModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        resumeExecutionFromStop();
        return;
      }
      trapFocus(confirmStopModal, e);
    });
    confirmStopModal.addEventListener('click', (e) => {
      if (e.target === confirmStopModal) resumeExecutionFromStop();
    });
  }
  if (btnCloseConfirmStopModal) btnCloseConfirmStopModal.addEventListener('click', resumeExecutionFromStop);
  if (btnResumeFromStopModal) btnResumeFromStopModal.addEventListener('click', resumeExecutionFromStop);
  if (btnProceedStopModal) btnProceedStopModal.addEventListener('click', proceedStopExecution);

  // ============================================================================
  // FUNCIÓN UTILITARIA: escapeHtml
  // ============================================================================
  // PROPÓSITO:
  // Mitigar riesgos de Cross-Site Scripting (XSS) y corrupción visual del DOM.
  // Convierte caracteres especiales de sintaxis HTML en sus entidades mnemotécnicas
  // seguras antes de interpolarlos en cadenas innerHTML.
  //
  // PARÁMETROS:
  // - str (string|any): Cadena de texto potencialmente insegura o valor primitivo.
  // RETORNO: (string) Cadena higienizada apta para renderizado seguro en el DOM.
  // ============================================================================
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')   // Reemplaza ampersand (&)
      .replace(/</g, '&lt;')    // Reemplaza menor que (<)
      .replace(/>/g, '&gt;')    // Reemplaza mayor que (>)
      .replace(/"/g, '&quot;')  // Reemplaza comillas dobles (")
      .replace(/'/g, '&#039;'); // Reemplaza comillas simples (')
  }

  // ============================================================================
  // SECUENCIA DE ARRANQUE INICIAL (BOOTSTRAPPING DEL SIDEPANEL)
  // ============================================================================
  // 1. Carga las pruebas personalizadas guardadas previamente en chrome.storage.local:
  await loadCustomPayloads();

  // 2. Establece el nivel de profundidad de auditoría por defecto ('normal'):
  applyDepthTier('normal');

  // 3. Renderiza la lista inicial de campos seleccionados (o estado vacío):
  renderSelectedFields();
});
