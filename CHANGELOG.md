# Registro de parches y sesiones

## 0.29.0 — 2026-09-18 · sesión 044 · fase 2 del plan de producción y ventas

Merma frente a invitación o consumo. El cierre del día tiene una columna propia para lo que se invita, se da a probar o consume el equipo: sale del stock, pero no es merma ni venta. El porcentaje de merma pasa a calcularse solo con merma real sobre todo lo que salió. Historial, líneas del cierre, resumen semanal y mensajes de Actividad separan las tres salidas. «Degustación o invitación» deja de ser un motivo de merma; lo ya apuntado así se lee como invitación sin reescribir ningún movimiento. Pesando lo que queda, lo invitado tampoco cuenta como vendido.

Pruebas: 158. Informe reports/2026-09-18T21-52-07-524Z-fase-2-merma-e-invitacion.md.

## 0.28.0 — 2026-09-18 · sesión 043 · fase 1 del plan de producción y ventas

Corregir sin miedo. Una producción aprobada se puede anular (los ingredientes vuelven, el producto terminado sale, los movimientos originales se conservan) o corregir (se anula y queda una propuesta igual para aprobarla bien); si parte ya se vendió o se tiró, la app lo impide y dice qué deshacer antes. Cada línea de un cierre (una venta o una merma) se corrige o se elimina por separado, con el stock y los totales del día recalculados desde la única fuente, los movimientos. Pesos en kilos o en gramos. Día de negocio con hora de cambio configurable (por defecto 5:00) para quien cierra de madrugada. Frases humanas tras cada corrección («Merma corregida: … de 0,25 a 0,15 kg. Stock disponible: …»). Los botones con aspecto de enlace dejan de verse como botones del sistema en toda la app.

Pruebas: 156. Informe reports/2026-09-18T21-42-03-735Z-fase-1-corregir-sin-miedo.md.

## Plan de producción, ventas, mermas y caja — 2026-09-18 · sesión 042 (sin cambio de versión)

Sin cambios en la aplicación. El prompt maestro del usuario (541 líneas) queda archivado íntegro en docs/origen/ y condensado en docs/PLAN_PRODUCCION_VENTAS_CAJA.md: diez principios, tabla de decisiones contra la app real (mantener, mejorar, añadir, integrar, posponer, no añadir), cinco preguntas que solo puede responder el usuario, siete fases y el mapa de sus 18 criterios de aceptación. CLAUDE.md gana la sección «Sesiones ligeras» (condensar encargos grandes en un plan, una fase por sesión, un cierre por fase, leer solo lo necesario).

## Orden de documentos — 2026-09-18 · sesión 041 (sin cambio de versión)

Sin cambios en la aplicación. TODO.md reescrito: solo lo pendiente (34 puntos sin duplicados, frente a 38 con tres repetidos y dos ya resueltos), por áreas y marcando qué depende del usuario; lo hecho, en una línea por bloque. CLAUDE.md reducido de 11,5 KB a 5,8 KB (reglas vigentes, mapa y garantías por módulo); los puntos de continuidad pasan íntegros a docs/CONTINUIDAD.md. README.md reescrito para describir la app de hoy; sus notas por versión pasan íntegras a docs/HISTORIA_VERSIONES.md. Corregidos dos datos desfasados: «pedidos todavía simulados» y «falta paginar el estado». work/: eliminadas 35 carpetas temporales de pruebas y capturas (149 MB) y archivados los guiones de un solo uso en work/archivo. tests/context.test.cjs ya no deja una carpeta temporal sin borrar.

## 0.27.0 — 2026-09-18 · sesión 040

Cierre del día. La acción dailySales admite, por línea, lo vendido o lo que queda (remaining: la app calcula vendido = stock − merma − queda) y un motivo de merma de lista cerrada (core/sales.ts: fin de vida útil, textura o cristalización, vitrina o temperatura, caída o rotura, degustación o invitación, otro), que viaja en el texto del movimiento. Validación previa con mensajes claros (queda más de lo que había; vendido y merma superan el stock; las dos cosas a la vez). Acción nueva undoDailySales: compensa todas las ventas y mermas vivas de un día de negocio y conserva los originales. salesHistory y GET /api/sales: por día de negocio, totales, porcentaje de merma, mermas por motivo y por producto, sin contar lo deshecho. Interfaz nueva src/ui/views-sales.js: dos formas de apuntar, cálculo en vivo por fila, historial de 14 días a 12 meses, «Deshacer» y pista de cruceros para mañana.

