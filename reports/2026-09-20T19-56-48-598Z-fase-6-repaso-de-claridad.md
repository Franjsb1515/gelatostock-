# Sesión 045 (quinta parte) · Fase 6: repaso de claridad · versión 0.33.0

## Encargo
Sexta fase del plan: pequeñas mejoras de claridad en toda la app, con la pregunta de control «¿la hace más clara, rápida, fiable o coherente sin perder identidad?».

## Método
En vez de repasar el código, se leyó la app como la lee el usuario: work/audit-fase6.cjs abre la app sobre una COPIA de data/ y vuelca el texto visible de Resumen, Inventario, Compras, Producción, Recetario, Proveedores, Actividad y Semana en work/audit-fase6.txt. Sobre ese texto se buscaron jerga, avisos de demostración y cosas sin explicar.

## Hallazgos y cambios
1. (Fiabilidad) La hoja diaria del usuario tiene una producción de 1 kg de CHOCOLOCO, hecha antes de activar el gelato. Una producción sin gelato dado de alta no tiene entrada de stock: esos kilos no están en ningún sitio, y al activar el gelato empezaba en 0 sin decirlo. Ahora «Activar» abre un modal que lo explica con su cifra («Ya habías producido 1 kg antes de activarlo…») y pregunta «Kilos que tienes ahora (opcional)»; si se escribe, queda un conteo con motivo propio. No se reconstruye nada por detrás: la app no sabe cuánto queda y lo dice.
2. (Claridad) Una propuesta de producción de un gelato sin activar solo decía, en gris, «Esta receta no tiene producto terminado asociado». Ahora es un aviso con lo que pasa si se aprueba así y el botón para activarlo. Para recetas de la familia «base» el texto es neutro.
3. (Coherencia) Con datos reales seguían saliendo «Precios de demostración» (inicio), «Los precios son ficticios» y «Registro de demostración» (Compras) y «Pedidos de demostración autorizados» (Actividad). Sustituidos por lo que de verdad ocurre.
4. (Claridad) «cantidades en su unidad base» (Inventario) pasa a «cada cantidad en su unidad (kg, L o ud)»; «Aprobar crea movimientos de salida por producción…» pasa a «Al aprobar, los ingredientes salen del stock y el gelato hecho entra.»
5. (Coherencia) Últimos «producto terminado» en mensajes del núcleo y en el motivo del movimiento de entrada, que ahora es «Gelato hecho: nombre (día)». Ningún lector depende de ese texto (comprobado con grep en core/ y tests/).

6. (Coherencia) Dos mensajes en voseo para un usuario de Palma: «Revisalo antes de autorizar» (núcleo) y «Probá una foto más pequeña o elegí el proveedor» (OCR). Corregidos; ninguna prueba dependía de ellos.

## Lo que no se tocó, y por qué
- «Simulación», «Simular envío» y «Envío simulado» en Compras: no es solo texto, es el modelo de pedidos (simulated: true). Va con Compras y Mensajes II; anotado en TODO.
- «unidad base» en los formularios de Inventario: la prueba de escritorio localiza esos campos por nombre; anotado en TODO.
- Los apuntes antiguos de Actividad conservan su redacción: son registro histórico y no se reescriben.

## Tests
- Prueba nueva en tests/value.test.cjs: el apunte de entrada de una producción dice «Gelato hecho: …» y sigue contando como producido en el resumen del día y en el informe de valor; la nota de authorize ya no habla de demostración.
- work/check-fase6-copia.cjs sobre una COPIA de data/, por la interfaz: aviso al producir sin activar; modal «Ya habías producido 1 kg antes de activarlo…»; con 0,75 kg escritos, el cierre lista «CHOCOLOCO 0,75 kg» y el resumen del día lo enseña como ajuste de inventario +0,75 kg; en Resumen, Inventario, Compras, Producción y Recetario, 0 apariciones de «producto terminado», «demostración», «ficticios» y «unidad base»; sin errores de consola.

## Incidencias
- La prueba de escritorio falló una vez en page.screenshot: Timeout (pantalla suspendida a mitad de ejecución, fallo conocido); repetida con el equipo activo, 18 PASS y salida 0.

## Limitaciones
- Es una primera pasada hecha por quien construyó la app. La que de verdad cuenta es la del usuario tras usarla unos días: queda pedida en TODO y va antes que Compras y Mensajes II.

## Evidencia final
- npm test: 175 aprobadas (reports/tests-2026-09-20-v0330.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.33.0-win32-x64.
- npm run test:desktop: 18 PASS (completa). reports/desktop-smoke-2026-09-20-v0330.txt.
- node scripts/evaluate-ai.cjs --chat: 23/23 (reports/ai-chat-v0330.json).

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M docs/CONTINUIDAD.md
 M docs/GUIA_USO.md
 M docs/PLAN_PRODUCCION_VENTAS_CAJA.md
 M package-lock.json
 M package.json
 M src/ai-help.cjs
 M src/ocr.cjs
 M src/ui/actions.js
 M src/ui/guide.js
 M src/ui/views-orders.js
 M src/ui/views-production.js
 M src/ui/views.js
 M tests/value.test.cjs
?? reports/2026-09-20T19-56-48-598Z-fase-6-repaso-de-claridad.md
?? reports/ai-chat-v0330.json
?? reports/desktop-smoke-2026-09-20-v0330.txt
?? reports/tests-2026-09-20-v0330.txt
```
