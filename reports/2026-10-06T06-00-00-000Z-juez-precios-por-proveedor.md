# Juez: precios por proveedor (lista de precios en PDF)

Fecha: 2026-10-06. Trabajo juzgado: reports/2026-10-06T05-00-00-000Z-precios-por-proveedor.md y su código. Sin cambios en src/, core/, tests/, scripts/ ni docs/. Este informe no lleva precios ni proveedores reales; los ejemplos son inventados.

## Veredicto

1. La lectura de la lista real es exacta: 195 de 195 filas coinciden con una extracción independiente (otro lector de PDF y otra regla de columnas) y con la página dibujada. No hay ningún dato inventado ni cambiado de columna.
2. Ningún precio cambia sin confirmación de la persona. No hay hallazgos CRÍTICOS.
3. Lo pedido se cumple a medias: la comparación existe, pero vive en una pantalla aparte. El carrito y «Sugerir reposición» no la usan, y con el inventario actual solo 1 de 131 ingredientes de la lista tiene producto al que apuntar el precio.
4. Hay tres fallos ALTOS: un aviso de subida de precio que desaparece, filas viejas que siguen compitiendo al subir una lista nueva con otro nombre, y el propio hueco con Compras.
5. El lector está ajustado a este PDF: con otra lista (nombres en dos líneas, cabecera solo en la primera página, proveedor centrado) falla en silencio o deja páginas sin leer.

## Hallazgos

### ALTO

**A1. Apuntar un precio de la lista en «otro proveedor» borra el aviso de subida del proveedor habitual.**
- Evidencia: `node work/juez2-casos.cjs` → «avisos de subida tras subir el habitual a mano: 1» y «…y tras apuntar un alternativo de la lista: 0».
- Causa: `usePriceRow` escribe en `state.prices` entradas de proveedores no habituales (core/domain.ts:1644), cosa que antes no ocurría. `priceAlerts` se queda con la última entrada por producto, sea del proveedor que sea, y descarta las que parten de 0 (core/inventory.ts:29-32).
- Efectos añadidos, misma causa:
  - Un alternativo que pasa de 100 a 150 sale en Inicio como subida del producto (misma salida: `{"supplierName":"NUEVO UNO","from":100,"to":150,"pct":50}`).
  - La ficha del proveedor enseña «0,00 € → X» para un alternativo nuevo (src/ui/views.js:232-239). Ese 0 significa «no había precio», y la regla de la casa es que sin precio no es 0.
  - El informe de la Semana lista ese cambio sin decir de qué proveedor es (core/report.ts:171).
- Por qué importa: se pierde un aviso real sin que nadie lo decida.
- Arreglo: en `priceAlerts`, llevar la cuenta por producto y proveedor y avisar solo del proveedor habitual. En views.js y report.ts, enseñar «sin precio → X» cuando `from` es 0 y añadir el proveedor.

**A2. Una lista nueva con otro nombre de archivo no sustituye a la anterior.**
- Evidencia: misma salida, «otro archivo: filas totales 18 · archivos ["lista.pdf","lista-noviembre.pdf"] · más barato de "lista.pdf"». Las filas del archivo viejo que el nuevo ya no trae se quedan y pueden salir como «Más barato».
- Causa: al importar solo se quitan las filas del mismo archivo o con el mismo nombre y proveedor (core/domain.ts, `importPriceList`, filtro `kept`).
- Agravante: cada fila en pantalla dice «página N», pero no de qué archivo ni de qué fecha es (src/ui/views-pricelist.js:46).
- Por qué importa: el dueño subirá la lista del mes siguiente con otro nombre, y la recomendación puede salir de un precio caducado sin que se vea.
- Arreglo: al subir, preguntar «¿Sustituye a la lista anterior?» con sustituir por defecto. Además, enseñar archivo y fecha en cada fila.

**A3. La comparación no llega al flujo de Compras.**
- «Sugerir reposición» y el carrito solo leen el precio de la ficha y los «otros proveedores» del producto (src/ui/views-orders.js:73-100). En views-orders.js la lista solo aparece como botón de entrada.
- El único puente es «Usar este precio…», fila a fila, y exige que el producto ya exista en el inventario.
- Medido sobre una copia temporal del inventario real (`node --test work/juez2-http.test.cjs`):
  - 145 filas utilizables, 131 ingredientes y 21 proveedores en la lista.
  - Solo 1 ingrediente coincide con uno de los 11 productos comprados del inventario.
  - Ningún proveedor de la lista existe todavía en la app.