Corregido: el resumen semanal contaba ventas y mermas ya deshechas, y las asignaba al día en que se teclearon en lugar de a su día de negocio.

Pruebas: 152. Informe reports/2026-09-18T16-58-36-020Z-cierre-del-dia.md.

## 0.26.0 — 2026-09-18 · sesión 039

Pendientes recomendados de Cruceros. Contexto del día: clima previsto para Palma (MET Norway, CC BY 4.0), festivos del calendario laboral oficial del Govern de les Illes Balears (autonómicos y locales de Palma) y eventos anotados por el usuario, visibles en el panel de hoy, las tarjetas de día, el calendario y el detalle. «Ventas e impacto»: kilos vendidos por nivel de impacto (días, media, mínimo y máximo), con aviso cuando hay menos de 8 días de un nivel; sin correlaciones ni predicciones. Restauración del registro de cruceros desde la copia diaria, conservando el registro actual. El informe semanal lleva también el contexto de cada día. Nuevo core/context.ts, src/context/providers.cjs y service.cjs (data/contexto.sqlite, con su copia diaria).

No hecho, con motivo: agenda automática de eventos (el Ajuntament de Palma no publica una agenda reutilizable; los eventos son manuales) y observaciones meteorológicas de días pasados (la fuente abierta solo da previsión; se conserva la previsión que había, rotulada así).

Pruebas: 148. Informe reports/2026-09-18T16-30-14-697Z-contexto-del-dia.md.

## 0.25.0 — 2026-09-18 · sesión 038

Cruceros pasa de lista a herramienta de planificación, siguiendo el prompt maestro del usuario y su regla de no inventar datos. Núcleo nuevo core/cruises.ts (validación de la fuente, hora de Palma con cambios de hora, pasajeros declarados, tipo de escala, máxima simultaneidad, línea temporal e impacto potencial con fórmula documentada y umbrales del usuario). Arquitectura en tres piezas: adaptador de la fuente (src/cruises/provider-apb.cjs), registro SQLite propio data/cruceros.sqlite con barcos, escalas, historial de cambios y sincronizaciones (repository.cjs) y servicio con intervalos, espera tras fallos e importación del histórico oficial desde 2014 (service.cjs). Identificador oficial de escala estable: los cambios de horario o muelle actualizan la misma fila y quedan en el historial; una escala futura que desaparece se marca «Retirada de la previsión» y se restaura si vuelve; un mismo IMO con otro nombre es un solo barco. Interfaz: panel de hoy, mañana, 7 y 30 días, calendario mensual, detalle del día con línea temporal SVG y tarjetas por barco, registro con buscador, historial y origen de cada escala, ficha manual del barco (naviera y capacidad, con fuente obligatoria), estado de sincronización siempre visible y explicación de cómo leer los datos. Semana muestra los cruceros de cada día junto a las ventas, sin correlaciones. El registro viaja con la copia diaria.

Corregido respecto a 0.24.0: «hoy» salía del reloj del equipo y no de Palma; «pasajeros aprox.» no decía que era un cálculo; las escalas de más de 400 días se borraban y las futuras anuladas desaparecían sin rastro; el identificador usaba el año de llegada en lugar del año oficial de la escala.

Pruebas: 142. Informe reports/2026-09-17T23-07-26-548Z-cruceros-planificacion.md.

## 0.24.0 — 2026-09-17 · sesión 037

