# Plan · Producción rápida por sabor (como el vídeo)

Origen: docs/origen/PEDIDO_PRODUCCION_VIDEO_2026-10-05.md (no releer).

## Hoy (0.54.0)
Producción → «Registrar producción»: elegir receta en una lista, escribir kilos y día → «Calcular consumo» → propuesta → revisarla y «Aprobar». Dos pasos y nada visual. El Recetario ya escala una receta a otros kilos y ya existe la familia «Base», pero una base con producto propio se trata como un gelato que se vende (ficha de producción, ventas).

## Lo que pide el vídeo y cómo encaja
- **Pantalla de sabores en botones** (gelatos, sorbettos y bases aparte), grandes, para el obrador. Cada botón puede decir lo que falta para el mínimo o el objetivo.
- **Tarjeta de la receta** con las cantidades ya calculadas para **tandas fijas** (1, 4, 8, 16, 30, 60 kg; la base, 1, 4, 8, 55), en gramos como su hoja, y una tanda libre.
- **«Hecho»** registra la producción de esa tanda: descuenta ingredientes y suma el gelato (hoy son dos pasos). «Cancelar» y «Volver».
- **Bases como producto propio:** se hace la base blanca (descuenta leche, nata, azúcar…), queda en la cámara con su stock, y cada sabor la descuenta como ingrediente. Las bases no son gelato de venta: fuera de la ficha de producción del Calendario, ventas y mínimos.

## Lo que no encaja tal cual
- La app guarda las cantidades por kilo de receta y en la unidad de cada producto (kg, L): 860 g de base por kilo = 0,86 kg. Se puede mostrar en gramos como la hoja; por dentro sigue en kg.
- Un «Hecho» de un solo paso quita la revisión de hoy: hace falta poder corregir lo que de verdad se usó (si se puso menos nata) antes o después de «Hecho».
- Si se hace un sabor y no hay base suficiente en stock, la app debe avisar (no dejar el stock en negativo).

Estado: hecho en 0.55.0 (2026-10-05).

## Respuestas del usuario (2026-10-05)
1. Tandas: cada receta las suyas (por defecto 1, 4, 8, 16, 30, 60 kg).
2. Bases: las dos formas. Al producir un sabor, para cada base: «de la cámara» (descuenta la base en stock) o «hacerla ahora» (se produce la base que hace falta y se usa en el momento).
3. «Hecho» en un paso, con opción de corregir cantidades. **Cambio de regla pedido por el usuario:** si un ingrediente no llega en el stock de la app (5 L de leche y la app dice 2), la producción se registra igual y el ingrediente queda en negativo (−3 L) con un aviso para revisarlo con un conteo. Solo para lo que consume una producción; ventas, mermas y salidas siguen sin dejar negativos.
4. Ordenador y tablet: botones grandes que funcionen con ratón y con el dedo.

## Preguntas abiertas (al usuario)
1. Tandas: ¿las mismas para todos los sabores o cada receta las suyas?
2. Bases: ¿se hacen aparte y se guardan (stock propio) o siempre junto con el sabor?
3. «Hecho»: ¿registrar en un paso, con opción de corregir cantidades, o seguir con propuesta + aprobar?
4. ¿Dónde se usará: ordenador del obrador o tablet?
