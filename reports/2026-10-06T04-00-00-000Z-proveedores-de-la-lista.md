# 0.60.0 · Los proveedores de tu lista, con lo que venden; estado real del lector de imágenes

Fecha: 2026-10-06 (madrugada, hora del equipo). Versión anterior: 0.59.0 (misma sesión). Encargo del usuario: «faltaría agregar los proveedores que te pasé en el PDF, con lo que venden» y saber si el lector de imágenes «identifica imágenes y documentos de una forma casi perfecta».

## 1. Proveedores de la lista

- Núcleo (core/pricelist.ts): `listSuppliers(estado)` solo lee: los proveedores que nombra la lista de precios (sin lo hecho en casa), con el nombre tal como lo escribe la lista, lo que vende cada uno según esa lista (fila y precio, o «No disponible») y si ya existe un proveedor de la app con ese nombre. Acción `addListSuppliers { names }` (core/domain.ts): crea los que no existen con el nombre de la lista, iniciales derivadas, «Sin clasificar» y «Sin datos de entrega»; rechaza lo hecho en casa y los nombres que la lista no trae; no duplica los que ya están; nunca crea productos ni toca precios ni stock. El sobre del servidor lleva `pricelist.suppliers`.
- Pantalla: Compras → Precios por proveedor → «Añadir proveedores de la lista (N nuevos)» abre un cuadro con un renglón por proveedor nuevo (marcado), sus ingredientes y «Crear los marcados». Proveedores → «Qué le compras» enseña además «Según tu lista de precios vende N ingredientes», plegable, con nombre y precio; aclara que no son productos del inventario hasta que se añadan.
- Datos reales: a petición del usuario, work/anadir-proveedores-lista.cjs (app cerrada, copia previa work/copias/gelatostock-antes-proveedores-1791255652471.sqlite) despachó la acción con los 21 nombres.

| | Antes | Después |
|---|---|---|
| Proveedores | 7 | 28 (los 7 de antes, idénticos, + 21 de la lista) |
| Productos / stock / movimientos | 14 / igual / 21 | 14 / igual / 21 |
| Precios, lista (195), tabla (153), recetas | iguales | iguales |

Ninguno de los 21 coincidía por nombre con los 7 que ya había. Si alguno es en realidad el mismo (otro nombre), lo decide el usuario: está en TODO.md.

## 2. Lector de imágenes: respuesta honesta

No es «casi perfecto» y no se puede decir que lo sea con lo medido. Lo que hay (0.58.0, sin cambios en esta versión):

- Batería de 50 tipos de imagen **sintéticos** (tipografías, texto a mano simulado, calidad, formatos): 44 de 50 acaban en su apartado ideal y **0 inventos** (esa es la garantía: antes de equivocarse, se abstiene y lo enseña como dudoso).
- Lo que no lee: un cuadrante ladeado o sin líneas, un PDF escaneado sin texto (se declara como tal), una foto girada 5° pierde la fecha.
- Fotos del Calendario: 8 de 12 exactas, 0 inventos; cuadrantes: 0 «mal y seguras».
- Todo eso se midió con imágenes generadas por la propia sesión. **No hay ninguna medición con fotos ni documentos reales del usuario**: hasta que mande 3–5 fotos reales (una escrita a mano, una factura, un cuadrante), «casi perfecto» sería una afirmación sin evidencia. Lo que sí garantiza el diseño: la foto siempre se enseña, lo leído se propone y la persona confirma antes de guardar nada.

## 3. Pruebas

- `npm test`: 285 (284 + 1 nueva en tests/pricelist-memory.test.cjs: lista de proveedores con lo que venden, creación solo de los elegidos, rechazo de lo hecho en casa y de nombres ajenos, sin duplicar). `typecheck` y `format:check` limpios.
- Pantalla sobre copia de data/ (work/check-proveedores-lista-ui.cjs, Electron): el botón dice «21 nuevos»; el cuadro lista los 21 con sus ingredientes; se crean exactamente los dos marcados con «Sin clasificar» y «Sin datos de entrega»; el botón baja a 19; la ficha del proveedor dice «Según tu lista de precios vende 7 ingredientes» con 7 filas; productos, precios, stock y lista iguales; sin errores de página. Capturas work/proveedores-lista.png y work/proveedor-segun-lista.png.
- Chat del Ayudante (un caso nuevo, «proveedores_de_la_lista»): **60/60** (54 de la guía, 2 del modelo, 1 regla, 3 «Arte + gelato»; media 1.572 ms). reports/ai-chat-v0600.json.
- Ejecutable: dist/ArtelloAPP-0.60.0-win32-x64/ArtelloAPP.exe (`npm run package:win`). Prueba de escritorio con él, corriendo sola: **23 PASS, salida 0** (reports/desktop-smoke-2026-10-06-v0600.txt).

## 4. Para el usuario

1. Proveedores: completar teléfono, categoría y entrega de los 21 nuevos (la lista solo da el nombre). Decir si alguno es uno de los 7 de antes con otro nombre.
2. Mandar fotos y documentos reales para medir el lector de verdad.