Cruceros en Palma. Con internet, la app lee la previsión pública de escalas de la Autoridad Portuaria de Baleares y guarda un registro en data/cruceros.json: qué cruceros llegan y parten cada día, de dónde vienen y a dónde van, muelle, eslora, estado y pasajeros previstos (en tránsito, bajan, suben). Pantalla nueva «Cruceros» con el día elegido, los próximos 14 días y el registro de rutas con buscador y rutas más repetidas; aviso en Resumen cuando hoy hay cruceros en puerto; interruptor en Configuración. Las escalas pasadas se conservan (400 días); las futuras siguen la previsión y desaparecen si el puerto las anula. Sin internet se muestra lo último guardado con un aviso. La app solo lee y cita el origen de los datos.

Proyecto trasladado a D:/CARPETAPROYECTOS/APPGELATOSTOCK (rutas de documentos y utilidades actualizadas).

Pruebas: 138. Informe reports/2026-09-17T22-17-03-972Z-cruceros-palma.md.

## 0.23.0 — 2026-09-11 · sesión 036

Compras y Mensajes, primera entrega hacia el 100 %. Las respuestas vinculadas a un pedido actúan sobre él: una confirmación o una fecha de entrega marcan el pedido como confirmado (confirmedAt) y fijan la fecha prevista; las cantidades y el stock nunca cambian solos. Desde el mensaje, la app propone acciones según la lectura: fijar la entrega que dice el proveedor, marcar confirmado, quitar del pedido el producto que no tiene (removeLine, solo si no se recibió nada de él y no es el único), cancelar si lo anula, y ver el pedido. En Control de entregas: «Confirmado por el proveedor el…», «Fijar fecha de entrega» y «Marcar confirmado».

Seguimiento en Resumen (core/orders.ts orderReminders): pedidos autorizados sin enviar desde hace un día, enviados sin respuesta desde hace un día y entregas previstas ya pasadas sin registrar. Plantilla del pedido editable en Configuración con {lineas}, {numero}, {negocio} y {proveedor} (ajuste order_template; la vista previa y los envíos la usan). Al autorizar el carrito, si WhatsApp está conectado se abre directamente el envío por lotes. Textos de autorización sin la palabra «demostración».

Pruebas: 134. Informe reports/2026-09-11T11-26-49-711Z-compras-y-mensajes-1.md.

## 0.22.0 — 2026-09-11 · sesión 035

Diálogo del sistema para carpetas: src/preload.cjs (sandbox y aislamiento de contexto) expone una única función, pickFolder, que pide al proceso principal el selector nativo de carpetas (ipcMain «pick-folder», solo desde nuestra ventana). Configuración → carpeta secundaria tiene «Elegir con el explorador…» y Exportar CSV pregunta primero dónde guardar (cancelar usa la carpeta de datos; /api/export acepta dir absoluto). En el navegador de desarrollo, sin puente, se sigue escribiendo la ruta.

Preparación para Mac: scripts/package.cjs empaqueta también en macOS (Electron.app con la app en Contents/Resources/app, poda de binarios de otras plataformas por plataforma y arquitectura), npm run package:mac, scripts/setup-browser.cjs descarga el Chrome de WhatsApp para la plataforma actual y scripts/measure-ai-memory.cjs mide memoria y tiempos de la IA local. docs/MAC.md con los pasos y lo que falta (firma, prueba de escritorio, nombre del bundle). Nada de esto se ha ejecutado en un Mac todavía. Referencia en este Windows: pico 2227 MiB, base 47 MiB, tras liberar 132 MiB; lecturas 12379 ms, 4366 ms, 5125 ms (13th Gen Intel(R) Core(TM) i7-13620H, 15.6 GiB).

Pruebas: 132. Informe reports/2026-09-11T11-10-08-280Z-carpetas-y-mac.md.

## 0.21.0 — 2026-09-11 · sesión 034

Historial de precios: cada cambio de precio en la ficha del producto se guarda en la tabla prices (SQLite user_version 4; de, a, fecha, proveedor, origen). Resumen avisa de las subidas de los últimos 30 días con el porcentaje; la ficha del proveedor muestra los últimos tres cambios; el resumen semanal lista los cambios de la semana.

