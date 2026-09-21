# Sesión 047 (tercera parte) · Objetivo de merma por producto · versión 0.40.0

## Encargo

Del usuario, el 2026-09-21, contestando a las dos preguntas abiertas de la versión anterior: **«por producto y en kilos, también añade la opción de porcentaje»**. Así que el objetivo es de cada producto, escrito en su unidad, y además se puede escribir en porcentaje.

## Qué cambia en pantalla

- **Inventario → en cada fila, «Objetivo de merma»**. Se elige cómo se mide —«En kilos (no más de X kg)», con la unidad de ese producto, o «En porcentaje de lo que salga»— y se escribe el número. El botón pasa a enseñar el objetivo puesto («Merma: 2 kg», «Merma: 5 %»). **Escribiendo 0 se quita.**
- El modal dice antes de nada **cómo va ese producto**: «Estos 7 días: 0,25 kg de merma sobre 0,75 kg que salieron · 33,3 %».
- **Resumen de inicio**: si algún producto se pasa, aparece el aviso con la cuenta entera y el objetivo, sin redondeos escondidos: «Café de especialidad: 0,25 kg de merma en 7 días sobre 0,75 kg que salieron (33,3 %); tu objetivo es 0,1 kg.»
- **Inventario**: la fila de ese producto se marca con «Merma por encima» junto al estado del stock.

## Lo que no hace

- **Solo avisa.** No cambia stock, ni pedidos, ni precios, ni el objetivo de producción. No propone comprar menos ni producir menos.
- **No inventa el periodo ni el denominador.** Son siempre los **últimos 7 días** y la fórmula está escrita en la pantalla: merma ÷ todo lo que salió del producto (ventas, consumo de producción, mermas e invitaciones) × 100.
- **Un conteo no es una salida**: un ajuste de inventario no entra en la cuenta, ni como merma ni como salida. Lo mismo que en el resumen del día, donde un conteo que no cuadra nunca se convierte en merma.
- Si no ha salido nada del producto en esos días, el porcentaje es **«No disponible»** (null), no 0: con un objetivo en porcentaje, entonces no avisa.
- Un movimiento deshecho, y su compensación, no cuentan.

## Núcleo

- **core/schema.ts**: `wasteGoal { mode: "quantity" | "pct", value, at }` en `productSchema`, **fuera de `productFields`** a propósito: editar la ficha del producto no lo borra (la misma decisión que con el valor de venta de una receta). Acción nueva `setWasteGoal { product, mode, value }`.
- **core/domain.ts · `setWasteGoal`**: guarda el objetivo, rechaza un porcentaje mayor que 100 y, con `value` 0, lo quita (y avisa si no había ninguno). Deja la nota en Actividad con el objetivo escrito.
- **core/sales.ts · `wasteGoals(state, días = 7, hoy)`**: por cada producto con objetivo, la merma y lo que salió en esos días, el porcentaje derivado y si se pasó. El día de un movimiento de cierre es su **día de negocio**; el de un movimiento de inventario, su día natural.
- **Servidor**: viaja en el sobre de estado como `alerts.waste`, junto a los otros avisos.
- **Interfaz**: modal y botón por fila (src/ui/actions-extended.js, src/ui/views.js) y aviso en el inicio.

## Trampa encontrada (y anotada)

La acción de la interfaz se llamaba `wasteGoal` y **no abría nada**: `src/ui/actions.js` manda al canal de WhatsApp todo lo que empiece por `wa`, así que `wasteGoal` acababa en `whatsappAction`. Se vio en la primera pasada de work/check-objetivo-merma.cjs (el modal nunca aparecía). La acción pasa a llamarse `setWasteGoal` y queda un comentario en ese punto de actions.js y una línea en CLAUDE.md para que no vuelva a pasar.

## Pruebas

- `npm test`: **195 pruebas, 0 fallos** (salida en reports/tests-2026-09-21-v0400.txt). Nueva en tests/sales.test.cjs: sin objetivo no hay nada que mirar; con objetivo en litros, 0,5 de merma sobre 3,5 de salida no avisa y 1,3 sí; el mismo caso en porcentaje (30,2 %) no avisa con objetivo del 40 % y sí con el del 25 %; un conteo no cambia ni la merma ni lo que salió; deshacer una merma la saca de la cuenta; un porcentaje de 140 se rechaza; con 0 se quita; y editar la ficha del producto **no** borra el objetivo.
- `npm run typecheck` y `npm run format:check`: limpios.
- `npm run package:win`: ejecutable 0.40.0 reconstruido (work/audit-package-0400.txt).
- `npm run test:desktop`: **no termina en este equipo ahora mismo**. La comprobación nueva **sí pasó** (objetivo de 0,1 kg sobre un producto con 0,2 kg de merma, el aviso del inicio con su texto exacto, y el objetivo quitado con 0 haciendo desaparecer el aviso): en la pasada que llegó más lejos se ejecutó sin fallo, junto con los quince primeros bloques. A partir de ahí la prueba se corta en `page.screenshot: Timeout`, que es el síntoma que CLAUDE.md documenta como **pantalla del equipo suspendida**; se repitió tres veces con el mismo corte, cada vez en un punto distinto. Queda pendiente de repetirla con el equipo despierto: `npm run test:desktop`. Salida en work/desktop-0400.log. De paso, la prueba encontró un fallo propio de esta sesión: `.home-notice` ya no es único en el inicio (el resumen del día usa la misma clase), y la comprobación nueva pedía el primero.
- `node scripts/evaluate-ai.cjs --chat`: **32/32**, con un caso nuevo (ponerse un tope de merma para un producto). Salida en work/audit-chat-0400.txt. La primera ejecución terminó con código de salida 1 pese a pasar los 32 casos y sin escribir ningún error; repetida, termina con 0. No se ha encontrado la causa; queda anotado por si se repite.
- **Sobre una COPIA de los datos reales** (work/check-objetivo-merma.cjs, salida en work/check-objetivo-merma.txt): con su café, objetivo de 0,1 kg; el botón de la fila pasa a «Merma: 0,1 kg» y todavía no avisa; al apuntar 0,25 kg de merma, el aviso del inicio dice «0,25 kg de merma en 7 días sobre 0,75 kg que salieron (33,3 %); tu objetivo es 0,1 kg»; cambiado a un objetivo del 90 %, el mismo 33,3 % ya no avisa. Sin errores de consola.

## Límites que quedan

- **La ventana son 7 días fijos.** No se puede elegir otro plazo ni mirar el mes. Se dijo así en pantalla en vez de hacerlo configurable sin que él lo pidiera.
- El aviso vive en el inicio y en la fila del producto; **no** hay historial de cuándo se pasó ni aviso en Windows.
- Una merma de ingrediente cuenta por su día natural, no por el día de negocio (el cierre del día sí usa el de negocio).
- El objetivo no se puede poner a varios productos a la vez ni por categoría.
- Nada de esto está medido con sus datos reales de varias semanas: es una cuenta de sus propios movimientos, no una previsión.