- El caso literal del dueño («la misma leche, más cara con otro proveedor») depende de juntar a mano. Hay 144 pares de ingredientes que empiezan por la misma palabra y la app no propone ningún candidato.
- Lo que falta, por valor para el dueño:
  1. Crear productos desde filas de la lista, con su proveedor, como ya hace la tabla de ingredientes.
  2. Recordar a qué producto corresponde cada nombre de la lista.
  3. En el carrito y en la sugerencia, avisar «en tu lista, X lo tiene más barato» con el dato y su origen, sin cambiar nada solo.
  4. Proponer «posibles iguales» por palabras compartidas, para que la persona confirme o descarte.
  5. Filtro por proveedor: qué le compro a cada uno y dónde no es el más barato.

### MEDIO

**M1. El precio por paquete se deriva dando por buena una unidad que la lista no dice.**
- La nota que queda en la actividad lo afirma como hecho: «1,23 € por kg × 1 kg por paquete…» (core/domain.ts, `usePriceRow`, `note`). El aviso solo está en la letra pequeña de la ventana (views-pricelist.js:261).
- Nada impide apuntar una fila en un producto de otra unidad: «precio apuntado en un producto de otra unidad → err null».
- En el inventario real, 10 de 11 productos comprados tienen paquete distinto de 1 y 4 se cuentan por unidades. Ahí es donde un error de unidad se multiplica.
- Si el proveedor es el habitual, el precio de la ficha cambia, y con él el coste de las producciones siguientes.
- La ventana no enseña cuánto cambia el precio: en la prueba pasó de 24,50 € a 1,23 € sin ninguna advertencia.
- Arreglo: casilla obligatoria «He comprobado que este precio es por kg» (la unidad del producto). Nota con «tomado como precio por kg, confirmado por ti». Enseñar «ahora X → quedará Y (±N %)».

**M2. El lector es frágil fuera de este PDF.** Ninguno de estos casos se da en la lista real. Todos salen de `node work/juez2-casos.cjs`:
- Nombre partido en dos líneas: la segunda línea entra como un ingrediente nuevo sin proveedor ni precio. Es una fila inventada.
- Proveedor que empieza más de 30 puntos antes de su cabecera (texto largo centrado): se pega al nombre y la fila queda «sin proveedor», sin aviso (core/pricelist.ts:105).
- Cabecera solo en la primera página: el resto de páginas no se lee. Se dice en la vista previa, pero la lista queda inservible.
- Fila «TOTAL» o una nota al pie: entran como ingredientes.
- «2.500» sin decimales se lee como 2.500,00 €, sin marcarlo como dudoso.
- Arreglo: sacar las columnas de dónde empiezan los textos de las filas, no solo de la cabecera. Heredar las columnas de la página anterior. Tratar una fila con solo nombre justo debajo de otra como continuación dudosa. Marcar como dudoso un importe con punto y sin coma.

**M3. «Solo se juntan solos los nombres idénticos» no es exacto.**
- La clave quita todos los signos (core/pricelist.ts:30-33). «A+B», «A B» y «A-B» quedan juntos sin aviso, porque `joined` sale vacío.
- En la lista real hay 2 grupos con textos no idénticos. Los dos son inocuos: un espacio antes de «%» y un punto final.
- Arreglo: plegar solo mayúsculas, tildes y espacios, o avisar en la tarjeta «nombres que solo se distinguen por signos». Mientras tanto, corregir la frase en pantalla y en docs/GUIA_USO.md.

**M4. La ruta del servidor no tiene pruebas y es más laxa que su gemela.**
- Confirmar sin número de versión guarda igualmente: «confirmar SIN revisión → 200, 195 guardadas». `/api/ingredients/table` lo rechaza (src/server.cjs:1203); `/api/pricelist` no lo comprueba (src/server.cjs:1237).
- `importPriceList` se acepta directamente por `/api/action` con una fila que no sale de ningún PDF (estado 200). «Lo que entra es lo que dice el PDF» solo vale para el camino de la pantalla.
- tests/server.test.cjs no menciona `pricelist` (0 coincidencias).
- Arreglo: exigir la versión como en la tabla de ingredientes, rechazar `importPriceList` en `/api/action` y añadir la prueba de servidor.

### BAJO

