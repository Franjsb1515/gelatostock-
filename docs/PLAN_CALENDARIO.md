# Plan · Calendario de planificación

Origen: docs/origen/PEDIDO_CALENDARIO_2026-10-04.md (no releer; todo lo necesario está aquí).

## Qué pide
Pantalla propia «Calendario»: años → meses → días → ficha del día con «exactamente» lo de ese día (horarios, ventas, etc.). Lo nuevo se apunta a mano o con fotos, y la app lo revisa y lo ordena.

## Qué ya existe y se reutiliza (sin datos nuevos)
- Por día de negocio: producido, vendido, merma por motivo, invitación, venta real y cierre confirmado (core/day.ts daySummary, core/sales.ts closeLineOf), valor y coste (core/value.ts).
- Pedidos enviados y entregas recibidas por fecha; mensajes de proveedores por fecha.
- Cruceros (APB), clima guardado (MET Norway, «previsión guardada» en días pasados) y festivos (Govern balear), con su fuente.
- Lectura de fotos local: tesseract (src/ocr.cjs) y texto de PDF (src/pdftext.cjs).

## Qué no es viable tal cual (dicho al usuario antes de construir)
- Que la app «lo ordene» sola desde una foto sin revisión: la lectura de fotos es local y sin IA de pago; lee bien texto impreso o de pantalla, mal la letra a mano y regular las tablas (un cuadrante de turnos). Regla del proyecto: la foto propone, la persona confirma; nada se rellena con datos inventados.
- Días sin datos: se muestran como «No disponible», nunca con estimaciones.

## Fases propuestas (una por sesión, una versión por fase)
Estado: fase 1 hecha en 0.48.0 (2026-10-04), con la marca «La tienda no abrió» adelantada de la fase 2 (core/calendar.ts, acciones markNotOpened/unmarkNotOpened, state.closures en meta). Queda de la fase 2 los apuntes por día, que esperan la respuesta 1. Las preguntas siguen sin contestar (el usuario mandó la plantilla sin rellenar).
1. Navegación año → mes → día y ficha del día solo con lo que ya existe (ventas, producción, mermas, cierre, pedidos y entregas, cruceros, clima, festivo). Sin datos nuevos.
2. Día sin abrir (pedido del usuario el 2026-10-04): poder marcar en el calendario que la tienda cerró ese día (con motivo opcional), para que no cuente como un día sin ventas ni salte el aviso de cierre pendiente. Apuntes a mano por día: horario (de apertura y/o turnos, según respuesta), notas y eventos. Datos nuevos en el esquema (zod) con pruebas; un día cerrado no cambia por esto (ensureDayOpen solo si toca ventas).
3. Fotos desde el propio Calendario (aclarado por el usuario el 2026-10-04): un botón «Subir foto» en el calendario; la app lee la foto, decide a qué día y a qué apartado va (horario, ventas, factura o albarán de un proveedor, nota) y lo coloca, siempre como propuesta que la persona confirma antes de guardar. Una factura o albarán va además a Documentos, como hoy. Si la foto no dice la fecha, se pregunta: no se adivina.

## Respuestas del usuario (2026-10-04, tras la 0.48.0)
1. Horarios: los dos (apertura de la tienda y turnos del personal). Los hace por semanas y por ahora los sube él a mano.
2. Ver cada día: ventas, producción del día, vacaciones si las hay, cruceros y stock. Quiere además que la app «audite y cargue automáticamente».
3. Fotos: sin contestar.
4. Nuevo: el Calendario («la agenda») va con clave; sin clave no se entra.

Lo que se le dijo que no es viable tal cual: «cargar automáticamente» las ventas no se puede sin caja ni TPV conectado (dijo el 2026-09-18 que no hay caja): la app carga sola lo que ya está en ella (cierres, producción, stock, pedidos, cruceros, clima) y las ventas siguen saliendo del cierre del día. «Auditar» se hace con reglas visibles por día (no cuadra la cuenta, día sin cerrar, cierre confirmado que ya no coincide, venta real lejos de la estimada, día marcado sin abrir con movimientos, turno sin apertura), nunca corrigiendo nada solo. La clave protege la pantalla en este equipo, no el archivo de datos: quien tenga el ordenador y sepa buscar la carpeta puede abrir la base.

## Fase 2 revisada (siguiente sesión)
- Clave del Calendario: mismo mecanismo que la del Recetario (hash en settings, 30 min desbloqueado, espera creciente tras fallos), clave propia «calendar_lock»; /api/calendar* responde 423 sin desbloquear.
- Horario semanal: semana a semana, apertura por día (o «cerrado») y turnos (persona, de-a); «Copiar la semana anterior». Datos nuevos en zod con pruebas. Pendiente de confirmar: formulario escrito (recomendado) o foto.
- Vacaciones: pendiente de confirmar si son de la tienda (se marcan como «no abrió» por rango de fechas) o del personal (van en los turnos).
- Stock en la ficha: stock de cada producto al terminar el día (stockAtDayEnd de core/day.ts), en su unidad.
- Auditoría del día y del mes: lista de avisos por reglas con su motivo; solo avisa.

## Preguntas abiertas (al usuario)
1. «Horarios»: ¿horario de apertura de la tienda, turnos del personal (quién y de qué hora a qué hora) o los dos?
2. ¿Qué más quieres ver en cada día además de horarios y ventas? (notas, eventos, pedidos y entregas, cruceros, clima…)
3. Las fotos que subirías: ¿impresas o de una pantalla, o escritas a mano? ¿Me mandas una o dos de ejemplo? (sin ejemplos reales no se puede medir si la lectura acierta).
