# QA Form Field Validator

Extensión para **Microsoft Edge**, **Brave** y **Google Chrome** diseñada para automatizar pruebas de validación de campos web, detección de formularios múltiples, auditoría en doble fase (campo y acción de guardado) y exportación de reportes técnicos de calidad.

---

## Módulos y Capacidades

- **Multi-campo y detección automática:** Detección automática de formularios y sectores interactivos o selección asistida mediante puntero.
- **Niveles de profundidad configurables:** 
  - **Simple:** Verificación ágil de casos críticos (~10 pruebas).
  - **Normal:** Cobertura estándar equilibrada (~23 pruebas).
  - **Avanzado:** Auditoría rigurosa de calidad y seguridad (~34 pruebas).
  - **Total:** Batería exhaustiva de validación (~41 pruebas).
- **Auditoría de guardado en doble fase:** Prueba el comportamiento tanto a nivel de captura del campo como al activar el botón de guardado/envío, reconociendo errores de servidor, banners flotantes y mensajes nativos HTML5.
- **Auto-recuperación para formularios desplegables:** Grabación y ejecución automática de pasos de apertura (drawers, modales y acordeones) antes de cada prueba.
- **Valores válidos aleatorios para campos obligatorios:** Relleno inteligente de campos hermanos para evitar falsos rechazos por campos requeridos adyacentes.
- **Suites de prueba integradas:**
  - Texto y Longitud (límites de caracteres, cadenas extensas, recortes y espacios)
  - Unicode y Símbolos (caracteres multi-byte, alfabetos internacionales, acentos y signos)
  - Números (enteros, negativos, flotantes, notación científica y validación estricta)
  - Fechas (formatos ISO, fechas no bisiestas, meses fuera de rango y fechas límite)
  - Seguridad e Inyección (vectores XSS, etiquetas script, etiquetas de imagen y payloads SQL básicos)
  - Personalizados (grabador local persistente de casos propios)
- **Exportación y reportes:**
  - Exportación a Notion (integración directa vía API)
  - Descarga CSV para hojas de cálculo
  - Copia de tabla formateada en Markdown
  - Generador de informe formal imprimible en PDF

---

## Instalación

### Microsoft Edge
1. Navega a `edge://extensions` en la barra de direcciones.
2. Activa el interruptor **Modo de desarrollador** en la barra lateral.
3. Haz clic en **Cargar extensión sin empaquetar**.
4. Selecciona el directorio raíz del repositorio:
   ```
   C:\Users\tela2\.gemini\antigravity\scratch\qa-form-validator
   ```
5. *(Recomendado)* Fija el icono en la barra de herramientas para acceso rápido.

### Brave / Google Chrome
1. Navega a `brave://extensions` o `chrome://extensions`.
2. Activa la casilla **Modo de desarrollador** en la esquina superior derecha.
3. Haz clic en **Cargar descomprimida**.
4. Selecciona el directorio raíz del repositorio:
   ```
   C:\Users\tela2\.gemini\antigravity\scratch\qa-form-validator
   ```
5. *(Recomendado)* Fija el icono en la barra de herramientas.

---

## Flujo de Trabajo

1. **Apertura:** Abre cualquier sitio web y haz clic en el icono de la barra de herramientas para desplegar el Panel Lateral (*Side Panel*).
2. **Definición del formulario:** 
   - Haz clic en **Detectar formularios** para mapear los inputs de la página de forma automática, o bien usa **Apuntar sector** o **Añadir campo** para selección puntual.
   - Si el formulario se encuentra dentro de un modal o panel desplegable que se cierra tras guardar, activa la opción de apertura automática y agrega los pasos de clic correspondientes.
3. **Configuración de campos obligatorios:**
   - Si el formulario requiere datos específicos en campos secundarios (por ejemplo, teléfonos de 10 dígitos o campos marcados como obligatorios), define o genera valores aleatorios válidos para asegurar que la validación del campo auditado no sufra bloqueos colaterales.
4. **Selección de pruebas:**
   - Selecciona el nivel de profundidad deseado (*Simple*, *Normal*, *Avanzado*, *Total*) o filtra por categoría (*Texto*, *Unicode*, *Números*, *Fechas*, *Seguridad*, *Propios*).
5. **Ejecución:**
   - Haz clic en **Iniciar Verificación**. La extensión aplicará los casos secuencialmente registrando el estado del DOM y la respuesta de guardado.
6. **Revisión de Resultados:**
   - **Restringido:** El formulario bloqueó el valor inválido correctamente.
   - **Truncado:** El valor fue recortado según el atributo o máscara configurada.
   - **Conforme:** Entrada válida admitida y procesada correctamente.
   - **Riesgo:** Valor anómalo o inválido admitido sin restricción ni advertencia.
7. **Exportación:**
   - Genera informes en Notion, Markdown, CSV o vista de impresión formal PDF.

---

## Entorno de Pruebas Incluido

El repositorio incluye el archivo `test-sample.html` diseñado para comprobar de manera inmediata:
- Validación estricta de teléfonos de 10 dígitos y campos obligatorios secundarios.
- Formularios múltiples en la misma página.
- Formularios en paneles desplegables (*drawers*) que se cierran al guardar.
