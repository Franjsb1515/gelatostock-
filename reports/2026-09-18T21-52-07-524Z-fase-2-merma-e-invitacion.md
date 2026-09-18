# Sesión 044 · Fase 2: merma frente a invitación o consumo · versión 0.29.0

## Encargo
Segunda fase de docs/PLAN_PRODUCCION_VENTAS_CAJA.md. El usuario no distingue invitación a clientes, degustación y consumo del equipo: quiere una sola categoría, separada de la merma, para que el registro sea fiel.

## Hecho
- Campo gift en cada línea del cierre. Genera un movimiento de salida «Invitación o consumo del día AAAA-MM-DD». En el modo «peso lo que queda», vendido = stock − merma − invitación − lo que queda.
- core/sales.ts reescrito alrededor de una sola función, closeLineOf, que clasifica cualquier movimiento de cierre en venta, merma o invitación. La usan el historial, deshacer el día, corregir y eliminar una línea y el resumen semanal: una sola fuente de verdad.
- Porcentaje de merma = merma / (vendido + merma + invitación). Antes una degustación inflaba la merma.
- Datos antiguos: las mermas con el texto «· Degustación o invitación» se leen como invitación. No se reescribe ningún movimiento.
- Interfaz: columna en el cierre, indicador y columna en el historial, líneas con su tipo, tabla por producto, y en Semana indicador, columna diaria y sección propia.

## Cambio de expectativas en pruebas (explicado)
tests/sales.test.cjs usaba «tasting» como motivo de merma. Ese motivo ya no existe, así que esa línea pasa a ser una invitación y cambian las cifras esperadas del día (merma 0 en lugar de 0,25; porcentaje total 18,2 % en lugar de 27,3 %). El resto de comprobaciones de esa prueba no cambian.

## Tests
- Dos pruebas nuevas: invitación que descuenta stock sin ser merma ni venta, con «peso lo que queda», cierre solo de invitación, corrección y eliminación de la línea, rechazo por exceso de stock, rechazo de «tasting» y resumen semanal por categoría; y lectura de degustaciones antiguas como invitación sin tocar el movimiento original, incluido deshacer el día.
- Prueba de escritorio: el cierre final lleva 0,9 kg vendidos, 0,5 kg de merma y 0,1 kg de invitación.

## Limitaciones
- Una sola categoría, por decisión del usuario. Si más adelante quiere distinguir, basta con añadir textos a closeLineOf.
- Siguiente: fase 3, valor por kilo y coste de cada gelato, con dos informes separados (venta y coste).

## Evidencia final
- npm test: 158 aprobadas (reports/tests-2026-09-18-v0290.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.29.0-win32-x64.
- npm run test:desktop: 15 PASS (completa). reports/desktop-smoke-2026-09-18-v0290.txt.
- node scripts/evaluate-ai.cjs --chat: 19/19 (reports/ai-chat-v0290.json).

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/report.ts
 M core/sales.ts
 M core/schema.ts
 M docs/CONTINUIDAD.md
 M docs/GUIA_USO.md
 M docs/PLAN_PRODUCCION_VENTAS_CAJA.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/ui/actions.js
 M src/ui/guide.js
 M src/ui/views-sales.js
 M src/ui/views-weekly.js
 M tests/sales.test.cjs
?? reports/2026-09-18T21-52-07-524Z-fase-2-merma-e-invitacion.md
?? reports/ai-chat-v0290.json
?? reports/design/0290-invitacion-o-consumo.png
?? reports/desktop-smoke-2026-09-18-v0290.txt
?? reports/tests-2026-09-18-v0290.txt
```
