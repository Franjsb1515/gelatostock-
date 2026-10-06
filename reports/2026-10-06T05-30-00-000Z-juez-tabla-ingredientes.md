# Juez · Tabla de ingredientes (composición por 100 g)

Fecha: 2026-10-05. Revisión independiente del trabajo sin confirmar (core/comptable.ts, acciones de
la tabla, pantalla «Tabla de ingredientes», balance ampliado). No se ha tocado src/, core/, tests/,
scripts/ ni docs/. Guiones del juez en work/ (prefijo `juez-`), fuera de git.

## Veredicto

1. **Los datos leídos son exactos.** 153 de 153 filas coinciden con el PDF por una vía distinta
   (PDFium en vez de pdf.js, columna por orden y no por posición). Ningún dato falso ni inventado
   en la lectura. No hay hallazgo CRÍTICO.
2. **Lo flojo está alrededor de la lectura**: al pasar una fila al inventario se proponen por
   defecto un proveedor, una unidad y una categoría que la tabla no dice, y el balance del
   Recetario mezcla dos significados de «azúcares» y usa rangos que contradicen los de la propia
   tabla del dueño.
3. **El lector pierde filas en silencio** en dos casos que el PDF real no tiene pero otro PDF sí
   (página sin cabecera; fila detrás de un nombre que empieza por «%»).
4. **La pantalla no cabe a 1280 px**: la columna con la casilla «Añadir» queda fuera de la vista.
5. Biblioteca en vez de 153 productos: decisión defendible, pero es una interpretación de «agregar
   todo esto» que hay que contarle al dueño; tal como está no es todavía «una gran mejora» del
   inventario. Apto para seguir, no para cerrar versión sin arreglar los ALTO.

## Hallazgos

