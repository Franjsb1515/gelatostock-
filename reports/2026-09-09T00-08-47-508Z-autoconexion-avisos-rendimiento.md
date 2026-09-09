# Sesión 018 · Conexión automática, avisos nativos y rendimiento · versión 0.10.2

## Cambios
- WhatsApp: preferencia «Conectar al abrir» guardada en el canal; desktop.cjs conecta al arrancar con la sesión guardada (sin QR) si está activa. El conector emite eventos locales al recibir un mensaje autorizado; la ventana muestra una notificación nativa (título con el nombre del contacto, texto acotado a 120 caracteres) y al pulsarla restaura la ventana. Los eventos no salen del proceso.
- Configuración: «Primeros pasos» con el circuito completo para una persona no técnica.
- Persistencia: work/bench-big.cjs con 3.000 movimientos: 52 → 29 ms por acción (caché de filas por tabla y conjunto de operaciones ya guardadas; se invalidan al detectar otra conexión, en rollback y al cerrar). Carga en frío con caché: 15 ms. Estado en JSON: ~0,9 MB con 3.000 movimientos; cada acción devuelve el estado completo a la interfaz, aceptable hoy y anotado como límite.
- Perfil (work/profile-store.cjs, 1.500 movimientos): validar 2,6 ms, clonar 2,6 ms, aplicar 5,4 ms, archivo derivado 4,6 ms, acción completa ~30 ms.

## Pruebas
- tests/whatsapp.test.cjs: preferencia y evento local; tests/server.test.cjs: la preferencia se guarda y solo acepta true real.
- Sonda de seguridad 26/26 (sin nuevas superficies: autoconnect exige sesión autenticada y solo toca una preferencia local).

## Valoración tras esta sesión
Utilidad 8 → 8,5 (canal siempre listo y avisos); Rendimiento 7,5 → 8 en Windows medido (sin medir Mac). El resto igual que en 0.10.0: IA 6 y producción 5 dependen del usuario.

## Evidencia final
- npm test: 96 aprobadas (reports/tests-2026-09-09-v0102.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.10.2-win32-x64.
- npm run test:desktop: 10 PASS (completa). reports/desktop-smoke-2026-09-09-v0102.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/store.ts
 M package-lock.json
 M package.json
 M src/desktop.cjs
 M src/server.cjs
 M src/styles.css
 M src/ui/views.js
 M src/ui/whatsapp.js
 M src/whatsapp.cjs
 M tests/server.test.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-09T00-08-47-508Z-autoconexion-avisos-rendimiento.md
?? reports/desktop-smoke-2026-09-09-v0102.txt
?? reports/tests-2026-09-09-v0102.txt
```
