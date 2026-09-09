# Registro de parches y sesiones

## 0.14.1 — 2026-09-09 · sesión 024

Sistema de diseño completo, ejecutado por un agente de diseño (Fable 5.1) con el encargo docs/PROMPT_DISENO.md: tokens en :root (paleta Mediterraneo con variantes AA, escala 12/13/14/15/18/22/32, interlineados, ritmo de 8 px, anchos de lectura, radios, sombras, alturas de control), componentes con estados, acento por pantalla, navegación de 38 px, diálogos con pie fijo, tablas legibles y estados vacíos con guía. Corregidos los solapamientos de las tarjetas de Documentos y 1.165 hallazgos de la auditoría DOM (textos < 11 px, contraste, cortes, alturas) hasta 0 en 73 vistas y 4 tamaños. Documentado en docs/DISENO_SISTEMA.md; capturas antes/después en output/design y muestras en reports/design.

110 pruebas, ejecutable 0.14.1. Informe reports/2026-09-09T16-49-51-088Z-sistema-de-diseno.md.

## 0.14.0 — 2026-09-09 · sesión 023

Documentos por proveedor: pantalla nueva con facturas, albaranes, recibos y pedidos (fotos y PDF hasta 10 MB), filtros por proveedor, sin pedido, con propuesta y PDF. Propuestas por reglas de proveedor, tipo y pedido (número de pedido en el texto; único pedido del proveedor en 60 días; importe del documento frente al estimado del pedido ±5 %) que la persona acepta con un clic; vínculo manual a cualquier pedido del proveedor y desvinculación. Los adjuntos de WhatsApp de proveedores autorizados se archivan solos con OCR local si son imágenes. Control de entregas muestra los documentos de cada pedido.

110 pruebas, ejecutable 0.14.0. Informe reports/2026-09-09T11-37-27-079Z-documentos-por-proveedor.md.

## 0.13.0 — 2026-09-09 · sesión 022

Identidad visual para la propuesta a Artello (Palma de Mallorca): paleta propia inspirada en su sabor «Mediterraneo» (pistacho, rosa, azafrán) sobre crema de casco antiguo y acero; tipografía serif en títulos; pantalla de inicio «arte + gelato» con el nombre y el lugar del negocio; nombre y lugar editables en Configuración y presentes en barra lateral, migas, pie, pedidos y exportaciones. No se usa el logotipo ni activos de la marca real: la marca visual es original.

106 pruebas, ejecutable 0.13.0. Informe reports/2026-09-09T11-26-40-250Z-identidad-artello.md.

## 0.12.0 — 2026-09-09 · sesión 021

La app aprende de tus correcciones: «Corregir lectura» en un mensaje guarda tu categoría y la aplica a mensajes iguales o casi iguales (frase normalizada, coincidencia exacta o muy alta), con listado y olvido en Configuración; no entrena ningún modelo. Reglas ampliadas con tres categorías nuevas (cierre o vacaciones, pago o factura pendiente, documento enviado) y muchos escenarios más: horas («antes de las 12», «a primera hora»), fechas con mes («3 de octubre»), abreviaturas («mñn»), faltas de ortografía («kedan»), promociones sin lectura obligatoria, peticiones («devuélveme», «necesito el CIF»), abonos y reclamaciones. Corpus nuevo de 40 escenarios: 21/40 antes, 40/40 después; corpus anterior 80/80. Base SQLite versión 3 (tabla learned).

105 pruebas, ejecutable 0.12.0. Informe reports/2026-09-09T11-07-12-248Z-aprendizaje-y-reglas-ampliadas.md.

## 0.11.0 — 2026-09-09 · sesión 020

Recetario con contraseña: las recetas y la producción se ocultan y bloquean hasta desbloquear (30 minutos); contraseña local con scrypt, cambio y retirada con contraseña, retardo creciente ante fallos. Limpieza periódica configurable (7, 14, 30 o 90 días): borra actividad antigua (conserva las 50 entradas más recientes) y conversaciones, envíos, notas y adjuntos de WhatsApp anteriores al plazo; los movimientos de stock y las copias no se tocan; se ejecuta al abrir y cada seis horas o a mano.

102 pruebas, ejecutable 0.11.0. Informe reports/2026-09-09T10-42-22-808Z-recetario-contrasena-limpieza.md.

## 0.10.3 — 2026-09-09 · sesión 019

WhatsApp: al conectar se revisa el historial reciente de cada chat autorizado e importa lo que faltaba (texto), también a mano con «Recuperar mensajes recientes»; reconexión automática con esperas crecientes si la sesión se cae y «Conectar al abrir» está activo (nunca tras un cierre de sesión). Exportar CSV (inventario y movimientos, punto y coma, BOM) desde Configuración.

99 pruebas, ejecutable 0.10.3. Recuperación verificada con la sesión real del usuario. Informe reports/2026-09-09T09-56-20-662Z-historial-reconexion-csv.md.

## 0.10.2 — 2026-09-09 · sesión 018

WhatsApp: «Conectar al abrir» reutiliza la sesión guardada al arrancar y avisa con una notificación nativa de Windows cuando escribe un proveedor autorizado (clic: vuelve a la app). Ayuda de primeros pasos en Configuración. Persistencia más rápida con historial grande: cada acción con 3.000 movimientos pasa de 52 a 29 ms (caché de filas y operaciones ya guardadas).

