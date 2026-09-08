# Registro de parches y sesiones

## 0.8.2 — 2026-09-08 · sesión 011

Chat de dudas dentro de IA local: el mismo modelo Qwen3 0.6B Q4 responde en español usando una guía fija escrita a mano (src/ai-help.cjs) y, si se marca, el texto del editor. No consulta inventario ni pedidos, no ejecuta acciones; respuesta en texto plano acotado, últimos 6 mensajes, un trabajo a la vez, cancelable. Se probó reforzar los prompts para proforma/abono: empeoró (7/11 frente a 10/11 en la evaluación completa), así que se conservan los prompts de 0.8.1 y queda la evaluación de 11 casos como línea base. Versión mostrada y servida desde package.json (antes literal 0.8.0 en servidor e interfaz).

72 pruebas aprobadas, ejecutable 0.8.2 reconstruido y probado con modelo real, incluido el chat. Informe reports/2026-09-08T15-51-40-496Z-chat-dudas-ia.md.

## 0.8.1 — 2026-09-08 · sesión 010

Auditoría de la entrega 0.8.0: parche de commit idéntico a 452dcc4, 69/69 pruebas y formato correctos, código de IA y documentos revisados. Mejoras mínimas: la comprobación de sumas reconoce etiquetas habituales (IVA 21%, Cuota IVA, Total/Importe a pagar) sin ampliar la interpretación; el trabajador de IA bloquea además tls, http2, dgram y dns; el nombre de la evaluación sigue la versión. Prompt maestro v2 y directriz de mejora continua en CLAUDE.md, AGENTS.md y docs/PROMPT_MAESTRO_V2.md.

70 pruebas aprobadas, ejecutable 0.8.1 reconstruido y probado con modelo real. Informe reports/2026-09-08T15-15-49-334Z-auditoria-prompt-maestro.md.

## 0.8.0 — 2026-09-08 · sesión 009

Modelo local Q4 seleccionado por evaluación; dos lecturas con abstención ante discrepancias, contraste de encabezados, proformas/abonos y sumas en céntimos. Las explicaciones generadas se descartan y se muestra únicamente el inicio del original. Al editar texto se retira el resultado anterior.

69 pruebas automatizadas aprobadas. Evaluación rápida: 2/3 clasificaciones exactas y una proforma enviada a revisión; no se oculta ese límite. Informe reports/2026-09-08T09-40-35-511Z-ia-reforzada.md.


## 0.7.0 — 2026-09-08 · sesión 008

Seguimiento reemplazado por Control de entregas: cantidades por producto, pendiente visible, siguiente paso y filtros En curso/Cerrados. Recepción guiada en unidades base.

IA Qwen3 0.6B Q8 integrada en el paquete, sin descargas al usarla. Tipo de documento propuesto y fragmento comprobado contra el original; accesos desde fotos OCR/mensajes; cancelación, límites e integridad de modelos. Resumen libre descartado por alucinaciones observadas. Sin automatizar acciones ni conectar QR en esta sesión.

Informe: reports/2026-09-08T09-22-50-015Z-entregas-ia-local.md.


## 0.6.0 — 2026-09-08 · sesión 007

Conector experimental WhatsApp Web con QR real, número conectado, chats autorizados por cuenta, historial separado y registro de cambio de número. Recepción sin envíos, adjuntos validados y copia independiente sin credenciales. Chrome incluido en D y cierre compatible con Puppeteer actualizado.

55 pruebas y QR real en ejecutable aprobados; escaneo y recepción con el teléfono del usuario pendientes. Informe: reports/2026-09-08T04-18-52-587Z-whatsapp-qr-cuentas.md.

## Diseño de WhatsApp — 2026-09-07 · sesión 006

Propuesta de bandeja exclusiva de proveedores y contactos autorizados; comparación de API oficial, QR Web no oficial y límites de recepción sin conexión. Documento docs/WHATSAPP_PROVEEDORES.md. Pendiente confirmar tipo de cuenta. Sin cambios al ejecutable 0.5 ni conexión real.

## 0.5.0 — 2026-09-07 · sesión 005

OCR español local incluido para fotos, con propuesta de proveedor confirmable y conservación de texto. Fichas con NIF/CIF, WhatsApp y alias. Identificación compartida por texto/remitente para eventos de prueba. Casos ambiguos quedan por revisar; no se modifican cantidades ni se conectan canales externos.

47 pruebas y ejecutable Windows con OCR real aprobados. PDF, WhatsApp real y Makro web pendientes. Informe: reports/2026-09-07T23-45-55-705Z-deteccion-proveedor-ocr.md.

## 0.4.0 — 2026-09-07 · sesión 004

Fotos clasificadas por proveedor/fecha y botón Organizar. Carpetas automáticas con ficha, datos e imágenes. Conservación de originales, respaldo portable y aviso recuperable si falla el archivo derivado. Textos de pedidos explican estados, tipos de producto e importes estimados.

40 pruebas y ejecutable Windows aprobados. OCR pendiente. Informe: reports/2026-09-07T23-36-54-807Z-archivo-proveedores-fotos.md.

## 0.3.0 — 2026-09-07 · sesión 003

Bandeja con búsqueda sin tildes y filtros de proveedor/estado. Relevancia independiente de prioridad, basada en referencias comprobables del mismo proveedor; correcciones con motivo y registro. Compatibilidad con mensajes anteriores y rechazo de IDs de evento reutilizados con otro contenido.

36 pruebas y flujo de escritorio con reinicio aprobados. Clasificación todavía por reglas locales; sin conexión WhatsApp ni cambios automáticos de stock/pedidos. Informe: reports/2026-09-07T22-46-07-183Z-bandeja-proveedores.md.

## 0.2.0 — 2026-09-07 · sesión 002

Migración de JSON a SQLite transaccional con copia previa y fotografías separadas. Núcleo TypeScript estricto con contratos Zod. Movimientos con motivo y corrección trazable, edición de productos/proveedores y cancelación pendiente. IDs persistentes con huella y detección de revisiones obsoletas. Escrituras incrementales sin reescribir el historial. Errores visibles dentro de los diálogos.

29 pruebas aprobadas y ejecutable Windows reconstruido y probado con reinicio. Informe: reports/2026-09-07-002-sqlite-typescript.md. Electron se conserva por la entrega comprobable; evaluar Tauri en el Mac real. No se incorporó IA ni conectores externos.

## 0.1.0 — 2026-09-07 · sesión 001

Primera entrega funcional del prototipo local. Interfaz de escritorio con resumen, inventario, compras, mensajes, proveedores, actividad y configuración. Datos de demostración persistentes, copias y fotos manuales. Pedidos simulados con recepción parcial y prevención de reintentos duplicados.

Se verificaron reglas de negocio, servidor local, ejecución Windows y persistencia tras reinicio. Se corrigieron durante la sesión icono de página ausente, legibilidad en ventanas bajas y validación de identificadores importados.

Detalles y evidencias: reports/2026-09-07-001-prototipo.md. La IA/OCR, WhatsApp, Makro y distribución Mac siguen pendientes.

Cada sesión futura debe añadir una entrada con problema, resultado, pruebas y referencia a su informe. No sobrescribir esta historia.
