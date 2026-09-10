# 🎯 QA Form Field Validator

Extensión para **Microsoft Edge**, **Brave** y **Google Chrome** diseñada para automatizar las pruebas de validación de campos web (texto, números, fechas, emojis, longitud excesiva e inyecciones), detectar restricciones del sitio y generar reportes con recomendaciones de calidad.

---

## 🚀 Cómo instalar la extensión

### En Microsoft Edge:
1. Abre Microsoft Edge y ve a la barra de direcciones: `edge://extensions`
2. En la barra lateral izquierda, activa el interruptor **"Modo de desarrollador"** (Developer mode).
3. Haz clic en el botón **"Cargar extensión sin empaquetar"** (Load unpacked).
4. Selecciona la carpeta donde se encuentra este proyecto:
   ```
   C:\Users\tela2\.gemini\antigravity\scratch\qa-form-validator
   ```
5. *(Opcional)* Haz clic en el icono de extensiones (el rompecabezas) en la barra de herramientas y fija (pin) **QA Form Field Validator** para tenerlo siempre a la mano.

### En Brave:
1. Abre Brave y escribe en la barra de direcciones: `brave://extensions`
2. En la esquina superior derecha, activa el interruptor **"Modo de desarrollador"**.
3. Haz clic en el botón **"Cargar descomprimida"**.
4. Selecciona la misma carpeta:
   ```
   C:\Users\tela2\.gemini\antigravity\scratch\qa-form-validator
   ```
5. *(Opcional)* Fija el icono en la barra de herramientas de Brave.

---

## 📋 Guía de Uso Paso a Paso

### 1. Abrir la herramienta
- Navega a cualquier sitio web que desees probar (o abre el archivo [`test-sample.html`](test-sample.html) incluido en la carpeta para realizar una prueba inmediata).
- Haz clic en el icono de la extensión en la barra superior. Se abrirá automáticamente el **Panel Lateral (Side Panel)** en el navegador.

### 2. Seleccionar el campo web
- En el panel, haz clic en **"🎯 Seleccionar campo en la página"**.
- Pasa el ratón sobre la página web: verás un recuadro interactivo resaltando los campos con su etiqueta y tipo.
- Haz clic sobre el input o textarea que desees verificar.
- *Atajo rápido:* También puedes hacer clic derecho directamente sobre cualquier campo en la página y seleccionar **"🎯 Probar este campo con QA Validator"**.

### 3. Elegir o Personalizar las Pruebas
La herramienta detecta el tipo de campo y precarga la suite recomendada:
- **📝 Texto & Longitud:** Cadenas de 50, 255, 1,000 y 5,000 caracteres, espacios en blanco, caracteres invisibles Zero-width.
- **😀 Emojis & Unicode:** Emojis estándar y compuestos (ZWJ), banderas, caracteres especiales, acentos y alfabetos internacionales.
- **🔢 Números:** Enteros, negativos, decimales, notación científica, desbordamiento de bits y texto no numérico.
- **📅 Fechas:** 29 de febrero en años no bisiestos (2023-02-29), meses superiores a 12, días inexistentes (día 32) y fechas límite.
- **🛡️ Inyección / Seguridad:** Inyección de `<script>`, vectores `<img>` onerror, marcado HTML y SQL básico.
- **⚙️ Propios (Grabador de casos):** Haz clic en **"➕ Añadir Input"** para grabar y guardar tus propios valores específicos de tu negocio. Se guardan automáticamente en tu navegador.

### 4. Ejecutar la Verificación Automática
- Ajusta la velocidad si lo deseas (Normal a 150ms es ideal para ver la interacción en pantalla).
- Pulsa **"▶️ Iniciar Verificación Automática"**.
- La aplicación inyectará secuencialmente cada prueba, evaluará si el sitio aplicó restricciones (`maxlength`, recorte, filtrado, mensajes nativos HTML5 o alertas visuales) y restaurará el valor original del campo al terminar.

### 5. Analizar el Reporte y Exportar
La tabla de resultados te presenta:
- **Nombre del Campo**: Etiqueta, identificador o selector del elemento.
- **Input Probado**: Payload exacto enviado.
- **¿Restricción?**:
  - 🟢 **Restringido**: El sitio bloqueó, filtró o rechazó el valor inválido.
  - 🟡 **Truncado**: El sitio cortó la longitud al límite configurado (ej. `maxlength`).
  - 🔴 **Sin Restricción**: El sitio aceptó texto excesivo o datos anómalos sin advertencia ni filtro.
- **Detalle del Sitio**: Qué ocurrió técnicamente en el DOM.
- **Recomendación**: Sugerencia puntual de QA y desarrollo (por ejemplo, añadir `maxlength`, escapar caracteres HTML para evitar XSS o implementar validación estricta de fechas).

**Opciones de Exportación:**
- 📥 **Descargar CSV**: Para abrir en Microsoft Excel o Google Sheets.
- 📋 **Copiar Markdown**: Para pegar en Jira, Azure DevOps, GitHub Issues, Trello o Slack.
- 🖨️ **Informe Imprimible / PDF**: Genera una vista formal lista para imprimir o guardar como PDF.

---

## 🧪 Archivo de Prueba Incluido

Para verificar el funcionamiento de inmediato, abre el archivo:
```
test-sample.html
```
Contiene 6 campos con diferentes comportamientos: límites de caracteres, campos numéricos con rangos, selectores de fecha y campos con filtrado en tiempo real mediante JavaScript.
