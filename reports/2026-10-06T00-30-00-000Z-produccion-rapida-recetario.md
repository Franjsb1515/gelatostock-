# Producción rápida y Recetario con clave · 0.55.0 · 2026-10-05

Encargos (en la misma tarde):
1. «Mira este vídeo y mejoremos la forma que hacemos la producción» (maqueta en Google Sheets: botones de sabores → receta con tandas fijas → Hecho/Cancelar/Volver; la base blanca como receta aparte). Plan y respuestas: docs/PLAN_PRODUCCION_RAPIDA.md; resumen del vídeo: docs/origen/PEDIDO_PRODUCCION_VIDEO_2026-10-05.md (fotogramas en work/video/, sacados con Electron porque no hay ffmpeg).
2. «Quiero que el recetario tenga clave… solo yo pueda editar, crear, borrar recetas; que sea con botones que abran la descripción del producto».
3. Visto en su captura: la receta «cocadado» tenía 500 L de bebida de avena y 500 L de nata para 1 kg (escribió mililitros en un producto en litros): coste 3.300 €/kg.

Respuestas del usuario: tandas por receta; bases de las dos formas (de la cámara o hechas en el momento); «Hecho» en un paso y **si un ingrediente no llega en la app, dejar hacerlo con aviso aunque quede en negativo**; ordenador y tablet.

## Cambios de reglas (decididos por el usuario, documentados)
- **Stock negativo solo por producción** (antes nunca): `move()` admite un `production` que deja el ingrediente bajo cero; la nota de actividad y el Resumen lo avisan («Stock en negativo tras producir… cuéntalo»). Ventas, mermas, salidas y entradas siguen sin poder dejar negativos (prueba). `productSchema.stock` y `movement.before/after` pasan a `signedQuantity`. **Migración de la base a user_version 6**: la tabla de productos tenía CHECK(stock_milli>=0); se rehace con copia previa completa (`VACUUM INTO backups/antes-v6-*.sqlite`) y comprobación de relaciones; también desde versiones anteriores. Probado con una base de la versión 5 hecha a mano y con la copia de los datos reales (se migró al abrir, sin perder nada).
- **La contraseña del recetario protege editar, no producir**: antes ocultaba ingredientes y bloqueaba producir; ahora bloquea `recipe`, `deleteRecipe`, `setSaleValue`, `setManualCost`, `quickFlavors` y `setBatches`, y con el recetario bloqueado no se envían valor de venta, coste escrito ni notas. Quien produce ve ingredientes y cantidades de la tanda (como en su vídeo). tests/server.test.cjs se actualizó a la regla nueva (con clave: producir 200, editar 400 «protegidas», sin valores de venta).
- Las pruebas que comprobaban «una producción nunca deja negativo» (tests/domain.test.cjs) se actualizaron a la regla nueva, con la explicación en el propio test; se sigue rechazando un stock fuera de rango o que no es un número.

## Qué se hizo
- Núcleo: `proposeProduction` y `approveProduction` (una sola implementación para «produce», «applyProduction» y «produceNow»: sin duplicar movimientos); acción `produceNow` {recipe, quantity, date, lines?, bases[{product, mode stock|now}]}: con «now» se produce primero la base que pide la tanda y se gasta en el momento; `setBatches` (tandas por receta, fuera de recipeFields para que editar la receta no las borre). `sellable`/`sellableIds` en core/sales.ts: un gelato de venta es una receta con producto que no es «base»; usado en día, calendario, ficha de producción, plan, mermas de gelato, pesadas y mínimos (antes la base blanca habría salido como gelato a vender).
- Pantalla: src/ui/production-quick.js (nuevo): botones por sabor (Gelatos, Sorbettos, Bases…) con stock y lo que falta para el objetivo; tarjeta con las tandas en columnas (clic para elegir), cantidades en g/ml, stock y «quedará en …» si no llega, bases «De la cámara / Hacerla ahora», otra cantidad, día, «Corregir lo que de verdad se usó», «Hecho» y «Cancelar». Producción ya no pide clave; «Registrar producción» pasa a «Producción a mano»; fuera la sección repetida «Recetas». Recetario: botones que abren cada ficha («← Todas las recetas», «Tandas para producir… Cambiar tandas»), aviso «Sin contraseña… Poner contraseña». Editor de recetas: unidad por ingrediente (g/kg, ml/L) y aviso si los ingredientes pesan más de 3 veces lo que rinde la receta. Cierre del día sin bases.
- Guía y Ayudante: párrafos nuevos y textos de la clave corregidos; cuatro preguntas nuevas. Primera evaluación 48/50 (dos preguntas recibían otra frase): se añadieron frases directas a la guía → 50/50.

## Pruebas
- npm test 252/252 (reports/tests-2026-10-05-v0550.txt): tests/production-now.test.cjs (un paso; corrección; negativo con aviso y ventas/salidas sin negativo; bases de la cámara y hechas ahora, base fuera de la ficha; tandas que sobreviven a editar la receta) y migración 5→6 en tests/store.test.cjs.
- Recorrido sobre una COPIA de data/ (work/check-produccion-rapida.cjs): 8 kg de Fior di panna con la base hecha ahora (base 0, gelato 8, sin negativos), Recetario en botones con ficha al tocar, contraseña puesta y bloqueado, Producción sigue produciendo. Sin errores de página. Capturas work/prod-*.png y work/recetario-ficha.png.
- Chat 50/50 (reports/ai-chat-v0550.json). Ejecutable 0.55.0, prueba de escritorio 22 PASS (reports/desktop-smoke-2026-10-05-v0550.txt); se actualizaron dos pasos de la prueba al diseño nuevo («Producción a mano» y abrir la ficha del Recetario antes de escalar).

## Limitaciones y pendiente
- La receta «cocadado» del usuario sigue con 500 L: es un dato suyo; al editarla ahora puede escribir 500 ml.
- La prueba de escritorio no recorre todavía la producción rápida (lo cubre work/check-produccion-rapida.cjs).
- Una base de una base (sub-bases encadenadas) con «hacerla ahora» solo hace el primer nivel.
- La contraseña protege la pantalla, no el disco (igual que antes).
