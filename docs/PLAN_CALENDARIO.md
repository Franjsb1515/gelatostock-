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
1. Navegación año → mes → día y ficha del día solo con lo que ya existe (ventas, producción, mermas, cierre, pedidos y entregas, cruceros, clima, festivo). Sin datos nuevos.
2. Apuntes a mano por día: horario (de apertura y/o turnos, según respuesta), notas y eventos. Datos nuevos en el esquema (zod) con pruebas; un día cerrado no cambia por esto (ensureDayOpen solo si toca ventas).
3. Fotos: subir una foto o PDF al día; se archiva en Documentos con su texto leído y la app propone qué apuntar (horarios, cifras) para que la persona lo confirme línea a línea.

## Preguntas abiertas (al usuario)
1. «Horarios»: ¿horario de apertura de la tienda, turnos del personal (quién y de qué hora a qué hora) o los dos?
2. ¿Qué más quieres ver en cada día además de horarios y ventas? (notas, eventos, pedidos y entregas, cruceros, clima…)
3. Las fotos que subirías: ¿impresas o de una pantalla, o escritas a mano? ¿Me mandas una de ejemplo?