| # | Gravedad | Hallazgo | Evidencia | Por qué importa | Arreglo |
|---|---|---|---|---|---|
| 1 | ALTO | Al añadir al inventario, el proveedor viene ya elegido (el primero de la lista), la unidad en «Kilos», la categoría «Gelatería» y la zona «Almacén»; además pack 1. | `node work/juez-pantalla.cjs` → `por defecto: {"supplier":"Origen Coffee","category":"Gelatería","unit":"Kilos","zone":"Almacén"}`; ocho pastas quedaron con proveedor «Origen Coffee». src/ui/views-ingredients.js:275-292; core/domain.ts caso `addTableProducts` (`pack: 1`). | El texto avisa («La tabla no dice proveedor, unidad ni zona»), pero con «Marcar los que se ven» + un clic 152 productos quedan atribuidos a un proveedor que nadie eligió, y leches, natas y licores en kilos. Es rellenar lo que la fuente no dice. | Sin valor por defecto en proveedor y unidad (opción vacía obligatoria) o un proveedor «Sin asignar»; marcar esos productos como «pendiente de completar» en Inventario. |
| 2 | ALTO | «Azúcares» significa dos cosas. La columna AZUCAR de la tabla no incluye la lactosa; los productos que ya existían la incluyen (core/seed.ts:162, leche con azúcares 4,8). El balance los suma igual. | `node work/juez-casos.cjs`, caso 10: misma receta (8 kg de leche + 2 kg de azúcar) → 23,8 % «alto» con la leche antigua y 20 % «en rango» con la de la tabla. | El mismo gelato sale bien o mal según de dónde venga la ficha, sin ningún aviso. Un valor cambia de significado. | Decidir una convención (la de la tabla: azúcar sin lactosa, lactosa aparte) y avisar en el balance cuando una receta mezcle productos «de la tabla» y «escritos a mano»; etiqueta única («Azúcar (sin lactosa)»). |
| 3 | ALTO | Los rangos del balance (core/balance.ts:17-19) contradicen los que trae la tabla del dueño al final de la página 4, que se descartan. | App, «crema»: azúcares 16–22, grasa 4–9, sólidos 32–42, lácteos no grasos 8–11. Tabla, «% GELATO»: 18–22, 7–16, 37–46, 7–12 (captura work/juez-tmp/juez-p4-crop.png). PAC y POD, que la tabla sí acota (25–31 y 12–22), salen como «informativo». | La app juzga sus recetas con una vara que no es la suya teniendo la suya delante. | Leer esas filas como rangos de referencia (propuesta que la persona confirma, citando la tabla) y usarlos por familia, también para PAC y POD. Mientras tanto, decir en pantalla que los rangos son los de la app, no los de la tabla. |
| 4 | ALTO | Un solo valor fuera de límites o un nombre largo impide guardar la tabla entera, con un mensaje técnico en inglés. Contradice «se guardan tal cual, sin corregir». | `node work/juez-casos.cjs`, casos 4 y 5: «Revisa los datos: rows.1.composition.sugars: Too big: expected number to be <=100» y «rows.1.name: Too big: expected string to have <=100 characters»; filas guardadas: 0. El lector acepta hasta 9999 (core/comptable.ts:79) y el esquema 100 / 1000. | La propuesta enseña «Azúcar pasa de 100» como aviso guardable y luego no se guarda nada. La persona no puede entender el error. | En el lector: esas filas van a «No se guarda» con motivo en castellano (valor imposible, nombre demasiado largo) y el resto se guarda. |
| 5 | ALTO | Una página sin cabecera se ignora entera y no se dice. | Caso 1 de `juez-casos.cjs`: dos páginas, la segunda sin cabecera → «filas: Uno», «no importado: —». core/comptable.ts:110 (`if (!headRow) return;`). | Tabla exportada con cabecera solo en la primera página: se pierden todas las filas siguientes sin aviso. El PDF real repite cabecera, por eso no se ha visto. | Reutilizar las columnas de la página anterior o, como mínimo, añadir a «No se guarda»: «Página N: no tiene cabecera, no se ha leído». |
| 6 | ALTO | A 1280 px la pantalla desborda: la columna «Inventario» (casilla «Añadir») y «Ver todo» quedan fuera. | `juez-pantalla.cjs`: a 1280 → página 1621 px (341 de más), tabla 1458 en caja de 999; a 1024 → 378 de más; a 820 → 582. Captura work/juez-tmp/juez-tabla-1280.png (barra horizontal de página). | La acción principal no se ve sin desplazar toda la página de lado; en tablet es peor. | Columna de nombre y de estado fijas, cabeceras cortas en dos líneas («Sólidos lácteos / no grasos»), y que el desplazamiento sea de la tabla, no de la página (algo hace crecer el contenedor: `desbordaPagina` > 0 pese a `overflow-x: auto`). |
| 7 | MEDIO | Una fila cuyo nombre empieza por «%» corta la lectura de la página; lo que viene detrás se pierde bajo el rótulo «Rangos de referencia». | Caso 3: «% Cacao» y «Después del %» no salen ni se nombran. core/comptable.ts:167-176. | Pérdida silenciosa con un mensaje que no es verdad para esa fila. | Cortar solo si además hay celdas con forma «n - n»; si no, tratarla como fila normal. |
| 8 | MEDIO | Volver a subir el mismo archivo no quita las filas que ya no trae, y los productos creados antes siguen citando la tabla con valores viejos. | Caso 6: tras reimportar sin «Dos», la tabla sigue con «Dos»; el producto «Uno» conserva azúcar 10 con fuente «t.pdf · página 1 · «Uno»» cuando la tabla ya dice 11. | La cita de origen deja de ser cierta sin fecha que lo delate. | Al reimportar la misma fuente, retirar lo que ya no viene (diciéndolo) y añadir la fecha de la lectura a `compositionSource`; avisar «la tabla ha cambiado» en esos productos. |
| 9 | MEDIO | «Ver todo» permite sustituir la composición de cualquier producto con un desplegable y «Aceptar», sin comparar ni poder deshacer; también de un producto por unidades si se llama a la acción. | src/ui/views-ingredients.js:203-226; caso 8: `applyTableComposition` sobre «Vasos para llevar» → ACEPTADO. | Se pisa una ficha escrita a mano en dos toques y no queda la anterior. | Reutilizar la comparación «Ahora / Tabla» del otro camino, botón con verbo claro, y rechazar unidades «ud» en core/domain.ts. |
| 10 | MEDIO | La confirmación en el servidor no exige revisión ni identificador de operación. | `juez-pantalla.cjs`: con revisión vieja → 409 (bien); sin revisión → 200 y 153 filas guardadas. src/server.cjs, bloque `/api/ingredients/table`. | El resto de acciones lo exige (server.cjs:1612); aquí un doble envío o una ventana atrasada escribe igual. | Exigir `Number.isInteger(data.revision)` cuando `confirm`. |
| 11 | MEDIO | Ni importar, ni vaciar, ni aplicar composición piden la contraseña del recetario, aunque cambian el balance de las recetas. | src/server.cjs:196-204 (`lockedActions` no las incluye). | Con el recetario protegido, cualquiera cambia de qué está hecho cada ingrediente. Ya pasaba con «Editar producto»; ahora es en bloque. | Decisión del dueño; como mínimo `applyTableComposition` y `clearIngredientTable`. |
| 12 | MEDIO | Emparejado solo por nombre idéntico. Con los datos reales: 1 de 153. | Captura juez-tabla-1280.png: «En el inventario 1». | El dueño pidió «cambiar el inventario»: sus productos actuales no reciben la composición salvo uno a uno desde «Ver todo». | Pantalla «Emparejar»: por cada producto suyo, proponer filas parecidas y que él confirme. |
| 13 | BAJO | PAC de la sal: la tabla dice 580 en azúcares y 0 en total; se guarda así (correcto) y el balance suma 0 sin avisar. | `check-comptable-real.cjs`: «Sal → El PAC total (0) es menor…». core/balance.ts usa `pac`. | El PAC de una receta con sal queda bajo sin señal. | En el balance, «PAC total (un ingrediente tiene aviso en la tabla)». |
| 14 | BAJO | Textos: «PAC» y «POD» sin explicar; «informativo»; el pie del balance sigue diciendo «azúcares, grasa, sólidos»; error 409 «Los datos cambiaron. Revisa la operación». | src/ui/views-production.js (balanceBlock), views-ingredients.js:20-22. | Quien recibe la app puede no conocer las siglas. | Una línea: «PAC: cuánto baja el punto de congelación. POD: cuánto endulza (azúcar = 100)» si el dueño confirma esa definición; no escribirla sin él. |
| 15 | BAJO | Tras añadir o aplicar se redibuja y se pierden pestaña y búsqueda (las marcas se conservan). 311 controles miden menos de 44 px de alto (enlaces «Ver todo», pestañas). | `juez-pantalla.cjs`: `controlesBajo44px: 311`; buscador vacío al volver. | Incómodo en tablet con 153 filas. | Guardar pestaña y búsqueda en variables del módulo; alto mínimo en `.row-tools .text-link`. |
| 16 | BAJO | work/ conserva cuatro carpetas `tmpcopy-*` (copias de data/ de ejecuciones que fallaron). | `ls work`. | Copias de datos reales sueltas. | `finally` con borrado en work/check-tabla-ingredientes.cjs; borrarlas a mano, una a una. |
| 17 | BAJO | La Guía (docs/GUIA_USO.md) no menciona la pantalla; la prueba automática no cubre los casos 1, 3, 4, 5 ni 6. | `git status`: docs/ sin cambios. | Cierre de sesión incompleto. | Añadirlos al cerrar. |