96 pruebas, ejecutable 0.10.2. Informe reports/2026-09-09T00-08-47-508Z-autoconexion-avisos-rendimiento.md.

## 0.10.1 — 2026-09-09 · sesión 017

Ventas y mermas del día de producto terminado desde Producción (salidas y mermas trazables, aviso de mínimos). Etiquetas de producción y terminado en el historial. Prueba de integridad: un proceso matado a mitad de escrituras deja SQLite íntegra y consistente (quick_check, revisión y operaciones alineadas).

94 pruebas, ejecutable 0.10.1. Informe reports/2026-09-08T23-43-48-800Z-ventas-mermas-integridad.md.

## 0.10.0 — 2026-09-09 · sesión 016

Sesión autónoma de mejora general pedida por el usuario. Bandeja unificada: los mensajes de WhatsApp de proveedores autorizados entran en Mensajes con lectura por reglas, se vinculan solos al pedido enviado a ese número cuando no hay duda y fijan la entrega prevista del pedido (visible en Control de entregas y en Resumen). Copia automática diaria con retención de 30 copias automáticas e indicador en Configuración. Endurecimiento: Permissions-Policy y Referrer-Policy, permisos de Electron denegados también en comprobación, sin webview, errores no controlados a data/runtime/logs/errores.log. Tipo de documento confirmado por la persona guardado en la foto. Interfaz dividida en módulos src/ui/*.js por responsabilidad.

92 pruebas, ejecutable 0.10.0. Informe con valoración por puntos: reports/2026-09-08T23-40-16-197Z-mejora-general-0100.md.

## 0.9.4 — 2026-09-08 · sesión 015

WhatsApp real comprobado en ambos sentidos con los números del usuario: envío confirmado leyendo el propio chat de WhatsApp Web cuando la librería pierde la referencia (chats LID), identificadores de mensaje reconstruidos para recibir en chats LID, y cierre limpio del navegador. Un «Ok» enviado desde el teléfono quedó importado en la app.

Pruebas y ejecutable 0.9.4. Informe reports/2026-09-08T23-26-35-693Z-whatsapp-envio-recepcion-real.md.

## 0.9.3 — 2026-09-08 · sesión 014

El usuario conectó por QR pero ningún mensaje llegaba en ninguna dirección. Cambios: los remitentes con identificador LID de WhatsApp se resuelven a número (getContactLidAndPhone y, si falla, el contacto del mensaje); diagnóstico local del canal en data/whatsapp/diagnostico.log (motivos e identificadores, nunca texto) visible en la pantalla WhatsApp; botón «Enviar mensaje de prueba» a un chat autorizado; texto de la pantalla actualizado. Con el diagnóstico del usuario se confirmó que la recepción funcionaba (mensajes descartados por autorización de otra cuenta) y que el envío fallaba en silencio: whatsapp-web.js devuelve undefined si no existe chat para número@c.us; ahora se resuelve el identificador real (getNumberId/LID) y un envío sin identificador falla de forma visible.

86 pruebas, ejecutable 0.9.3. Pendiente: prueba real del usuario con el diagnóstico a la vista. Informe reports/2026-09-08T18-40-07-473Z-diagnostico-whatsapp.md.

## 0.9.1 — 2026-09-08 · sesión 013

Envío real de pedidos por WhatsApp, autorizado por el usuario tras vincular por QR sus dos números propios. Solo pedidos pendientes, solo al número de la ficha del proveedor si está autorizado para la cuenta conectada, con vista previa del texto exacto y confirmación explícita; una vez por pedido, nunca automático. El pedido guarda destino, identificador, hora y texto; enviar no cambia stock ni da por confirmado. Los mensajes enviados aparecen en la conversación de WhatsApp. «Simular envío» se conserva para pruebas sin canal.

85 pruebas aprobadas (envío con cliente simulado en conector y servidor), ejecutable 0.9.1 reconstruido y probado. Prueba con teléfono real pendiente del usuario. Informe reports/2026-09-08T18-16-51-221Z-envio-whatsapp-real.md.

## 0.9.0 — 2026-09-08 · sesión 012

Producción y recetas: recetas con rendimiento e ingredientes en unidad base; registrar kilos producidos calcula por reglas el consumo estimado, que la persona corrige y aprueba antes de descontar; entrada del producto terminado; hoja diaria; aviso de mínimos. Respuestas de proveedores: reglas deterministas marcan categoría (falta de producto, cancelación, cambio, pregunta, fecha de entrega, confirmación), resuelven fechas relativas y señalan lo que hay que leer; filtro «Debes leer», aviso en Resumen y respuestas vinculadas en Control de entregas. Segunda lectura opcional con el modelo local que solo anota una categoría. Base SQLite user_version 2 con tablas recipes y productions.

Auditoría de seguridad con sonda local (26 comprobaciones), clave de sesión fuera de la URL, comparación en tiempo constante, caché validada del estado (lecturas 4× más rápidas) y lectura por reglas de los mensajes importados de WhatsApp. Reglas afinadas con un corpus de 60 respuestas rutinarias más 20 reservadas (60/60 y 20/20 tras afinar; 15/20 en la primera pasada sin afinar), incorporadas como prueba de regresión. 82 pruebas aprobadas, ejecutable 0.9.0 reconstruido y probado con modelo real. Evaluación de respuestas de proveedor con modelo y reglas en reports/ai-replies-v090.json. Informe reports/2026-09-08T16-18-04-876Z-recetas-produccion-respuestas.md.

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
