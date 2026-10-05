# «Preparar» paso a paso, − / + de 500 g y orden de preparación · 0.56.0 · 2026-10-05

Pedido del usuario (captura de CHOCOLOCO con la casilla «Otra cantidad» marcada): subir y bajar de 500 g en 500 g sin perder la cantidad a mano; mejorar el texto de la tarjeta; un botón «Preparar» que guíe ventana por ventana, ingrediente por ingrediente; recetas con su proceso establecido en Recetario y Producción; un agente en paralelo que limpie la app de texto; una lista de mejoras y otro agente que revise la calidad visual y estudie las tablets.

## Qué cambió
- **Kilos a hacer** (src/ui/production-quick.js, quickCard): la casilla «Otra cantidad» pasa a ser «Kilos a hacer», arriba, con − y + grandes. Suben y bajan de medio kilo cayendo siempre en un múltiplo de 0,5 (2,3 y + → 2,5; 2,3 y − → 2; mínimo 0,5). Tocar una tanda escribe sus kilos en la casilla; escribir a mano sigue valiendo (coma o punto).
- **Texto de la tarjeta**: una frase arriba; lo que se gasta, en etiquetas («Para 2,5 kg · Leche entera 1,25 L · …»); en la columna «En stock» solo «faltan X»; aviso de falta en una frase; «Usé otra cantidad de algún ingrediente».
- **«Preparar»**: la misma tarjeta enseña un paso cada vez (ingrediente grande, cantidad para los kilos elegidos, instrucción), con «Anterior» y «Siguiente». «Hecho» solo aparece al final; hasta entonces no se toca el stock. «Hecho» directo sigue en la tarjeta. Una base que se «hace ahora» trae delante sus propios pasos.
- **Orden de preparación** (core/schema.ts recipe.process, acción setProcess en core/domain.ts): pasos con un ingrediente de la receta, una instrucción o las dos cosas; un ingrediente solo puede ir en un paso; fuera de recipeFields, así que editar la receta no lo borra; si se quita un ingrediente, su paso conserva la instrucción. Un ingrediente sin paso sale al final (ninguno se queda fuera). Sin orden propio se sigue la lista de ingredientes. Protegido por la contraseña del recetario (lockedActions en src/server.cjs). No mueve stock. Se edita en el Recetario, dentro de la receta («Orden de preparación»), y la ficha lo enseña como «Preparación paso a paso».
- **Limpieza de textos** (agente en paralelo): 6200 → 5301 palabras en 14 pantallas, sin renombrar botones ni quitar avisos, fórmulas o fuentes. Detalle en reports/2026-10-06T03-00-00-000Z-limpieza-textos.md.
- **Revisión visual y tablets** (agente en paralelo, solo estudio): reports/2026-10-06T03-10-00-000Z-revision-visual-tablet.md, 90 capturas en work/shots-tablet/. La lista de mejoras queda en docs/CHECKLIST_MEJORAS.md.
- Hueco corregido: «Escaneá» (voseo) en la pantalla de WhatsApp.
- Prueba de escritorio: paso nuevo que recorre la producción rápida y «Preparar» (pendiente de TODO.md).

## Pruebas
- tests/production-now.test.cjs: orden de preparación (se guarda, rechaza ingrediente ajeno o repetido, sobrevive a editar la receta, vacío lo quita).
- work/check-preparar.cjs sobre una COPIA de data/ con CHOCOLOCO (receta del usuario): − / + (1 → 1,5 → 2 → 2,5 → 2; 2,3 → 2,5 y 2; mínimo 0,5); orden guardado en el Recetario; «Preparar» enseña «Paso 1 de 3 · Café de especialidad 1,25 kg · Calentar a 45 °C», luego la leche, luego la instrucción suelta, y «Hecho» solo al final; al registrar 2,5 kg: leche 3 → 1,75 L, café −2,1 → −3,35 kg, CHOCOLOCO 10 → 12,5 kg. Sin errores de página. Capturas work/preparar-*.png.
- Ayudante: dos preguntas nuevas; primera pasada 51/52 (la frase de la guía no traía las palabras de la pregunta: se reescribió la guía, no la expectativa; la de «orden» se hizo más estricta). Segunda pasada 52/52 (reports/ai-chat-v0560.json).
- npm test 253/253 (reports/tests-2026-10-05-v0560.txt), formato y tipos bien. Ejecutable 0.56.0 reconstruido. Prueba de escritorio 23 PASS, con el paso nuevo de producción rápida (reports/desktop-smoke-2026-10-05-v0560.txt).

## No hecho
- La revisión visual no se aplicó: es estudio. Los arreglos van por la lista (docs/CHECKLIST_MEJORAS.md).
- No probado en una tablet real ni en Mac.
- Un paso lleva un solo ingrediente; «añadir dos a la vez» se escribe en la instrucción.