Conteo guiado por zonas: cada producto tiene una zona (vitrina, cámara, congelador, almacén, obrador, barra, otra; se asigna en Editar producto y al crear). En Inventario, «Hoja de conteo» lista los productos de la zona con el stock actual; al guardar, cada línea queda como un conteo (aunque no cambie) y el stock se ajusta (acción countSheet). Recordatorio configurable (Configuración → contar cada 3/7/14/30 días, o nunca): Resumen avisa de las zonas que llevan más tiempo sin contar por completo o que nunca se contaron, con acceso directo a la hoja. El cálculo (core/inventory.ts) usa el conteo más antiguo de la zona y viaja en el envelope (alerts), de modo que no depende del historial recortado en la interfaz.

Pruebas: 131. Informe reports/2026-09-11T10-53-05-058Z-precios-y-conteo-por-zonas.md.

## 0.20.0 — 2026-09-11 · sesión 033

Balance técnico del recetario: cada producto admite una ficha de composición (azúcares, grasa, sólidos totales y sólidos lácteos no grasos por 100 g; Inventario → Editar producto) y core/balance.ts calcula los porcentajes de la receta sobre la masa de ingredientes (kg y L 1:1, unidades fuera), comparados con rangos orientativos por familia (crema, sorbete, postre). Si falta alguna ficha lo dice y no marca rangos. Se calcula en el servidor y viaja con cada receta cuando el recetario está desbloqueado. Datos de ejemplo con fichas típicas para leche, nata, pistacho, chocolate y bebida de avena.

Resumen semanal imprimible: pantalla «Semana» (core/report.ts, GET /api/report?week=) con producción, ventas y mermas por día y por producto, recepciones, pedidos creados/enviados/recibidos y gasto estimado, mensajes y productos bajo mínimo al cierre; navegación por semanas e «Imprimir» con el diálogo del sistema (sirve para PDF). Estilos de impresión sin barra lateral.

Pruebas: 128. Informe reports/2026-09-11T10-38-53-475Z-balance-y-resumen-semanal.md.

## 0.19.1 — 2026-09-11 · sesión 032

Guiño «arte + gelato» en el chat de IA local: src/ai-lore.cjs (texto propio: gelato frente a helado, sorbete, historia con sus atribuciones, Mallorca y Ca'n Joan de s'Aigo, Artello y el sabor Mediterraneo, equilibrio de una receta, maduración, pistacho de Bronte, vitrina). El chat lo usa por reglas cuando encaja mejor que la guía de la app, con el prefijo «Arte + gelato:», sin modelo y sin coste de memoria; sinónimos nuevos (origen/inventó → historia, ice cream → helado…). Pista discreta en el ejemplo del chat. Evaluación --chat ampliada a 19 preguntas: 19/19 (fuentes: {"guide":13,"model":2,"rule":1,"lore":3}).

Pruebas: 126. Informe reports/2026-09-11T08-48-38-112Z-arte-gelato-chat.md.

## 0.19.0 — 2026-09-10 · sesión 031

Mensajes: respuesta directa desde el propio mensaje. Con WhatsApp conectado, el detalle muestra un cuadro de respuesta; las respuestas rápidas lo rellenan (ya no abren diálogo) y «Enviar por WhatsApp» envía ese texto una sola vez y anota la decisión. El borrador se conserva por mensaje mientras la pantalla se repinta.

Compras: «Enviar pendientes por WhatsApp» con un solo clic de decisión. Muestra la lista completa de pedidos pendientes con su texto exacto, motivo si no se puede enviar (sin WhatsApp, chat no autorizado, ya enviado, proveedor con web de compra: texto copiable y enlace), la persona marca los que quiere y la app los envía uno a uno con una pausa de 4 s (GELATO_BATCH_DELAY_MS) mostrando el progreso; cada pedido enviado queda Enviado y los fallidos siguen pendientes. Rutas batchPreview y sendBatch en /api/whatsapp; el lote se consulta en el GET del canal; solo un lote a la vez (409).

Pruebas: 125. Informe reports/2026-09-10T09-18-56-019Z-responder-y-lotes.md.

## 0.18.0 — 2026-09-10 · sesión 030

