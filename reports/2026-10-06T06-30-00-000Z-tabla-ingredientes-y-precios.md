# Tabla de ingredientes y precios por proveedor · 0.57.0 · 2026-10-05

Pedido del usuario, con dos PDF suyos: (1) «cambiar el inventario, agregar todo esto» —una tabla de balance con la composición de sus ingredientes—, «no inventes datos y sé preciso», con un juez que critique; (2) una lista de ingredientes con proveedor y precio, para tener en cuenta en Compras los más baratos y los «ingredientes estrella», con un agente propio y otro juez.

Los dos PDF son datos reales del negocio y el repositorio es público: no se han copiado a tests/, fixtures ni informes. Las pruebas usan tablas sintéticas; la medición con los archivos reales está en guiones de work/ (fuera de git).

## Lo que se dijo antes de construir (y por qué)
- **No se crean 153 productos de golpe.** La tabla se guarda como biblioteca («Tabla de ingredientes») y desde ella se añaden al inventario los que se marquen. Motivo: cada producto exige proveedor, categoría, unidad y zona, que la tabla no dice (habría que inventarlos), y 153 productos a cero llenarían la hoja de conteo. Se pueden marcar todos si se quiere.
- **Los datos no van dentro de la app:** se leen del PDF del usuario en su equipo. Así la app entregada a otra persona no lleva los datos de este negocio.

## Tabla de ingredientes (composición)
- core/comptable.ts `parseCompositionTable`: lee por posición (cada número va a la columna cuya cabecera tiene más cerca; tolerancia = media separación mínima entre columnas). Nombre en la línea de debajo de sus números: se empareja. Rangos del final («% GELATO…»): no se importan y se dice. Página sin cabecera, fila con un texto entre los números, nombre repetido, valor imposible o nombre de más de 100 letras: a «no se guarda» con su motivo. Sin cabecera en ninguna página: no propone nada.
- Comprobaciones que solo avisan (nada se corrige): cantidad distinta de 100; columnas que faltan (quedan sin valor, no 0); azúcar + grasas + sólidos lácteos + otros ≠ sólidos totales; sólidos + agua ≠ 100; PAC total menor que el de los azúcares.
- Composición del producto ampliada de 4 a 14 valores (PAC y POD son índices, hasta 1000). `product.compositionSource` dice de qué archivo, página y fila salió; si se cambia a mano, se quita.
- Acciones: `importIngredientTable` (el servidor relee el PDF al confirmar: entra lo que dice el archivo, no lo que mande la pantalla), `addTableProducts` (stock 0, sin precio; no duplica un nombre que ya existe), `applyTableComposition` (no toca stock ni precio; no vale para productos por unidades), `clearIngredientTable`.
- Pantalla: Inventario → «Tabla de ingredientes»: subir, vista previa con lo dudoso, buscar, pestañas (fuera/en el inventario, con aviso), «Ver todo», añadir los marcados, usar la de la tabla. Editor de producto con «Composición por 100 g» (14 valores). Balance del Recetario: además de los cuatro valores con rango, agua, otros sólidos, lactosa, proteínas, fibras, PAC y POD (sin rango; «No disponible» si algún ingrediente no lo trae).

### Medición con el PDF real
- work/check-comptable-real.cjs: 153 filas en 4 páginas (41/42/42/28), 14 columnas; 153 de 153 iguales número a número al volcado; 0 filas inventadas; 2 con aviso (una fila sin dos celdas; una con PAC incoherente en la propia tabla); 1 bloque no importado (los rangos).
- Juez (reports/2026-10-06T05-30-00-000Z-juez-tabla-ingredientes.md), por vía independiente (otro lector de PDF y páginas vistas): 153 de 153 filas, sin nombres cruzados ni filas perdidas. 0 críticos.
- work/check-tabla-ingredientes.cjs sobre una COPIA de data/: guardar la tabla deja productos, stock y movimientos igual (14 / 303,6 / 21); añadir tres crea tres productos con stock 0, sin precio y con su fuente; sin desbordamiento a 1280 ni a 1024 px; sin errores de página.

### Lo que señaló el juez y qué se hizo
| Hallazgo | Qué se hizo |
| --- | --- |
| Al añadir, proveedor, kilos, categoría y zona venían preelegidos | Nada preelegido: los cuatro son obligatorios y los elige la persona |
| «Azúcar» con dos significados (la tabla trae la lactosa aparte; fichas antiguas no) | El balance avisa cuando una receta mezcla las dos formas (`mixedSugars`). No se convierte nada |
| Los rangos de la app no son los de su tabla | El texto lo dice («los orientativos de la app, no los de tu tabla»). Usar los suyos queda pendiente: hay que decidir qué fila vale para cada familia |
| Un valor imposible en una fila impedía guardar toda la tabla | Esa fila va a «no se guarda» con su motivo; el resto entra |
| Página sin cabecera ignorada en silencio | Se dice |
| Desbordamiento de 341 px | Corregido (un texto oculto de la cabecera ensanchaba la página); columna «Inventario» junto al nombre |
| Confirmar sin revisión; producto por unidades | Se exige la revisión; se rechaza |
| Sin hacer | Reimportar no retira filas que ya no están; la contraseña del recetario no protege la tabla; emparejar con los productos actuales es solo por nombre idéntico; «Ver todo» no compara antes de sustituir |

## Precios por proveedor (agente en paralelo)
Detalle en reports/2026-10-06T05-00-00-000Z-precios-por-proveedor.md. Resumen: lector por posiciones (core/pricelist.ts), biblioteca `priceList` con filas sin precio o sin proveedor como «No disponible», comparación por grupos (solo se juntan solos los nombres idénticos; lo demás lo junta la persona), estrellas puestas por la persona, lo hecho en casa aparte, «Usar este precio…» con confirmación y cita de lista, página y fila. Medición con el PDF real: 195 de 195 filas, 0 inventadas, 0 cambiadas de columna. Juez: reports/2026-10-06T06-00-00-000Z-juez-precios-por-proveedor.md.

## Pruebas
tests/comptable.test.cjs (7) y tests/pricelist.test.cjs (15). Totales, Ayudante, ejecutable y prueba de escritorio: en CHANGELOG.md.

## No hecho
- Usar los rangos del final de la tabla en el balance (decisión del usuario pendiente).
- Convertir fichas antiguas a la forma de contar el azúcar de la tabla.
- La comparación de precios no entra todavía en la sugerencia de pedido.
- Nada probado en tablet real ni en Mac.