- Dos porcentajes con bases distintas en la misma tarjeta: «el siguiente cuesta un N % más» va sobre el más barato y «un N % del más caro» va sobre el más caro. La fórmula está a la vista, pero confunde.
- «Hecho en casa» solo reconoce dos frases exactas (core/pricelist.ts:36-37). «ELABORACION DE LA CASA» cuenta como proveedor, compite y se puede crear como proveedor.
- Tras reimportar quedan enlaces y estrellas de nombres que ya no existen: «enlaces / estrellas huérfanos».
- Una fila repetida con el mismo proveedor y otro precio: se guarda la primera y la segunda sale en «No se guarda». Mejor enseñar las dos como conflicto.
- Al marcar una estrella la tarjeta salta al principio y desaparece de la vista. La casilla de «juntar» mide 22 px dentro de una celda de 44 (src/styles.css:5672-5678).
- Peso del sobre: la comparación añade 63 KB y la lista viaja además dentro del estado (36 KB). El cálculo tarda 1,6 ms con 195 filas. Con 5.000 filas son 33 ms y 1,7 MB por respuesta. Hoy no es un problema; si crece, calcularlo solo al cambiar la lista.
- src/pdftext.cjs lleva un byte nulo literal en la línea 70, dentro de una expresión regular. Ya estaba en HEAD. Por él git trata el archivo como binario y sus cambios no se pueden revisar con `git diff`. Sustituirlo por su secuencia de escape, con Edit.

## Comprobado y correcto

- **Exactitud.** PDFium (pypdfium2) con columnas por huecos entre palabras, frente a pdf.js con columnas por cabecera: 195 de 195 idénticas en nombre, proveedor y céntimos.
  - Por página: 35·35·35·35·35·20 en las dos vías.
  - 164 con precio, 31 sin precio (sin clave de precio en disco, no 0), 1 a 0,00 € marcada como dudosa.
  - 19 sin proveedor, 5 de ellas con precio: ninguna se convierte en proveedor ni compite.
  - 1 importe con miles, leído bien.
  - 22 textos de proveedor: 21 proveedores más la elaboración propia.
  - La página 5 dibujada y mirada fila a fila (35 filas, con el importe de miles, el 0,00 € y una fila sin precio) coincide.
- **Pruebas.** `npm run typecheck` sin errores. `node --test tests/pricelist.test.cjs`: 15 de 15. `node work/check-pricelist-real.cjs`: «CORRECTO», 195 de 195.
- **Sin precio sin confirmar.** Guardar la lista no toca productos (propuesta: 0 filas guardadas y versión intacta). `usePriceRow` rechaza:
  - una fila sin proveedor, a 0 o sin precio;
  - una elaboración de la casa;
  - un producto con receta;
  - una fila inexistente;
  - un proveedor nuevo sin la casilla;
  - el sexto «otro proveedor» (sin dejar proveedores a medio crear);
  - una versión vieja (409).
- **Estrellas.** Solo las pone `starPriceRow`. `priceGroups` no decide ninguna.
- **Textos.** La recomendación no habla de marca ni de calidad, y los grupos juntados a mano llevan su aviso.
- **Origen del precio.** Queda en el historial y sobrevive a vaciar la lista y a releer la base («memoria = releer la base: true», origen en disco). El catálogo del proveedor lo enseña. El proveedor habitual no cambia.
- **Proveedor nuevo.** Se crea con el nombre de la lista, «Sin clasificar», «Sin datos de entrega» y sin teléfono. No inventa datos; son textos de «falta».
- **Pantalla (leyendo el código).** Los nombres del PDF pasan siempre por `esc()` y la ventana escapa título y descripción. No hay estilos en línea. La búsqueda y lo marcado se conservan al redibujar.
- **Servidor.** Un archivo que no es PDF da 400. Un cuerpo de 14,1 MB da 400. Una versión equivocada da 409.

## No comprobado

- `node work/check-pricelist-ui.cjs`: anchura 1024, botones de 44 px y capturas. No lo ejecuté; solo leí código y estilos.
- `npm test` completo, `format:check`, paquete, prueba de escritorio y evaluación del chat. src/ai-help.cjs está modificado en el árbol, así que la evaluación del chat toca repetirla.
- Si los colores de las filas del PDF significan algo (la app los ignora). Conviene preguntarlo al dueño.
- Si cada precio de la lista es por kilo, por litro o por unidad. La lista no lo dice y es la pregunta 5 del autor; de ella depende M1.
- Fotos de tarifas y cualquier otra lista distinta de esta.

## Guiones del juez (work/, fuera de git)

juez2-indep.py, juez2-compara.cjs, juez2-casos.cjs y juez2-http.test.cjs. Las carpetas temporales (juez2-http-*, juez2-copia-*, juez2-store-*, juez2-tmp) están borradas. El guion juez2-http.test.cjs no cierra el servidor al acabar: hay que pararlo a mano tras leer la salida.
