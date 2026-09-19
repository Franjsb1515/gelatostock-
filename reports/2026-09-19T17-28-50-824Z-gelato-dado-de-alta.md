# Sesión 045 (tercera parte) · Corrección 0.31.1: la receta da de alta su gelato

## Qué dijo el usuario
«Sale el precio estimado pero no deja colocar el precio que le coloco yo al gelato en el recetario y producción; las mermas no funcionan y tampoco las ventas.» Después: «¿Qué es producto terminado? Eso no lo entiendo.»

## Causa (verificada en sus datos, en solo lectura)
Su única receta, CHOCOLOCO, no tenía recipe.product. Sin él: setSaleValue se rechaza, el cierre del día no lista ningún gelato y no hay ventas ni mermas. El editor de recetas traía elegido «Sin producto terminado», exigía que el gelato existiera ya en Inventario y no explicaba nada. Las fases 3 y 4 se probaron solo con la receta de demostración, que sí lo tenía: por eso no se vio. Es un fallo de diseño y de verificación de esta sesión, no del usuario.

## Hecho
- Acción recipe con createProduct: da de alta el gelato (kg, stock 0, mínimo y objetivo 0 para que Compras nunca lo proponga, precio 0, zona vitrina) con el nombre de la receta, bajo el proveedor interno «Elaboración propia», que se crea si falta. Si ya existe un producto en kg con ese nombre y no es ingrediente de la receta, lo reutiliza. No duplica nada al repetirse.
- Editor: en recetas nuevas viene elegido «El de esta receta: se crea solo con su nombre (recomendado)»; la otra opción es «Ninguno: es una base o pasta que no se vende».
- Botón de un clic «Activar ventas y valor de este gelato» en la ficha del Recetario y, con el nombre de cada receta, en el cierre del día cuando está vacío.
- «Producto terminado» sustituido en la interfaz por «gelato», «gelato hecho» o «gelato en stock»; también en el mensaje de error de setSaleValue.

## Cambio de expectativas en pruebas (explicado)
- tests/value.test.cjs: la prueba de que setSaleValue se rechaza sin gelato comprobaba el texto /producto terminado/. El mensaje cambió de redacción, así que la expresión pasa a /no está dado de alta para vender/ y el título de la prueba también. Sigue comprobando lo mismo: que se rechaza.

## Tests
- Prueba nueva: receta nueva con createProduct, gelato creado con sus campos, proveedor interno, nunca propuesto en Compras, y el camino completo que fallaba (valor, producción, venta y merma: 80 € y 20 €); activar una receta existente y no duplicar al repetir.
- work/check-copia-real.cjs sobre una COPIA de data/ (los originales no se tocan), todo por la interfaz: antes «CHOCOLOCO (sin gelato)» y cierre vacío; tras un clic, valor 100,00 €/kg, coste calculado 12,83 €/kg con su fórmula, producción de 1 kg aprobada, cierre con 0,8 kg vendidos y 0,2 kg de merma; resumen del día 80,00 € y 20,00 €; informe de coste 12,83 €, 2,57 € y 10,26 €; sin errores de consola.
- Evaluación del chat: caso nuevo activar_gelato (22 casos).

## Limitaciones
- Los datos reales del usuario no se han modificado: tiene que pulsar él «Activar ventas y valor de este gelato» en CHOCOLOCO.
- «Elaboración propia» aparece en la lista de Proveedores; es interno y no se le pide nada.

## Evidencia final
- npm test: 171 aprobadas (reports/tests-2026-09-19-v0311.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.31.1-win32-x64.
- npm run test:desktop: 17 PASS (completa). reports/desktop-smoke-2026-09-19-v0311.txt.
- node scripts/evaluate-ai.cjs --chat: 22/22 (reports/ai-chat-v0311.json).

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
 M package-lock.json
 M package.json
 M src/ai-help.cjs
 M src/ui/actions.js
 M src/ui/guide.js
 M src/ui/views-production.js
 M src/ui/views-sales.js
 M tests/fixtures/ai-chat.json
 M tests/value.test.cjs
?? reports/2026-09-19T17-28-50-824Z-gelato-dado-de-alta.md
?? reports/ai-chat-v0311.json
?? reports/desktop-smoke-2026-09-19-v0311.txt
?? reports/tests-2026-09-19-v0311.txt
```
