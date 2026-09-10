# Sesión 030 · Copia secundaria, historial paginado y vistas partidas · versión 0.18.0

## Encargo
Continuar con los pendientes de la auditoría (reports/2026-09-10T01-05-00-000Z-auditoria-general-0170.md): puntos 8, 7 y 11.

## Cambios
- Copia secundaria (8): src/server.cjs copyToSecondary tras cada copia (manual, automática diaria y al arrancar si la última copia no está en la carpeta secundaria), retención de 30; ruta /api/maintenance backupDir valida ruta absoluta, fuera de la carpeta de datos y escribible (archivo de prueba), guarda el ajuste backup_dir_secondary y hace una copia inmediata. Envelope backup con stale (más de 48 h) y secondary {dir, last, error}. Configuración: bloque «Copia secundaria» con elegir/cambiar/quitar; Resumen: aviso con enlace. Prueba en tests/server.test.cjs (rutas inválidas 400, copia inmediata, duplicado en copia manual, quitar).
- Historial paginado (7): createApp historyLimit (300, GELATO_HISTORY_LIMIT), trimHistory en el envelope y envelope.history con totales; GET /api/history?kind&offset&limit; interfaz con applyEnvelope común, historyInfo/historyShown, «Mostrar más» en Actividad para movimientos y actividad. Prueba con historyLimit 3 y cinco movimientos.
- Vistas (11): work/split-views.cjs (no versionado) repartió los bloques por nombre en seis archivos sin editar su contenido; index.html y la lista assets del servidor incluyen los nuevos. Prueba de escritorio: pasos Recetario (escala 6 kg → 3 L; stock intacto) y «Abrir» con filtro de proveedor activo. work/design-capture.cjs incluye Recetario y Guía.
- Guía y guía del chat actualizadas (copia secundaria, «Mostrar más»).

## Verificación
- npm test: 124/124. Formato limpio.
- Evidencia final (paquete y prueba de escritorio con 13 pasos) al pie.

## Corregido durante la verificación
- «Mostrar más» no aparecía cuando lo mostrado era menor que el límite pero el servidor tenía más filas (comparaba el tope de 50 con el total); detectado con work/shot-backup.cjs (límite 4, seis movimientos) y corregido en moreHistory. Tras «Mostrar más» se ven las 6 filas (captura reports/design/0180-actividad-mas.png).
- La captura tras el análisis de IA en la prueba de escritorio expiró una vez a 30 s justo después del desplazamiento suave de «Abrir»; el desplazamiento pasa a inmediato y la prueba volvió a pasar completa (13 pasos).

## Límites
- La carpeta secundaria se escribe a mano (sin diálogo del sistema: la ventana no tiene preload/IPC por diseño). Queda en TODO.
- Si la carpeta secundaria no está disponible (USB desconectado) la copia principal sigue y el aviso aparece en Resumen; no se reintenta hasta la siguiente copia.
- Punto 6 (memoria IA) sigue pendiente de medir en el Mac.

## Evidencia final
- npm test: 124 aprobadas (reports/tests-2026-09-10-v0180.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.18.0-win32-x64.
- npm run test:desktop: 13 PASS (completa). reports/desktop-smoke-2026-09-10-v0180.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M docs/GUIA_USO.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/index.html
 M src/server.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/events.js
 M src/ui/guide.js
 M src/ui/views.js
 M tests/server.test.cjs
?? reports/2026-09-10T09-03-04-489Z-copia-secundaria-historial-paginado.md
?? reports/design/0180-actividad-mas.png
?? reports/design/0180-copia-secundaria.png
?? reports/desktop-smoke-2026-09-10-v0180.txt
?? reports/tests-2026-09-10-v0180.txt
?? src/ui/views-ai.js
?? src/ui/views-documents.js
?? src/ui/views-messages.js
?? src/ui/views-orders.js
?? src/ui/views-production.js
```
