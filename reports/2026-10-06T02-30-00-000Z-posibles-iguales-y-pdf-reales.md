# 0.59.0 · Tus dos PDF cargados, «posibles iguales» y qué producto es cada nombre

Fecha: 2026-10-05 (noche, hora del equipo). Versión anterior: 0.58.0. Encargo del usuario de esta sesión: (1) cargar sus dos PDF en sus datos reales por el camino de la app, sin tocar productos, stock ni precios, con copia previa y cifras antes y después; (2) lo siguiente de TODO.md: proponer «posibles iguales» en la lista de precios para que él los confirme y recordar a qué producto corresponde cada nombre de la lista y de la tabla.

## 1. Carga de los dos PDF en data/

Guion: work/cargar-pdf-reales.cjs (fuera de git; datos reales). Camino: el mismo del servidor, es decir, `readPdfItems` (texto del PDF por posiciones, sin red) → `parseCompositionTable` / `parsePriceList` → `store.dispatch` de `importIngredientTable` y de `importPriceList` con `replace: true`. La app estaba cerrada (ningún proceso de ArtelloAPP ni servidor escuchando). Copia previa de la base: work/copias/gelatostock-antes-pdf-1791252987892.sqlite (241.664 bytes, hecha con `VACUUM INTO` desde la misma conexión).

Salida del guion (resumida; los nombres de los archivos son los del usuario):

| | Antes | Después |
|---|---|---|
| Revisión del estado | 175 | 177 (dos acciones) |
| Productos | 14 | 14 (mismo contenido, mismo stock y unidad) |
| Movimientos | 21 | 21 (mismo contenido) |
| Proveedores | 7 | 7 (mismo contenido) |
| Recetas | 3 | 3 (mismo contenido) |
| Historial de precios | igual | igual |
| Pedidos / producciones | 14 / 7 | 14 / 7 |
| Filas de la tabla de ingredientes | 0 | 153 (4 páginas, 14 columnas; 2 con aviso; 1 fila no importada, la de porcentajes de la cabecera) |
| Filas de la lista de precios | 0 | 195 (6 páginas; 21 proveedores; 14 hechas en casa; 31 sin precio; 19 sin proveedor; 1 dudosa, el 0,00 €) |

La comparación la hace el propio guion releyendo la base desde otra conexión (no desde memoria) y comparando huellas de productos, stock, movimientos, proveedores, recetas, precios, pedidos y producciones: todas iguales. Las cifras de filas coinciden con las medidas en 0.57.0 (work/check-comptable-real.cjs y work/check-pricelist-real.cjs).

Lo que el usuario dijo sobre las unidades («los productos no dicen los kilos ni los gramos…, igual cargarlos, luego te diré») queda tal cual: el precio de la lista se enseña por litro, kilo o unidad «como lo escribe la lista» y no se compara con el paquete hasta que él lo apunta. Nada que cambiar hasta que lo diga.

## 2. «Posibles iguales» (core/pricelist.ts)

- `nameParts(nombre)`: palabras (en singular, sin «de», «en», «con»… ni unidades escritas como «kg», «lt», «ud»), números sueltos («26», «38») y códigos con cifras («t08», «pet50», «7k»).
- `likelySame(a, b)`: motivo en palabras o `null`. Regla estrecha a propósito: las palabras de uno están todas en el otro con una de más como mucho, y los números y los códigos de uno están dentro de los del otro. Así «CHOCOLATE BLANCO» y «CHOCOLATE BLANCO 26%» se proponen («26» solo en uno), pero «CHOCOLATE NEGRO 55%» y «CHOCOLATE NEGRO 73%» no (números distintos), ni «COPETAS T08» y «T12», ni «SAL» y «SAL TABLETAS DESCALSIFICADOR» (dos palabras de más).
- `priceSuggestions(estado)`: parejas de grupos (nunca lo hecho en casa, nunca los que ya cuentan como uno, nunca los que la persona rechazó). Se calcula en el sobre del servidor junto a la comparación (`pricelist.suggestions`); con la lista real tarda 78 ms.
- Acciones: `rejectPriceMatch` (dos filas → `state.priceNotSame`, pareja de nombres plegados ordenada; «ya habías dicho» si se repite; rechaza si ya cuentan como uno). `linkPriceRows` (ya existía) es el «Sí» y, si antes se había dicho que no, lo anula. `clearPriceList` vacía también los rechazos.
- Pantalla (src/ui/views-pricelist.js): recuadro «Posibles iguales · N» encima de los grupos, plegable y que recuerda si estaba abierto; cada pareja con sus proveedores y precios, el motivo y los botones «Sí, es el mismo» / «No, son distintos». El texto dice que la lista no afirma que sean lo mismo y que lo decide la persona.

Medición con la lista real (work/check-posibles-iguales.cjs, solo lectura): 165 grupos, 14 de casa, **24 propuestas**, **0 parejas de porcentaje o tamaño distinto** entre siete comprobadas a propósito (55 %/73 %, T08/T12, conos 39/42, vasos 12/14 oz, estabilizante C.C/F.F, sal/sal tabletas, porex T1000/T500). Las 24 son del tipo «misma palabras con una de más» (marca, «tostado», «premium», «fresco», «exprimido», «pascual»…) o «número solo en uno» (yema 2 y 3, 26 %, 12 %). No todas serán iguales para el usuario (por ejemplo «NOCCIOLATA 12%» y «NOCCIOLATA BLANCA», o «PASTA VAINILLA» y «PASTA VAINILLA BOURBON», que cuesta tres veces más): por eso se proponen y no se juntan.