Copia secundaria (auditoría, punto 8): en Configuración se elige una carpeta fuera de la carpeta de datos (otro disco, USB, OneDrive); se comprueba que se puede escribir, se hace una copia inmediata y cada copia posterior (manual o automática diaria) se duplica allí con la misma retención de 30. El estado incluye si la última copia tiene más de 48 h y los errores de la copia secundaria; Resumen avisa con enlace a Configuración.

Historial paginado (punto 7): cada respuesta del servidor lleva solo los 300 movimientos y 300 entradas de actividad más recientes (GELATO_HISTORY_LIMIT o createApp({ historyLimit })) más los totales; Actividad muestra «N de M» y «Mostrar más», que primero amplía lo cargado y luego pide páginas a GET /api/history. La base de datos y las copias conservan todo.

Código (punto 11): src/ui/views.js (726 líneas) partido en views.js (resumen, inventario, proveedores, actividad, configuración), views-orders.js, views-production.js, views-messages.js, views-documents.js y views-ai.js, sin cambiar comportamiento; index.html y la lista de recursos del servidor actualizados. Prueba de escritorio con dos pasos nuevos: Recetario (escala a 6 kg = 3 L) y «Abrir» en Mensajes con filtro activo. Auditoría visual con Recetario y Guía.

Pruebas: 124. Informe reports/2026-09-10T09-03-04-489Z-copia-secundaria-historial-paginado.md.

## 0.17.1 — 2026-09-10 · sesión 029

Correcciones de la auditoría general (reports/2026-09-10T01-05-00-000Z-auditoria-general-0170.md). Espacio: dist pasó de 49,4 GB (28 versiones) a dos versiones; scripts/package.cjs conserva solo las dos más recientes y deja de empaquetar onnxruntime-web, las variantes de sharp para otras plataformas y los binarios de onnxruntime-node de otras plataformas (ejecutable 1,9 GB, antes 2,2 GB). sharp se conserva: transformers lo exige al cargar (el primer paquete podado falló con «Cannot find module sharp»; ahora el trabajador de IA anota la causa técnica en ia.log). Fechas: toda la resolución de fechas de mensajes (core/messages.ts) y las fechas «de hoy» de producción y ventas usan el calendario local, no UTC. CSV: src/csv.cjs antepone apóstrofo a celdas que abrirían una fórmula (=, +, -, @); los números no cambian. Registros: src/logs.cjs rota ia.log, errores.log y diagnostico.log al superar 1 MB. Textos: tuteo unificado (43 textos con voseo en interfaz, núcleo y README). README con las cabeceras históricas renumeradas a su versión real.

Pruebas: 122. Informe reports/2026-09-10T07-32-03-168Z-correcciones-auditoria.md.

## 0.17.0 — 2026-09-09 · sesión 028

Recetario: pantalla propia (bajo Producción, misma contraseña) con la ficha completa de cada receta: familia (crema, sorbete, postre, base, otro), rendimiento, ingredientes con porcentaje sobre la masa, elaboración y alérgenos (campos nuevos en core/schema.ts con valores por defecto; los datos existentes se cargan sin migración). «Calcular para X kg» escala las cantidades solo en pantalla (− / +), Producir abre el registro con esa receta, Duplicar crea una copia, Eliminar sigue exigiendo que no haya producciones aprobadas. Búsqueda por nombre o alérgeno y filtro por familia. Producción muestra un resumen y enlaza al recetario.

Ventas y mermas del día: solo lista los productos terminados que alguna receta genera; antes aparecían ingredientes en kg por su categoría (pistacho, vainilla), que confundían.

Mensajes: un solo bloque «Lo que entendió la app» (lectura, prioridad, pedido, segunda lectura de IA) en lugar de dos bloques que repetían el resumen; «Abrir» desde «Qué hacer ahora» o desde Resumen muestra siempre ese mensaje aunque los filtros lo ocultaran (los restablece) y desplaza al detalle; «Simular mensaje» pasa a secundario. Prueba de escritorio y guía actualizadas.

Pruebas: 119. Informe reports/2026-09-10T00-34-11-313Z-recetario-y-mensajes.md.

## 0.16.0 — 2026-09-09 · sesión 027