## Comprobado y bien

- **Exactitud**: `python work/juez-pdfium.py` + `node work/juez-app-rows.cjs` + `python work/juez-compara.py`
  → 153 filas reconstruidas (41 / 42 / 42 / 28), 152 iguales en nombre, página y 14 números asignados
  por orden; «Crema de coco» (13 números) coincide por posición: faltan justo «Otros sólidos» y
  «Sales minerales» y quedan sin valor, no en 0. Ninguna fila de más, de menos ni duplicada.
  Distancia vertical nombre–números ≤ 0,9 pt; el segundo candidato está a ≥ 15,1 pt: no hay nombres
  cruzados con la fila de encima o de debajo (bases, huevos, chocolates, frutas y pastas incluidos).
- A ojo sobre el PDF renderizado (cabecera y 15 primeras filas de la página 1; página 4 entera con
  los rangos): coincide.
- «S.M.L.» → «Sólidos lácteos no grasos» es correcto: en la leche en polvo, lactosa + proteína +
  sales = S.M.L. (38,5 + 26 + 5,5 = 70).
- Dato ausente en el balance: `more` da «No disponible» si a un ingrediente le falta; los cuatro con
  rango pasan a «No disponible» (caso 10). Precio 0 no se convierte en coste 0 (core/value.ts:38).
- Editar un producto sin tocar la composición conserva la fuente; cambiar un valor la borra (caso 7).
- Nombre de archivo con HTML: escapado, 0 elementos inyectados. Sin estilos en línea en el HTML.
  PDF falso → 400 «El archivo no es un PDF válido».
- Rendimiento: 13,5 ms por acción sin tabla, 13,2 con 153 filas (50 KB en meta), 26 con 2000.
- `npm run build` limpio; `node --test tests/comptable.test.cjs` 5/5; `check-comptable-real.cjs` 153/153.

## Sobre la decisión «biblioteca, no 153 productos»

Buena para el uso (no llena hojas de conteo ni avisos), pero es cambiar lo pedido: hay que decírselo
al dueño en una frase y dejarle elegir. Para que sea una gran mejora, por valor para la gelatería:

1. Emparejar la tabla con sus productos actuales (hallazgo 12).
2. Rangos de la propia tabla en el balance, con PAC y POD (hallazgo 3).
3. Una sola convención de azúcar y aviso de mezcla (hallazgo 2).
4. Añadir sin inventar proveedor ni unidad, con «pendiente de completar» (hallazgo 1).
5. Agrupar la tabla (bases, lácteos, azúcares, frutas, pastas, licores): la tabla no lo dice, así
   que lo elige la persona.
6. Pantalla que quepa en tablet (hallazgo 6).

## No comprobado

- El balance en la pantalla del Recetario con datos reales (no había bloque a la vista en la copia).
- PDF de más de 50 páginas, de 10 MB, o dos tablas distintas en un mismo PDF.
- Lector de pantalla y teclado; Mac.
- `work/check-tabla-ingredientes.cjs` no se ejecutó: se sustituyó por `work/juez-pantalla.cjs`.
- Los 153 estilos en línea que aparecen a 1024 px los pone un guion al estrechar; no se buscó cuál.
