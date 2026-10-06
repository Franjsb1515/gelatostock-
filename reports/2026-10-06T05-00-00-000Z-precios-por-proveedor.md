# Precios por proveedor (lista de precios en PDF)

Fecha: 2026-10-06. Fase 4 de docs/PLAN_COMPRAS_MENSAJES_II.md, en la parte que ya se puede hacer: ha llegado la primera lista real (un PDF de 6 páginas con texto dentro). La parte de fotos de tarifas sigue pendiente.

Este informe no lleva nombres de proveedores ni precios reales: el repositorio es público. La lista real y sus volcados están solo en work/ (fuera de git).

## Qué se hizo

- **Lectura por columnas** (`core/pricelist.ts`, `parsePriceList`). Exige una cabecera con ingrediente, proveedor y coste. Cada texto va a la columna en la que está escrito: un importe sin proveedor no se convierte en proveedor. Precio en céntimos enteros; sin precio = «No disponible» (nunca 0); un 0,00 € se guarda como 0 y se marca como dudoso. Lo que no se entiende se aparta con su motivo y no se guarda. Sin cabecera, no propone nada y lo dice.
- **Guardado como biblioteca**, no como productos: `state.priceList`, `state.priceLinks` y `state.priceStars` (en meta). El servidor vuelve a leer el PDF al confirmar (`POST /api/pricelist`): lo que entra es lo que dice el archivo, no lo que mande la pantalla. Guardar no toca productos, precios ni stock.
- **Comparación** (`priceGroups`). Dos filas son el mismo ingrediente solo si el nombre es igual sin tildes, mayúsculas ni signos. Todo lo demás lo junta la persona a mano y se puede separar. Por grupo: de más barato a más caro, el más barato marcado, el siguiente y la diferencia con su fórmula a la vista.
- **Ingredientes estrella**: los marca la persona. La app no decide ninguno.
- **Usar un precio en un producto** (acción `usePriceRow`): siempre con confirmación, con la cuenta a la vista (precio de la lista × lo que trae el paquete) y dejando en el historial archivo, página y fila. Si el proveedor de la lista es el habitual del producto, cambia el precio de su ficha; si no, queda apuntado como «otro proveedor» y el habitual no cambia. Un proveedor que no existe solo se crea marcando una casilla.
- **Pantalla**: Compras → «Precios por proveedor». Subir PDF, vista previa con recuento y lo dudoso, «Guardar la lista»; después la comparación con «Solo estrella», «Con varios proveedores» y buscador. Lo hecho en casa va aparte, plegado.

## Reglas (no degradar)

- Ninguna lectura cambia un precio sola. Guardar la lista no cambia nada del inventario.
- Sin precio no es 0. Un precio 0, una fila sin precio o sin proveedor no cuentan como «el más barato».
- Lo marcado como elaboración propia nunca compite como proveedor ni se puede usar como precio de compra.
- La recomendación es una regla visible: «Más barato: X a N €; el siguiente cuesta un N % más». Con un solo proveedor no hay recomendación.
- La pantalla nunca dice «misma marca» ni «igual calidad»: la lista no lo dice. Si el grupo lo juntó la persona, se avisa.
- La lista no dice si cada precio es por litro, por kilo o por unidad: se enseña «por litro, kilo o unidad» y, al usar un precio, se pide comprobarlo contra la unidad del producto.
- No se cambia el proveedor habitual de ningún producto.

## Medición

Lista real (`node work/check-pricelist-real.cjs`):

| | Verdad | Leído |
|---|---|---|
| Filas | 195 | 195 |
| Por página | 35·35·35·35·35·20 | 35·35·35·35·35·20 |
| Con precio / sin precio | 164 / 31 | 164 / 31 |
| Con proveedor / sin proveedor | 176 / 19 | 176 / 19 |

- Idénticas en página, nombre, proveedor y precio: 195 de 195. Filas inventadas: 0. Filas que faltan: 0. Datos cambiados de columna: 0. Apartadas: 0.
- 21 proveedores, 14 elaboraciones de la casa, 1 fila dudosa (precio 0).
- 165 ingredientes; 12 con más de un proveedor con precio (juntados solo por nombre idéntico).
- Límite de esta medición: la «verdad» sale de un volcado del texto del mismo PDF, repasado a mano fila a fila. Prueba que cada dato cae en su columna y que no se inventa ni se pierde nada; no prueba una lectura distinta del archivo (no hay otra: el texto va dentro del PDF y no se usa lectura de imagen).

Pruebas: `tests/pricelist.test.cjs`, 15 pruebas con una tabla inventada de la misma forma. `npm test`: 273 de 273. `npm run typecheck` y `npm run format:check`: bien.

Pantalla (`node work/check-pricelist-ui.cjs`, sobre una copia de los datos, con el PDF real): 24 comprobaciones bien, 0 errores de página; a 1024 px sin desbordar y los 318 botones visibles miden al menos 44 px. Capturas en work/pricelist-*.png.

## Qué NO se hizo y por qué

- **Fotos de tarifas en papel**: sigue sin material real para medir. Esta entrega solo lee PDF con texto dentro.
- **Usar los precios en el carrito sin pasar por un producto**: el carrito trabaja con productos del inventario. La lista es una biblioteca; el precio llega al carrito cuando se apunta en un producto.
- **Cambiar el proveedor habitual desde la comparación**: a propósito. Se hace en la ficha del producto.
- **Memoria de equivalencias** entre el nombre de la lista y el producto del inventario: hoy solo se propone el producto si se llama igual. No se recuerda la elección.
- **Unidad de cada precio**: la lista no la trae. No se deduce.
- **Proveedor nuevo**: se crea con el nombre de la lista y sus iniciales. Categoría y entrega quedan con los textos «Sin clasificar» y «Sin datos de entrega», porque la ficha de proveedor no admite esos campos vacíos; el teléfono no se rellena.
- **Prueba del servidor para `/api/pricelist`** en tests/server.test.cjs: no añadida; la ruta se ha ejercitado de punta a punta con el guion de pantalla.
- Sin paquete, sin prueba de escritorio y sin commit (los hace la sesión principal).

## Decisiones para el dueño

1. ¿Cuáles son los ingredientes estrella? Se marcan en la pantalla, uno a uno.
2. Los nombres parecidos (por ejemplo, la misma leche con y sin marca) no se juntan solos. ¿Cuáles son de verdad lo mismo para comprar? Se juntan marcando las filas.
3. Hay filas con precio y sin proveedor, y filas sin precio: ¿se completan en la lista y se vuelve a subir?
4. Una elaboración de la casa figura a 0,00 €: ¿es un dato pendiente?
5. Cada precio de la lista, ¿es siempre por kilo o litro, o hay productos por unidad o por caja? De eso depende que el precio por paquete salga bien al apuntarlo.
6. ¿Conviene que la app recuerde a qué producto del inventario corresponde cada nombre de la lista?

## Archivos

Nuevos: core/pricelist.ts, src/ui/views-pricelist.js, tests/pricelist.test.cjs. Tocados con bloques propios: core/schema.ts, core/domain.ts, core/seed.ts, core/inventory.ts, src/server.cjs, src/index.html, src/styles.css (al final), src/ui/core.js, src/ui/actions.js, src/ui/views-orders.js. Fuera de git: work/check-pricelist-real.cjs, work/check-pricelist-ui.cjs.
