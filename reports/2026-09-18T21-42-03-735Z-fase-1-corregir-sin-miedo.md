# Sesión 043 · Fase 1: corregir sin miedo · versión 0.28.0

## Encargo
Primera fase del plan docs/PLAN_PRODUCCION_VENTAS_CAJA.md, acordado con el usuario el mismo día: poder corregir o eliminar producciones y mermas con un clic, con trazabilidad por dentro y recálculo de todo lo derivado.

## Hecho
- Anular una producción aprobada: compensa sus movimientos vivos (primero sale el producto terminado, luego vuelven los ingredientes, para que ningún paso deje un stock imposible). Queda marcada con fecha y motivo; nada se borra.
- Corregir una producción: la anula y deja una propuesta idéntica para cambiar el peso o el consumo y aprobarla de nuevo. Reutiliza el flujo de aprobación que ya existía.
- Bloqueo con explicación: si del producto terminado ya no queda lo que esa producción aportó (se vendió o se tiró), no se anula y el mensaje dice cuánto queda y qué deshacer antes. El bloqueo no toca nada.
- Corregir o eliminar una línea suelta del cierre (venta o merma): compensa la anterior y registra la nueva con el mismo día de negocio y, salvo que se cambie, el mismo motivo. El historial, la semana y «Ventas e impacto» leen los mismos movimientos, así que ninguna pantalla conserva el cálculo viejo.
- Pesos en kilos o en gramos en el cierre y en la corrección (la preferencia se recuerda). El núcleo sigue guardando kilos.
- Día de negocio: ajuste «el día cambia a las HH:00» (0 a 8, por defecto 5). La fecha propuesta en el cierre y en la producción es la del día de negocio.
- Interfaz: «Corregir» y «Anular» en la hoja diaria; líneas de cada día con «Corregir» y «Eliminar» en el historial, que pasa a ocupar todo el ancho.
- Hueco verificado y corregido: los botones con clase text-link se veían como botones del sistema y quedaban cortados dentro de tablas (captura de la sesión); ahora tienen estilo propio en toda la app.

## Decisión técnica
Una producción anulada conserva el estado «discarded» y gana voidedAt y voidReason. Un estado nuevo habría obligado a migrar la restricción CHECK de la tabla SQLite sin aportar nada al usuario.

## Tests
- tests/corrections.test.cjs, 4 pruebas: anular una duplicada y después la original deja el inventario exactamente como al empezar; corregir deja propuesta y permite aprobar con otro peso; bloqueo cuando ya se vendió parte, sin tocar nada, y desbloqueo al deshacer el cierre; el ejemplo del usuario (merma de 250 g que eran 150 g) con stock, porcentaje de merma y motivo conservado; cambio de motivo; eliminar una venta; rechazos (peso imposible, cero, línea ya compensada, movimiento ajeno a un cierre); ajuste de hora validado y enviado a la interfaz.
- Prueba de escritorio: una merma corregida en gramos (500 g a 400 g y vuelta) con el stock recalculado.

## Limitaciones
- Corregir una producción pasa por anular y volver a aprobar: son dos pasos para el usuario, a cambio de no duplicar reglas.
- El día cerrado todavía no existe (fase 4): hoy todo cierre se puede corregir.
- Siguiente: fase 2, merma frente a invitación o consumo.

## Evidencia final
- npm test: 156 aprobadas (reports/tests-2026-09-18-v0280.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.28.0-win32-x64.
- npm run test:desktop: 15 PASS (completa). reports/desktop-smoke-2026-09-18-v0280.txt.
- node scripts/evaluate-ai.cjs --chat: 19/19 (reports/ai-chat-v0280.json).

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/sales.ts
 M core/schema.ts
 M docs/CONTINUIDAD.md
 M docs/GUIA_USO.md
 M docs/PLAN_PRODUCCION_VENTAS_CAJA.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/server.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/events.js
 M src/ui/guide.js
 M src/ui/views-production.js
 M src/ui/views-sales.js
 M src/ui/views.js
?? reports/2026-09-18T21-42-03-735Z-fase-1-corregir-sin-miedo.md
?? reports/ai-chat-v0280.json
?? reports/design/0280-hoja-diaria.png
?? reports/design/0280-lineas-del-cierre.png
?? reports/desktop-smoke-2026-09-18-v0280.txt
?? reports/tests-2026-09-18-v0280.txt
?? tests/corrections.test.cjs
```
