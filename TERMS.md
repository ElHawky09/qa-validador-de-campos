# Términos y Condiciones de Uso, Exención de Responsabilidad y Política de Uso Ético

**QA Form Field Validator**  
*Documento Legal Corporativo de Términos de Servicio, Condiciones de Uso y Exención de Responsabilidad*  
*Última actualización: Septiembre de 2026*

---

## 1. Identificación del Titular y Ámbito de Aplicación

El presente documento establece los Términos y Condiciones de Uso (en adelante, los "Términos") que rigen el acceso, descarga, instalación, ejecución y uso de la extensión de navegador web, código fuente, scripts complementarios, interfaces, documentación y archivos asociados denominados colectivamente **QA Form Field Validator** (en adelante, el "Software").

### 1.1. Información del Mantenedor del Proyecto
- **Titular / Mantenedor:** ElHawky09 (y el equipo de desarrollo de QA Form Field Validator).
- **Repositorio Oficial:** [https://github.com/ElHawky09/qa-validador-de-campos](https://github.com/ElHawky09/qa-validador-de-campos)
- **Buzón de Contacto Legal y Regulatorio:** `hawkymfs09@proton.me`
- **Buzón de Reportes de Seguridad:** `hawkymfs09@proton.me`

### 1.2. Ámbito Subjetivo
El término "Usuario" u "Operador" designa a cualquier persona física o jurídica que descargue, instale, ejecute, configure o interactúe técnica u operativamente con el Software.

---

## 2. Aceptación de los Términos

Al acceder, descargar, instalar, habilitar o utilizar el Software de cualquier forma, el Usuario reconoce haber leído, comprendido y aceptado en su integridad las presentes condiciones, en la medida en que resulten legalmente aplicables conforme a la legislación de su jurisdicción.

Si usted no está de acuerdo con las estipulaciones aquí contenidas, o carece de la capacidad legal necesaria para obligarse a ellas, debe abstenerse de instalar, ejecutar o utilizar el Software y proceder a su desinstalación inmediata de sus dispositivos y navegadores web.

---

## 3. Naturaleza del Software y Finalidad Estrictamente Defensiva

El Software es una herramienta de ingeniería de software y control de calidad distribuida a título gratuito y bajo licencia de código abierto. Su propósito primordial consiste en asistir a ingenieros de Aseguramiento de Calidad (Quality Assurance - QA), desarrolladores web y analistas de resiliencia en la verificación técnica y validación funcional de campos de entrada web en entornos debidamente controlados.

El Software se proporciona con carácter puramente instrumental y orientativo para robustecer los mecanismos preventivos del software frente a entradas anómalas, valores límite y defectos de validación en las capas del cliente y del servidor.

### Inexistencia de Certificación Oficial de Seguridad
Los diagnósticos, métricas heurísticas de resiliencia (Score de Robustez), desgloses de riesgo y recomendaciones técnicas generados por el Software tienen un propósito analítico y orientativo. Bajo ninguna circunstancia constituyen una certificación oficial de seguridad informática, ni garantizan el cumplimiento o conformidad con estándares y normativas tales como PCI-DSS, ISO/IEC 27001, SOC 2, HIPAA, ENS, RGPD ni regulaciones análogas. El Software no sustituye revisiones manuales exhaustivas de código fuente, auditorías de arquitectura ni pruebas de penetración profesionales.

---

## 4. Principio de Autorización Previa y Uso Exclusivamente Autorizado

### 4.1. Requisito Indispensable de Autorización
Queda expresamente estipulado como condición esencial de uso que el Operador únicamente ejecutará el Software y sus vectores de prueba sobre:
1. Sistemas, aplicaciones, dominios y redes respecto de los cuales el Usuario sea el titular legítimo exclusivo.
2. Sistemas de terceros sobre los cuales el Usuario cuente con una autorización previa, expresa, formal, escrita y plenamente vigente otorgada por los titulares legítimos de los derechos de administración y seguridad.

### 4.2. Prohibición de Actividades No Autorizadas o Maliciosas
Queda terminantemente prohibido utilizar el Software para realizar escaneos no consentidos, evaluaciones de penetración sobre terceros sin autorización escrita, ataques de denegación de servicio (DoS), inyecciones destructivas en entornos de producción ajenos, explotación lesiva de vulnerabilidades o cualquier conducta susceptible de vulnerar la confidencialidad, integridad o disponibilidad de sistemas de información de terceros.

### 4.3. Deberes de Mitigación y Asunción de Riesgo Operativo
El Usuario asume de forma consciente, plena e individual los riesgos inherentes a la ejecución de pruebas dinámicas de entrada sobre aplicaciones web. El Usuario se obliga formalmente a:
- **Confinamiento en Entornos Seguros:** Realizar las auditorías única y exclusivamente en entornos de desarrollo, preproducción (*staging*) o laboratorios aislados.
- **Respaldos Previos Verificados:** Garantizar la disponibilidad y restauración verificada de copias de seguridad completas (*backups*) de bases de datos y configuraciones antes de iniciar cualquier batería de pruebas.
- **Supervisión Continua:** Monitorear en tiempo real las transacciones y peticiones emitidas hacia los servidores de destino para suspender inmediatamente las pruebas en caso de comportamiento anómalo.
- **Prohibición de Uso con Datos Reales:** Abstenerse de utilizar credenciales reales, tokens de acceso, secretos corporativos, números de tarjeta bancaria ni datos de carácter personal reales durante las pruebas; emplear exclusivamente datos y cuentas sintéticas.
- **Prevención de Efectos Irreversibles:** No ejecutar pruebas automatizadas sobre endpoints o formularios vinculados a pasarelas de pago reales, servicios de mensajería SMS facturables, o componentes transaccionales con consecuencias financieras o legales irreversibles.

---

## 5. Provisión "TAL CUAL" (AS IS) y Exclusión de Garantías

En la máxima medida permitida por la legislación aplicable:

1. **Suministro TAL CUAL:** El Software y su documentación se suministran "TAL CUAL" (*AS IS*) y "SEGÚN DISPONIBILIDAD" (*AS AVAILABLE*), sin garantías de ninguna naturaleza, explícitas, implícitas, legales o convencionales.
2. **Exclusión de Garantías Implícitas:** Los Autores y mantenedores renuncian expresamente a toda garantía implícita de comerciabilidad (*merchantability*), idoneidad para un propósito determinado (*fitness for a particular purpose*) y no infracción de derechos de terceros (*non-infringement*).
3. **Ausencia de Infalibilidad:** No se garantiza que las funciones del Software satisfagan las necesidades específicas del Usuario, que la operación sea ininterrumpida o libre de errores (*bugs*), ni que se detecten la totalidad de las vulnerabilidades o fallos de validación existentes en los formularios analizados.

Estas exclusiones se aplican en la medida máxima permitida por la legislación aplicable, sin menoscabo de aquellos derechos irrenunciables que asistan al Usuario en su jurisdicción.

---

## 6. Limitación de Responsabilidad y Cláusula de Cuantía

En la máxima medida permitida por el ordenamiento jurídico aplicable, los Autores, mantenedores, colaboradores y distribuidores del Software no serán responsables por ningún daño directo, indirecto, incidental, especial, ejemplar, punitivo o consecuencial (incluyendo lucro cesante, interrupción comercial, corrupción o pérdida de datos, degradación de disponibilidad, costos de mitigación pericial o sanciones administrativas) derivado del uso, mal uso o imposibilidad de uso del Software.

### 6.1. Limitación Monetaria Máxima
En el supuesto de que cualquier autoridad judicial o arbitral con jurisdicción vinculante determinara la existencia de responsabilidad civil imputable a los Autores derivada del Software, la responsabilidad civil acumulada y total de los Autores frente al Usuario se limitará al importe efectivamente pagado por el Usuario por el Software durante los doce (12) meses anteriores al hecho que origine la reclamación, o a una cuantía máxima nominal de diez dólares estadounidenses ($10.00 USD) en caso de que el Software haya sido obtenido y utilizado a título gratuito.

### 6.2. Salvedad General de Normas Imperativas
Nada de lo dispuesto en estos Términos pretende excluir o limitar una responsabilidad o derecho que no pueda excluirse o limitarse válidamente conforme a la legislación imperativa aplicable (incluyendo supuestos de dolo, conducta intencional, negligencia grave o derechos irrenunciables de los consumidores).

---

## 7. Régimen de Licencia y Relación con la Licencia MIT

El código fuente del Software se distribuye bajo los términos de la **Licencia MIT oficial** (consulte el archivo [LICENSE](LICENSE)).

La Licencia MIT concede expresamente amplios derechos de uso, copia, modificación, fusión, publicación, distribución, sublicenciamiento y venta de copias del Software, sujeto únicamente a la conservación del aviso de derechos de autor y de la licencia original.

Los presentes Términos regulan las condiciones de uso de la distribución oficial de la extensión, la política ética de uso autorizado y el deslinde de responsabilidades operativas. **Ninguna disposición de estos Términos tiene por objeto restringir, condicionar o revocar los derechos concedidos por la Licencia MIT sobre el código fuente.**

---

## 8. Resolución de Disputas y Acciones Colectivas

En la medida permitida por la legislación aplicable en la jurisdicción correspondiente, las controversias derivadas del uso del Software se resolverán de conformidad con los mecanismos de resolución de disputas legalmente aplicables de forma individual entre las partes, sin perjuicio de los derechos sustantivos o procesales que no puedan ser renunciados conforme a las normas imperativas de protección al consumidor o del ordenamiento público correspondiente.

---

## 9. Indemnización Acotada (Hold Harmless)

El Usuario se compromete a mantener en paz y a salvo a los Autores, desarrolladores y mantenedores del Software frente a cualquier acción legal, reclamación judicial o administrativa, pérdida, daño o gasto razonable de defensa jurídica derivado directamente de:
1. La utilización no autorizada, fraudulenta o ilícita del Software por parte del Usuario;
2. El incumplimiento demostrado de las obligaciones de autorización previa estipuladas en estos Términos;
3. La infracción de derechos de propiedad intelectual, privacidad o seguridad de sistemas de terceros cometida por el Usuario; o
4. La distribución por parte del Usuario de versiones alteradas del Software que incorporen elementos lesivos.

La presente obligación de indemnización no será exigible en la medida en que la reclamación derive de dolo o conducta imputable legalmente a los propios Autores que resulte inasegurable conforme a derecho.

---

## 10. Cumplimiento Normativo y Legislación Aplicable

El Usuario es el único responsable de conocer y cumplir todas las leyes civiles, administrativas y penales vigentes en la jurisdicción desde la cual opera y en aquellas donde se encuentren alojados los servidores, redes y bases de datos evaluados.

A título meramente orientativo e informativo, se recuerda que el acceso no autorizado o la alteración indebida de sistemas informáticos ajenos puede constituir infracción o delito bajo normativas tales como:
- **Estados Unidos:** Computer Fraud and Abuse Act (CFAA, 18 U.S.C. § 1030).
- **Unión Europea:** Directiva 2013/40/UE relativa a los ataques contra los sistemas de información.
- **Ámbito Internacional:** Convenio sobre la Ciberdelincuencia del Consejo de Europa (Convenio de Budapest, ETS No. 185).
- **Normativas Nacionales:** Códigos penales y leyes especiales de delitos informáticos en España, México, Argentina, Colombia, Chile y demás ordenamientos jurídicos aplicables.

Las referencias normativas anteriores no constituyen asesoría jurídica y se proporcionan únicamente con carácter ilustrativo sobre la importancia del consentimiento expreso y formal antes de cualquier evaluación técnica.

---

## 11. Deslinde por Modificaciones y Bifurcaciones de Terceros

Si terceras personas realizan bifurcaciones (*forks*), modificaciones, empaquetados no autorizados o incorporan el código fuente en otras herramientas fuera del repositorio oficial, los Autores originales no asumen ninguna responsabilidad, deber de soporte ni garantía respecto de dichas versiones alteradas. Corresponde al Usuario verificar la autenticidad e integridad del repositorio fuente desde donde obtiene el Software.

---

## 12. Divisibilidad y Subsistencia

1. **Divisibilidad (*Severability*):** Si cualquier disposición de estos Términos fuera declarada inválida, nula, ilegal o inoponible por una autoridad o tribunal competente, dicha nulidad afectará exclusivamente a la disposición concreta en cuestión y en el alcance mínimo necesario, conservando las demás cláusulas plena vigencia, aplicabilidad y eficacia jurídica.
2. **Subsistencia (*Survival*):** Las disposiciones relativas a la exclusión de garantías, limitación de responsabilidad, indemnización acotada y asunción de riesgo continuarán en vigor indefinidamente tras el cese de uso o desinstalación del Software.

---

## 13. Documentos Integrados y Canales de Contacto

Los presentes Términos se complementan con los siguientes instrumentos oficiales del proyecto:
- [LICENSE](LICENSE) — Licencia MIT oficial de código abierto.
- [PRIVACY.md](PRIVACY.md) — Política de privacidad y tratamiento técnico local de datos.
- [SECURITY.md](SECURITY.md) — Política de seguridad y procedimiento de divulgación coordinada.
- [README.md](README.md) — Documentación técnica, manual de usuario y arquitectura.

Para cualquier duda o comunicación formal:
- **Buzón Legal:** `hawkymfs09@proton.me`
- **Buzón de Seguridad:** `hawkymfs09@proton.me`
