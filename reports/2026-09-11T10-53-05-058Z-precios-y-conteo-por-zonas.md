# Sesión 034 · Historial de precios y conteo guiado por zonas · versión 0.21.0

## Encargo
Bloque 2 de la lista del usuario: historial de precios por proveedor con aviso de subida y conteo de inventario guiado por turnos/zonas con recordatorio.

## Cambios
- core/schema.ts: zonas (enum) en productFields con valor por defecto, editProduct acepta zone; estado con prices (historial); acción countSheet. core/store.ts: tabla prices con referencia a products, user_version 4 (las bases en 3 se abren y crean la tabla; las pruebas de migración esperan 4).
- core/domain.ts: editProduct registra el cambio de precio (de, a, proveedor, fecha, origen edit); countSheet aplica un conteo por línea con motivo «Conteo de <zona>» y anota cuántos cambiaron. core/inventory.ts: priceAlerts (subidas por producto en N días, con porcentaje) y countStatus (por zona: productos, último conteo completo, días, pendiente). core/report.ts: cambios de precio de la semana.
- Servidor: envelope.alerts {prices, counts} y countDays; /api/maintenance countDays (0, 3, 7, 14, 30).
- Interfaz: aviso en Resumen (subidas de precio y zonas por contar con enlace a la hoja); Inventario con «Hoja de conteo» (zona, tabla con stock actual y cantidad contada, cambio de zona en vivo) y zona en la celda del producto; Editar/Nuevo producto con zona; ficha de proveedor con últimos cambios de precio; Configuración con el plazo de recordatorio; Semana con los cambios de precio.
- Guía y guía del chat actualizadas.

## Verificación
- npm test: 131/131 (pruebas nuevas: historial y avisos de precio; hoja de conteo, recordatorio por zona y plazo 0; persistencia de prices y versión 4). Formato y typecheck limpios.
- Capturas work/shot-counts.cjs (no versionado): Resumen con avisos, hoja de conteo de la cámara, ficha de proveedor con el cambio de precio; muestras en reports/design/0210-*.png.
- Evidencia final (paquete y prueba de escritorio) al pie.

## Incidencia en la verificación
- La primera prueba de escritorio del paquete volvió a fallar en el paso de IA (segunda vez tras 0.19.1): el análisis terminó (42 s en ia.log) pero la interfaz estaba en Recetario, no en IA local. No hay ningún código que navegue a Recetario sin clic. Para cazarlo, la prueba ahora registra cada render con su página y su origen y lo imprime si el paso falla (scripts/desktop-smoke.cjs, RENDERS RECIENTES). La segunda ejecución pasó completa (13 PASS). Sigue como caso a vigilar; no afecta al uso normal que se ha podido observar.

## Límites
- Solo se registran los cambios hechos en la ficha del producto; los precios leídos en listas de precios o mensajes quedan como mejora.
- Un conteo por zona cuenta todos los productos de la zona; un producto que se deja sin contar sigue haciendo la zona pendiente.

## Evidencia final
- npm test: 131 aprobadas (reports/tests-2026-09-11-v0210.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.21.0-win32-x64.
- npm run test:desktop: 13 PASS (completa). reports/desktop-smoke-2026-09-11-v0210.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/report.ts
 M core/schema.ts
 M core/seed.ts
 M core/store.ts
 M docs/GUIA_USO.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/server.cjs
 M src/styles.css
 M src/ui/actions-extended.js
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/events.js
 M src/ui/guide.js
 M src/ui/views-weekly.js
 M src/ui/views.js
 M tests/domain.test.cjs
 M tests/store.test.cjs
?? core/inventory.ts
?? reports/2026-09-11T10-53-05-058Z-precios-y-conteo-por-zonas.md
?? reports/design/0210-hoja-conteo.png
?? reports/design/0210-proveedor-precios.png
?? reports/design/0210-resumen-avisos.png
?? reports/desktop-smoke-2026-09-11-v0210.txt
?? reports/tests-2026-09-11-v0210.txt
```