IA local, reglas primero: src/ai-review.cjs clasifica documentos por título normalizado (OCR: «F A C T U R A», «T0TAL»; títulos en las diez primeras líneas; proforma/presupuesto, abono/rectificativa/nota de crédito, factura/nº factura/simplificada, albarán/nota de entrega/delivery note, tarifa/lista de precios/catálogo, oferta/promoción) y reconoce mensajes por rasgos (saludo, pregunta, trato directo). El modelo Qwen3 0.6B pasa a segunda opinión: si discrepa, prevalecen las reglas y se avisa; si no hay título ni rasgos, el modelo solo decide tipos que no exigen título. Corpus nuevo tests/fixtures/ai-documents-2.json (40 documentos) más el de 11: 51/51 combinado · reglas 51/51 · modelo solo 38/51 · 6.4 s por lectura reforzada (0.15.1: 10/11 · 21 s por lectura reforzada).

Velocidad: trabajador persistente (el modelo se carga una vez y se libera tras 3 min sin uso), hilos ajustados por equipo (2–4, GELATO_AI_THREADS para afinar) y salida del modelo reducida a {"tipo"} (la «evidencia» nunca se mostraba). Chat de dudas con recuperación de párrafos de la guía (src/ai-guide.cjs) y evaluación nueva de 16 preguntas: 16/16 · 0.6 s por respuesta. Respuestas de proveedores (12): modelo 7/12 · reglas 12/12 · 7.1 s.

Compra en webs (Makro u otras) sin cuentas ni automatización: campo «Web de compra» (solo https) en la ficha del proveedor, enlace en Proveedores, y en el carrito «Lista para …» que muestra la lista copiable de ese proveedor y abre su web en el navegador del sistema (Electron solo permite abrir las webs guardadas en fichas; todo lo demás se deniega). La compra y el pago los hace la persona.

Pruebas: 117. Informe reports/2026-09-09T23-43-12-728Z-ia-reglas-primero-y-webs.md.

## 0.15.1 — 2026-09-09 · sesión 026

Botones − / + para cantidades: en las líneas del carrito (cambian el pedido al momento; llegar a 0 retira el producto), en «Añadir al carrito» (paquetes), en «Qué llegó» (cada pulsación suma o resta una presentación completa en unidad base, sin pasar de lo que falta), en «Registrar producción» (0,5 kg) y en «Entrada, salida o merma» (1 unidad). Ayudante stepperField en src/ui/forms.js y gestor único en src/ui/events.js que respeta min/max/decimales; el campo sigue siendo editable a mano. Prueba de escritorio ampliada (1 → 3 → 2 en el diálogo, +1 −1 en el carrito).

112 pruebas, ejecutable 0.15.1. Informe reports/2026-09-09T22-36-47-331Z-botones-mas-menos.md.

## 0.15.0 — 2026-09-09 · sesión 025

Mensajes rehecha: «Qué hacer ahora» arriba (mensajes que exigen lectura, con atajo al filtro «Debes leer»), conversaciones agrupadas por proveedor con contador de sin leer, detalle con bloque «Responder y decidir»: respuestas rápidas por WhatsApp según la lectura (texto visible y editable antes de enviar, una sola vez, solo con canal conectado y remitente real; ruta /api/whatsapp reply que reutiliza whatsapp.send) y «Decidir y cerrar», que anota la decisión del día (acción decide: texto, fecha, marca revisado; no toca pedidos ni stock). Las acciones secundarias (segunda lectura, prioridad, relevancia, corregir lectura) quedan plegadas en «Más opciones». Aviso explícito en el detalle, en el diálogo de corrección, en la guía y en el chat: lo aprendido cambia cómo se lee un mensaje, nunca lo que se decide.

Pantalla «Guía»: docs/GUIA_USO.md se compila a src/ui/guide.js en npm run build (scripts/build-guide.cjs) y se muestra con índice por sección; el chat de dudas (src/ai-help.cjs) describe las mismas funciones. Diálogo de corrección de lectura reescrito con el aviso. Prueba de escritorio adaptada al bloque plegado.

112 pruebas, ejecutable 0.15.0. Informe reports/2026-09-09T21-28-12-338Z-mensajes-guia-decisiones.md.

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