## 3. Qué producto es cada nombre (state.nameProducts)

- Esquema: `nameProducts: [{ kind: "list" | "table", key (nombre plegado), product, at }]` en meta, y `priceNotSame` (ver arriba). Estado inicial actualizado.
- Quién lo escribe: `usePriceRow` (lista), `applyTableComposition` y `addTableProducts` (tabla), y las acciones nuevas `linkNameProduct` / `unlinkNameProduct` (kind + fila + producto). `clearPriceList` olvida los de la lista; `clearIngredientTable`, los de la tabla. Volver a subir el mismo archivo lo conserva (va por nombre).
- Quién lo lee: `priceGroups` pone `product` en cada grupo; `productOfName(estado, kind, nombre)`; `cartAdvice` busca primero el grupo de la lista que la persona asignó al producto y después el nombre igual (o juntado). «Usar este precio…» preelige el producto recordado.
- Pantalla: en cada grupo de Precios por proveedor, «¿Qué producto de tu inventario es?» → «En tu inventario es X · Cambiar · Quitar». En la tabla de ingredientes, «Ya lo tengo con otro nombre…» en las filas sin producto y «Cambiar» en las recordadas; la fila dice «En el inventario como «X»» (con o sin «con otra composición» y «Usar la de la tabla», como antes).
- Garantía: nada de esto toca precios, stock, proveedores ni composiciones; lo comprueban las pruebas y el guion de pantalla.

## 4. Pruebas y comprobaciones

- `npm test`: 284 pruebas (281 + 3 nuevas en tests/pricelist-memory.test.cjs: propuestas con motivo y sin juntar solas, «no» que se guarda y se anula al juntar, memoria de la lista usada por el carrito y conservada al resubir, memoria de la tabla por composición, alta y elección). `npm run typecheck` y `npm run format:check` limpios.
- Pantalla sobre una copia de data/ (work/check-posibles-iguales-ui.cjs, Electron real): 24 propuestas en pantalla = 24 del núcleo; nada juntado antes de decidir; «No» quita la propuesta y la apunta sin juntar; «Sí» junta y el grupo dice «Juntados por ti»; asignar un producto a un grupo, verlo en la línea, que «Usar este precio…» lo preelija y quitarlo; «Ya lo tengo con otro nombre…» en la tabla y la fila dice «En el inventario como «…»»; productos, precios, stock, lista y tabla iguales al final; sin errores de página. Capturas en work/posibles-iguales*.png y work/tabla-producto-recordado.png.
- Chat del Ayudante: dos casos nuevos en tests/fixtures/ai-chat.json (posibles_iguales, producto_de_cada_nombre). Primera pasada 58/59: el caso «posibles_iguales» recibió la frase antigua de la guía («Solo se juntan solos los nombres iguales…»), correcta pero sin la novedad; se corrigió el texto de la guía (no la prueba) para que la frase nueva diga que la app «propone» y «nunca los junta sola», y la segunda pasada da **59/59** (53 de la guía, 2 del modelo, 1 regla, 3 «Arte + gelato»; media 2.620 ms). reports/ai-chat-v0590.json.
- Ejecutable: `npm run package:win` reconstruido dos veces (la segunda tras corregir la guía del chat): dist/ArtelloAPP-0.59.0-win32-x64/ArtelloAPP.exe, con la frase nueva dentro. Prueba de escritorio con ese ejecutable: la primera pasada se cortó en el paso del chat («la ventana se ha cerrado» tras 19 PASS) porque corría a la vez que la evaluación del chat, las dos con el modelo cargado; repetida sola, **23 PASS, salida 0**, igual que en 0.58.0 (reports/desktop-smoke-2026-10-05-v0590.txt; los dos «400» de la consola ya salían en la 0.58.0 y no son de esta versión).

## 5. Lo que no se ha hecho y por qué

- No se ha juntado ni rechazado ninguna pareja en los datos reales: las 24 propuestas están ahí para que el usuario decida.
- No se ha asignado ningún producto a ningún nombre real: solo él sabe qué es cada cosa.
- Las unidades de la lista (kilo, litro, unidad) siguen sin decidirse, por decisión del usuario de esta sesión.
- La prueba de escritorio sigue sin recorrer la tabla de ingredientes ni Precios por proveedor (lo cubren los guiones de work/).

## 6. Para el usuario (en la app)

1. Compras → Precios por proveedor → arriba, «Posibles iguales · 24»: en cada pareja, «Sí, es el mismo» o «No, son distintos».
2. En cada ingrediente de la lista: «¿Qué producto de tu inventario es?». En Inventario → Tabla de ingredientes: «Ya lo tengo con otro nombre…».
3. Cuando quieras, dime si los precios de tu lista son por kilo, litro o unidad.
