# Sesión 045 (cuarta parte) · Fase 5: qué producir hoy y Resumen · versión 0.32.0

## Encargo
Quinta fase de docs/PLAN_PRODUCCION_VENTAS_CAJA.md: recomendación por reglas (objetivo − stock, con la venta media reciente al lado) e indicadores del día en el inicio. Sin predicción.

## Decisiones
- La única recomendación es objetivo − stock. La venta media y «da para» se enseñan al lado como hechos, con la fórmula escrita debajo de la tabla; no ajustan el objetivo ni proponen nada.
- Venta media = kilos vendidos en los 14 días anteriores a hoy ÷ días con algún cierre registrado en ese periodo. Hoy no entra (el día no ha acabado). Se divide por días con cierre, no por 14, para que los días sin apuntar no bajen la media en falso. Sin cierres: «No disponible».
- El objetivo se escribe en la propia tabla, en palabras del usuario («Quiero tener»), porque el gelato que la app da de alta nace con objetivo 0 y el usuario no tiene por qué ir a Inventario.
- La merma y la invitación no cuentan como venta en la media.

## Hecho
- core/plan.ts: businessDay, productionPlan, todayBrief. Acción setGoal. GET /api/plan. alerts.day en el sobre de estado.
- Producción: panel «Qué producir hoy» (Hay · Quiero tener · Falta · Venta media al día · Lo que hay da para · Producir X kg). El modal de producir se abre con los kilos que faltan.
- Inicio: cuatro indicadores del día (producido, venta estimada, merma, gelato que queda) y avisos de qué falta producir y de ayer sin confirmar, con «Revisarlo», que abre el resumen de ese día.

## Corregido de paso (hueco verificado)
- Quedaba un «producto terminado» en la pantalla de Producción («…y la entrada del producto terminado»), contra la regla nueva de CLAUDE.md. Sustituido por «gelato hecho en el stock».
- En el inicio, «Venta estimada: No disponible» no decía por qué. Ahora dice «Falta escribir el valor de venta en el Recetario» (visto al recorrer la copia de los datos reales).

## Tests
- tests/plan.test.cjs, 3 pruebas, con una receta creada como las del usuario (createProduct) y no solo con la demo: sin objetivo ni cierres nada se propone; objetivo, media con dos días de cierre (merma e invitación fuera), «da para», por encima del objetivo no falta nada, setGoal rechazado para un ingrediente y mínimo ajustado; indicadores del día, ayer sin confirmar y día cerrado; ruta /api/plan con permisos y alerts.day en el sobre.
- Prueba de escritorio: paso nuevo (objetivo por la interfaz, «Producir 2 kg», modal con 2 kg, indicadores del inicio).
- Evaluación del chat: caso nuevo que_producir (23 casos).
- work/check-fase5-copia.cjs sobre una COPIA de data/, todo por la interfaz: CHOCOLOCO activado, objetivo 3 kg, «Producir 3 kg» abre el modal con 3, tras aprobar «Falta: Nada»; con 0,8 kg vendidos y 0,2 kg de merma el inicio dice «Producido hoy 3 kg · Merma de hoy 0,2 kg · Gelato que queda 2 kg»; venta media «No disponible» porque en sus datos aún no hay cierres anteriores; sin errores de consola.

## Incidencias
- La prueba de escritorio falló una vez en page.screenshot: Timeout (pantalla suspendida, fallo conocido); repetida con el equipo activo, 18 PASS y salida 0.

## Limitaciones
- La media usa 14 días fijos; no es configurable.
- El objetivo es un solo número por gelato: no distingue días de más venta (fin de semana, cruceros). Cruceros sigue siendo información aparte.
- Siguiente: fase 6, repaso transversal de claridad.

## Evidencia final
- npm test: 174 aprobadas (reports/tests-2026-09-19-v0320.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.32.0-win32-x64.
- npm run test:desktop: 18 PASS (completa). reports/desktop-smoke-2026-09-19-v0320.txt.
- node scripts/evaluate-ai.cjs --chat: 23/23 (reports/ai-chat-v0320.json).

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M docs/CONTINUIDAD.md
 M docs/GUIA_USO.md
 M docs/PLAN_PRODUCCION_VENTAS_CAJA.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/server.cjs
 M src/ui/actions.js
 M src/ui/guide.js
 M src/ui/views-production.js
 M src/ui/views-sales.js
 M src/ui/views.js
 M tests/fixtures/ai-chat.json
?? core/plan.ts
?? reports/2026-09-19T18-30-44-856Z-fase-5-que-producir-hoy.md
?? reports/ai-chat-v0320.json
?? reports/desktop-smoke-2026-09-19-v0320.txt
?? reports/tests-2026-09-19-v0320.txt
?? tests/plan.test.cjs
```
