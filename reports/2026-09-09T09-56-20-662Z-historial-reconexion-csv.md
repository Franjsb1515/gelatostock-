# Sesión 019 · Historial reciente, reconexión y CSV · versión 0.10.3

## Cambios
- recover(): tras «ready» (8 s) y a demanda, lee los mensajes cargados de cada chat autorizado dentro de WhatsApp Web (solo texto, últimos 50, no propios), reconstruye la clave y los pasa por receive() ignorando el filtro de hora; deduplica por clave; registra «historial revisado: N chat(s), M nuevos». Verificado con la sesión real del usuario: 2 chats revisados, 0 nuevos (el «Ok» ya estaba importado). Observación: WhatsApp Web sí reemite mensajes de otros contactos al conectar, que se ignoran por ser anteriores a la conexión; los autorizados entran por el historial.
- scheduleReconnect(): al evento disconnected (salvo LOGOUT) con «Conectar al abrir» activo, cierra el navegador sin cerrar sesión y reconecta con esperas 15 s → 5 min, máximo 20 intentos; se cancela al cerrar la app.
- /api/export: inventario y movimientos en CSV con BOM y punto y coma (Excel en español), escapado de comillas y saltos, guardados en data/exportaciones; botón en Configuración.

## Pruebas
- tests/whatsapp.test.cjs: recuperación con cliente simulado (importa solo lo que falta, autorización respetada, diagnóstico), programación de reconexión y tope de intentos.
- tests/server.test.cjs: CSV con BOM, cabeceras y escapado.
- Sonda de seguridad 26/26 (la exportación escribe solo dentro de data/exportaciones, sin nombres controlados por el usuario).

## Límites
- La recuperación cubre los mensajes que WhatsApp Web tiene cargados (habitualmente los últimos de cada chat); no descarga adjuntos del historial.
- La reconexión reutiliza la sesión guardada; si WhatsApp la invalida, hace falta QR de nuevo y la app lo indica.

## Evidencia final
- npm test: 99 aprobadas (reports/tests-2026-09-09-v0103.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.10.3-win32-x64.
- npm run test:desktop: 10 PASS (completa). reports/desktop-smoke-2026-09-09-v0103.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M package-lock.json
 M package.json
 M src/server.cjs
 M src/ui/actions.js
 M src/ui/views.js
 M src/ui/whatsapp.js
 M src/whatsapp.cjs
 M tests/server.test.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-09T09-56-20-662Z-historial-reconexion-csv.md
?? reports/desktop-smoke-2026-09-09-v0103.txt
?? reports/tests-2026-09-09-v0103.txt
```
