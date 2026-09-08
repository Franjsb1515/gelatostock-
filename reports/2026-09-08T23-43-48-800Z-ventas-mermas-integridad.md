# Sesión 017 · Ventas y mermas del día, integridad ante cortes · versión 0.10.1

## Cambios
- Acción dailySales: por producto terminado (kg, con receta o de Gelatería/Postres), kilos vendidos y merma del día; crea movimientos exit/waste con motivo fechado, rechaza repetidos, cantidades nulas o stock negativo, y avisa de mínimos. Panel en Producción.
- Historial: los movimientos de producción y de producto terminado muestran etiqueta (antes quedaban sin texto).
- Prueba de integridad: un proceso hijo encadena escrituras y se mata con SIGKILL a los 250 ms; al reabrir, quick_check = ok, revisión entera, operaciones registradas = revisión y stocks no negativos.
- Prueba de escritorio: registra 1 kg vendido y 0,5 kg de merma y comprueba el stock en SQLite.

## Valoración tras esta sesión
Utilidad 7,5 → 8 (ciclo completo: receta → producción aprobada → ventas/mermas → reposición → pedido real por WhatsApp → respuesta leída y vinculada → recepción). Fiabilidad 8,5 → 9 (corte brusco probado). El resto sin cambios; IA (6), rendimiento medido (7,5) y producción (5) dependen de datos reales, del Mac y de un certificado del usuario, como se detalla en el informe de 0.10.0.

## Evidencia final
- npm test: 94 aprobadas (reports/tests-2026-09-09-v0101.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.10.1-win32-x64.
- npm run test:desktop: 10 PASS (completa). reports/desktop-smoke-2026-09-09-v0101.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/views.js
 M tests/domain.test.cjs
 M tests/store.test.cjs
?? reports/2026-09-08T23-43-48-800Z-ventas-mermas-integridad.md
?? reports/desktop-smoke-2026-09-09-v0101.txt
?? reports/tests-2026-09-09-v0101.txt
```
