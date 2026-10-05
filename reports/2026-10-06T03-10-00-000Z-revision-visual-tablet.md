# Revisión visual y estudio para tablets · sobre 0.55.1

Solo estudio: no se ha tocado `src/`, `core/`, `tests/`, `scripts/`, `docs/` ni `package.json`. Todo se midió sobre una copia temporal de `data/` (2 recetas, 13 productos, recetario sin contraseña), sin WhatsApp ni cruceros. Otras sesiones estaban editando `src/styles.css` y `src/server.cjs` a la vez: los números de línea citados son los del árbol en el momento de medir y pueden haberse movido unas líneas.

## 1. Resumen

1. La app se ve cuidada y coherente en escritorio; los colores de texto pasan el contraste salvo un botón (3,12:1).
2. Está pensada para ratón: 765 de 881 botones y campos medidos (87 %) miden menos de 44 px, el mínimo cómodo para un dedo; 117 miden menos de 32 px.
3. Un tercio del texto (32 %) va a 12–13 px: se lee en un monitor, cuesta en una tablet a un brazo de distancia.
4. En tablet vertical (768 px) la barra lateral ocupa el 28 % del ancho y deja 537 px al contenido: las tablas no caben y hay 52 botones de Inventario que solo aparecen deslizando de lado.
5. Hay botones que directamente no se pueden alcanzar a 768 px: 5 en Compras («Marcar confirmado» queda cortado) y la página de Inventario se sale 87 px de la pantalla.
6. La pantalla nueva de producir (botones por sabor y tandas) es la mejor preparada para el dedo; el resto de Producción son tablas densas de 4,4 pantallas de alto.
7. Tablet con Windows: viable con trabajo mediano (solo estilos y un par de detalles). iPad o Android: viable abriendo la app desde el navegador de la tablet contra el ordenador de la tienda, pero hoy está cerrada a propósito y abrirla exige decidir sobre seguridad.
8. Recomendación: primero hacer la interfaz táctil (sirve para las dos vías), después el «modo tablet por la wifi» limitado a producir, pesar, contar y cerrar el día, con clave.

## 2. Lista de comprobación «Visual» (priorizada)

Tamaños: E = 1440×900, A = 1024×768 (tablet apaisada), V = 768×1024 (tablet vertical).

| # | Pantalla | Tamaño | Problema medido | Arreglo propuesto | Archivo / regla | Prioridad |
|---|---|---|---|---|---|---|
| V1 | Compras · Control de entregas | V | 5 botones recortados por `article.delivery-card` (overflow oculto): «Marcar confirmado» se ve a medias y lo que va detrás no se puede pulsar. Captura `768x1024-orders.png`. | Que la fila de acciones del pedido salte de línea (`flex-wrap: wrap`). | `src/styles.css`, acciones de `.delivery-card` | Alta |
| V2 | Inventario | V | La página se sale: 855 px en una ventana de 768. Lo causa `.heading-actions` (600 px, `flex: none`), con «Nuevo producto» acabando en x = 840. | Quitar `flex: none` por debajo de 900 px y dejar que el encabezado ponga los botones debajo del título. | `src/styles.css:656` `.heading-actions`, `.page-heading` | Alta |
| V3 | Inventario | V (y A) | Tabla de 751 px en un hueco de 487 px (V) y de 743 px (A, 8 px de deslizamiento). En V, 52 botones («Contar», «Editar», «Otros proveedores», «Objetivo de merma») quedan fuera de la vista y solo salen deslizando de lado dentro de `.table-wrap`. | Por debajo de 900 px, pasar cada producto a tarjeta (nombre, cantidad, y los botones debajo) o fijar la columna de acciones. | `src/ui/views.js` `productTable`, `src/styles.css:962` | Alta |
| V4 | Barra lateral | A, V | Mide 216 px: 21 % del ancho en A y 28 % en V (contenido: 793 y 537 px). Su contenido mide 921 px: en A (768 de alto) «Guía» y «Configuración» quedan fuera de la vista; en V, «Configuración»; en E (900) también hay que deslizar 21 px. | Por debajo de ~1100 px, barra plegada (solo iconos, 64 px) o menú que se abre con un botón; en horizontal baja, menos elementos fijos. | `src/styles.css:306` `.sidebar`, `:218` `main`, `@media (max-width: 1280px)` | Alta |
| V5 | Producción | V, A | 4 tablas más anchas que su panel en V (531, 532, 622 y 844 px en 439–487 px) y 1 en A (844 en 695). Quedan fuera de la vista 8 controles en V («Corregir», «Anular», motivo de la merma, invitación) y 2 campos en A. La pantalla mide 4,4 alturas de ventana en V. | El cierre del día, en tarjetas por gelato en vez de tabla; los informes de 30 días, plegados por defecto o en otra pestaña. | `src/ui/views-sales.js`, `src/ui/views-production.js`, `.delivery-table`, `.report-table` | Alta |
| V6 | Actividad | V | Tabla de 521 px en 487 px: los 7 botones «Revertir» quedan fuera de la vista. 7,2 alturas de ventana. | Igual que V3 (acción bajo el texto en estrecho). | `src/ui/views.js` (actividad) | Media |
| V7 | Mensajes | V | La columna del mensaje se queda en unos 180 px de texto: la lectura sale a 3–4 palabras por línea (captura `768x1024-messages.png`) y un botón queda recortado por `section.inbox-layout`. | Por debajo de 900 px, una sola columna: lista y, al tocar, el mensaje. | `src/styles.css` `.inbox-layout` (hoy 260 px + resto en `max-width: 1080px`) | Media |
| V8 | Toda la app | E, A, V | Texto de menos de 14 px: 32 % de los caracteres medidos (26 868 de 84 485 en E; 34 % en V). 12 px: 12 801; 13 px: 13 314; por debajo de 12 px (8, 10 y 11 px): 753. Dentro de los modales, 88–96 % del texto es de 13 px (etiquetas de campo y botones). | Subir un punto la escala en táctil: etiquetas, botones y celdas a 14–15 px; nada por debajo de 12 px. | `src/styles.css:1–80` tokens `--fs-12`, `--fs-13`; `.field`, `.btn`, `th`, `td` | Media |
| V9 | Producción · «Apunto lo vendido» | todos | Único contraste bajo medido en pantalla: blanco sobre #7f9b5a = 3,12:1 (mínimo 4,5). 17 caracteres. | Usar `--accent-text` (#3f6a2f) como fondo de la pestaña activa. | `src/styles.css:264–268` (`main.page-production --accent`), `.tab.active` | Media |
| V10 | Calendario · Horario de la semana | V | En la captura `768x1024-cal-semana.png` las filas de turno (persona, turno, dos horas) son más anchas que el recuadro del día y los campos de hora sobresalen por la derecha. No lo medí con cifra. | En estrecho, cada turno en dos líneas (persona y turno / de–a). | `src/styles.css` `.cal .cal-shift` (≈4846, 5186) | Media |
| V11 | Paleta | — | Calculado sobre los tokens: `--acero` #6b7680 sobre crema = 4,34:1 (justo por debajo de 4,5; se usa en 4 reglas); `--rosa` #c85c73 sobre panel = 3,95:1; `--azafran` sobre panel = 2,15:1 (vale para iconos, no para texto). El resto pasa: tinta 13,78; `--ink-soft` 7,13; `--ink-muted` 5,51; pistacho sobre pistacho claro 6,03; blanco sobre pistacho 7,18. | No usar `--acero`, `--rosa` ni `--azafran` como color de texto; ya existen `--rosa-texto` y `--azafran-texto`. | `src/styles.css:6–30` | Baja |
| V12 | Modales | todos | Ninguno se sale de la ventana: todos respetan `max-height: calc(100vh - 48px)`, el cuerpo desliza y el pie con «Guardar» queda visible en los 27 casos medidos. Receta y foto ocupan toda la altura (976 px en V). El de producir pasa de 1240 a 720 px en V y su tabla de tandas necesita deslizar de lado (se ve la barra en la captura). | Sin arreglo urgente. En producir, en V, enseñar solo la columna de la tanda elegida. | `src/styles.css:1330` `dialog`, `:5139` `dialog.wide`, `src/ui/production-quick.js` | Baja |
| V13 | Jerarquía y densidad | E | Resumen: dos avisos verdes seguidos con cuatro enlaces de texto, ocho indicadores del mismo peso y, debajo, el inventario: no hay una acción principal clara para quien llega al obrador. Producción: 8 paneles apilados. | Ordenar por tarea del día (producir, pesar, cerrar) y dejar informes al final o plegados. | `src/ui/views.js` `home`, `views-production.js` | Baja |
| V14 | Consistencia | todos | Conviven cuatro alturas de control: 40 px (`.btn`, campos), 36 px (`.inline-input`, `.icon-button`), 32 px (pestañas, horas del horario) y 24–28 px (`.text-link`, `.text-button`). Los enlaces de migas del Calendario miden 16 px de alto. | Dos alturas: normal y compacta; los enlaces de texto con zona de toque ampliada. | `src/styles.css` `--control-h`, `--control-sm`, `.text-button:739`, `.text-link:1649`, `.cal-crumbs .btn` | Baja |
| V15 | Textos | — | Vistos en las capturas, con los datos del dueño: «Simular mensaje», «Mensaje de demostración», «Envío simulado», «Simulación: no se ha contactado al proveedor» y «Revisá si afecta a tu negocio» (voseo). No es de esta revisión, pero choca con la regla de no hablar de demostraciones. | Revisarlo en la sesión de textos. | `src/ui/views-messages.js`, `views-orders.js`, `core/messages.ts` | Baja |

Lo que está bien y conviene no romper: ninguna pantalla se sale a 1440 ni a 1024; las 16 pantallas y los 9 modales se abrieron sin errores de página en los tres tamaños; todas las tablas anchas tienen contenedor con deslizamiento (ninguna queda cortada sin poder verla).

## 3. Lista «Tablet táctil»

| # | Dónde | Medición | Arreglo propuesto | Archivo / regla | Prioridad |
|---|---|---|---|---|---|
| T1 | Toda la app | 765 de 881 pulsables < 44 px (87 %) y 117 < 32 px, sumando 21 pantallas. Por tipo: menú lateral 336 (181×38), `.btn` 158 (40 de alto), campos 113, `.text-button` 60 (28 de alto), `.icon-button` 26 (36×36), pestañas 13 (32), `.text-link` 11 (24). | Un bloque `@media (pointer: coarse)` que suba `--control-h` a 48 px, `--control-sm` a 44 px, el menú a 48 px y dé 44 px de zona de toque a los enlaces de texto. Hoy ese bloque solo toca dos clases. | `src/styles.css` último bloque `@media (pointer: coarse)` (`.quick-tile`, `.quick-batch`) | Alta |
| T2 | Inventario, Producción, Resumen | Las acciones de cada fila son enlaces de texto de 24–28 px de alto y pegados entre sí («Contar · Editar · Otros proveedores · Objetivo de merma»; «Corregir · Anular»): fácil tocar el de al lado, y «Anular» es destructivo. | Botones de 44 px con separación, o un botón «…» por fila que abra las acciones. | `src/ui/views.js`, `views-production.js` | Alta |
| T3 | Producir un sabor (modal) | Lo mejor preparado: 14 controles, tandas de 64×40 (48 de alto con dedo, por la regla existente), «Hecho» de 40 px. Falta: «Cerrar» 36×36, «Corregir lo que de verdad se usó» 28 px de alto. | Subir «Hecho» y «Cancelar» a 48 px y la cruz a 44. | `src/ui/production-quick.js`, `.modal-footer .btn` | Media |
| T4 | Campos numéricos | 6 `input type=number` sin botones − / + en el cierre del día (120×36), 5 en «Nuevo producto», 2 en la hoja de conteo, 1 en el conteo, 1 en confirmar cierre, 1 en la receta. Las flechas nativas son de ratón. La pesada de la mañana y «Otra cantidad» ya usan `type=text inputmode=decimal`, que en tablet abre el teclado de números. | Llevar ese mismo patrón (o el `stepperField` que ya existe) a conteo, hoja de conteo y cierre. | `src/ui/forms.js:25–34`, `views-sales.js`, `actions.js` (count, countSheet, confirmDay) | Alta |
| T5 | Horario de la semana | 56 campos de hora de 104×32 px y 7 casillas «Cerrado» con etiqueta de 20 px de alto; 133 controles en la pantalla, 132 por debajo de 44 px. | En táctil, 44 px de alto y casilla con zona amplia. Es pantalla de despacho: puede quedarse para el ordenador. | `src/ui/views-calendar.js`, `.cal .cal-shift` | Baja |
| T6 | Fechas | `input type=date` en producir, cierre (2) y foto del Calendario: 131×40. En tablet abre el selector del sistema; funciona, pero el icono es pequeño. | Botones «Hoy» y «Ayer» al lado, que es lo que se usa casi siempre. | `production-quick.js`, `views-sales.js` | Baja |
| T7 | Cosas que dependen del ratón | No hay doble clic, arrastrar ni menú contextual en `src/ui` (búsqueda sin resultados). Hay 25 reglas `:hover` en `styles.css`, todas de realce (ninguna enseña contenido oculto). Solo 2 `title` por pantalla y solo en las flechas del Calendario, que ya llevan `aria-label`. `touch-action: manipulation` solo en `.quick-tile`. | Poner `touch-action: manipulation` en `button`, `a` y campos para evitar el retardo y el zum por doble toque; envolver los `:hover` en `@media (hover: hover)` para que no se queden «pegados» tras tocar. | `src/styles.css` | Media |
| T8 | Ventana de Windows | La ventana no baja de 1000×700 (`src/desktop.cjs:65–66`). Una Surface en vertical o con la app a media pantalla da menos de 1000 px: la ventana se sale de la pantalla. | Bajar el mínimo a 720×600 cuando la interfaz estrecha esté hecha (no antes). | `src/desktop.cjs:65–66` | Media |
| T9 | Subir fotos | Los tres campos de archivo usan `input type=file` con `accept` y leen con `FileReader` (`src/ui/forms.js:238`): en una tablet ofrecen cámara o galería sin cambios. No probado en una tablet real. | Añadir `capture="environment"` para ir directo a la cámara. | `src/ui/forms.js:152`, `calendar-photo.js:150` | Baja |
| T10 | Teclado en pantalla | No medido: en una tablet el teclado tapa media pantalla y los modales están centrados. | Probar en el aparato real; si tapa, alinear el modal arriba en táctil. | `src/styles.css:1330` | Por medir |

### Qué cubren hoy los `@media` de `src/styles.css`

- `min-width: 1600px`: solo el titular del Resumen.
- `max-width: 1280px` (dos bloques): barra lateral de 240 a 216 px, márgenes y rejillas algo más juntas; día del Calendario a una columna.
- `max-width: 1100px` (tres bloques): Guía a una columna; Calendario (año a 2 columnas, día a 1, celdas del mes).
- `max-width: 1080px`: indicadores a 2 columnas, Resumen a 1, recetas y documentos a 1, proveedores a 2, celdas de tabla con salto de línea.
- `max-width: 720px`: solo Cruceros y las celdas del Calendario.
- `max-height: 900px` y `760px`: esconden la tarjeta «Tu información se queda aquí» y el nombre del negocio de la barra lateral.
- `pointer: coarse`: solo `.quick-tile` y `.quick-batch`.
- `prefers-reduced-motion` y `print`.

Lo que no cubren: entre 721 y 1080 px (justo las tablets) la barra lateral sigue fija a 216 px y no hay ninguna regla para ella por anchura; no hay nada entre 1080 y 720 para tablas, encabezados de página, Mensajes ni Compras; y el modo táctil solo existe para dos clases. No hay ninguna regla `hover: hover` ni `orientation`.

## 4. Cómo llevarla a tablets

### a) Tablet con Windows (tipo Surface)

La app corre tal cual: es el mismo instalador. Lo que falta es lo de las listas de arriba:

- Interfaz táctil (T1, T2, T4, T7): estilos y cambiar algunos campos. Tamaño mediano.
- Interfaz estrecha (V1–V7): necesaria solo si se usa en vertical o a media pantalla; en apaisado (1024 o más) hoy no se sale nada, solo molesta la barra lateral. Tamaño mediano–grande (Inventario y Producción en tarjetas es lo que más cuesta).
- Mínimo de ventana (T8). Pequeño.
- Los datos viven en esa tablet. Si además hay un ordenador en la tienda, serían dos copias separadas que no se juntan: hay que elegir un solo aparato «dueño» de los datos.

### b) iPad o tablet Android: abrir la app desde el navegador contra el ordenador de la tienda

Qué lo impide hoy, con el código delante:

| Barrera | Dónde | Qué pasa |
|---|---|---|
| Solo escucha en el propio equipo | `src/server.cjs:1668` `server.listen(port, "127.0.0.1")` | Desde otro aparato no hay conexión. |
| Puerto distinto en cada arranque | `src/server.cjs:60` `port = 0`; Electron no pasa puerto (`src/desktop.cjs` `createApp({ dataDir })`) | La tablet no tendría una dirección fija que guardar. |
| Comprueba el nombre del servidor | `src/server.cjs:552` y `:561` (`Host` debe ser `127.0.0.1:puerto`) | Con la dirección de la wifi responde 403 «Origen inválido». |
| Comprueba el origen al guardar | `src/server.cjs:863` (`Origin` debe ser el mismo `http://127.0.0.1:puerto`) | Todo lo que guarda daría 403. |
| La llave de entrada es de un solo uso por arranque | `src/server.cjs:432` (64 caracteres al azar), `:575–590` (se entrega en la dirección `/?key=…` y pasa a una cookie) | La tablet no tiene forma de obtenerla, y cambia cada vez que se abre la app. |
| Identificador de cada operación | `src/ui/core.js:229` `crypto.randomUUID()` | Los navegadores solo dan esa función en conexiones seguras (https o el propio equipo). Por http en la wifi no existe: ningún guardado funcionaría. Es conocimiento de la plataforma, no lo he medido en una tablet. Tiene arreglo pequeño (generar el identificador con `crypto.getRandomValues`, que sí está). |
| Elegir carpeta | `src/preload.cjs` (única función: `pickFolder`), `src/ui/actions.js:1722`, `:1737`, `:2083` | En el navegador no existe; dos de los tres usos ya lo comprueban y ofrecen escribir la ruta. Afecta solo a copias y exportación, que no son cosa de la tablet. |
| Avisos de Windows | `src/desktop.cjs:131–150` | Solo salen en el ordenador. El aviso dentro de la app (`/api/pulse` cada 5 s) sí funcionaría. |

Lo que no estorba: la CSP (`src/server.cjs:1612`, todo `'self'`) vale igual con otra dirección; la cookie `HttpOnly; SameSite=Strict` (`:584`) funciona por http; las fotos se suben como JSON desde el navegador; WhatsApp, la lectura automática y la lectura de fotos corren en el ordenador, así que la tablet solo las ve.

¿Dos pantallas a la vez son seguras? En lo esencial sí. Cada guardado lleva la revisión que la pantalla tenía (`src/ui/core.js:226–231`); el servidor lo aplica dentro de una transacción exclusiva (`core/store.ts:533` `BEGIN IMMEDIATE`) y lo rechaza con 409 si los datos cambiaron (`core/domain.ts:590`, `src/server.cjs:1559`). No se pisan cambios ni se duplica una operación (`operations` por `operationId`, `core/store.ts:536–547`). Lo incómodo: la segunda pantalla ve «Los datos cambiaron», la app recarga por detrás y hay que repetir el gesto (`core.js:236–256`; solo reintenta sola si lo único nuevo es un mensaje); y una pantalla abierta no se entera de lo que hizo la otra hasta cambiar de apartado (`core.js:427` marca `staleState`, no redibuja). Con dos personas trabajando a la vez, cada revisión es global: cualquier guardado de una invalida el formulario abierto de la otra. Sirve para «ordenador en el despacho + tablet en el obrador», no para varias tablets a pleno ritmo.

Dos cosas que hoy son «de la app» y pasarían a ser «de todos los aparatos»: el desbloqueo del recetario es uno para todo el servidor (`src/server.cjs:151–153`: si se desbloquea en el ordenador, queda desbloqueado en la tablet 30 minutos) y solo hay una llave de sesión para todos.

Riesgos de abrirla a la wifi:

- Por http, cualquiera conectado a la misma wifi puede ver lo que viaja (recetas, costes, ventas, teléfonos de proveedores) y copiar la cookie. Si la wifi de clientes y la de la tienda son la misma, esto no se debe hacer.
- Quien entre tiene todo: enviar WhatsApp a los chats autorizados, restaurar una copia encima de los datos (`/api/restore`), y escribir archivos en carpetas del ordenador (copias y exportación aceptan una ruta escrita a mano).
- https en una red local obliga a un certificado propio: el iPad enseña un aviso de «conexión no segura» en cada aparato hasta instalarlo a mano. Es más seguro pero no es algo que el dueño pueda mantener solo.

Mínimo razonable si se hace:

1. Apagado por defecto; un interruptor en Configuración («Usar desde una tablet de la tienda») que enseña la dirección y un código QR.
2. Puerto fijo y comprobaciones de `Host` y `Origin` que acepten la dirección propia del ordenador en la red, no cualquiera.
3. Clave de acceso para la tablet (PIN largo o código de emparejamiento de un solo uso), sesión propia por aparato, límite de intentos, y botón «Desconectar tablets».
4. La tablet entra con permisos recortados: producir, pesar, contar, mermas y cierre del día. Sin WhatsApp, sin copias ni restaurar, sin exportar, sin Configuración ni contraseña del recetario.
5. Por http pero solo en una wifi privada (la del negocio, no la de clientes), dicho claro en pantalla; https queda como mejora posterior.
6. Arreglar `crypto.randomUUID` y el redibujado cuando otra pantalla cambió algo.
7. El ordenador tiene que estar encendido y con la app abierta; el cortafuegos de Windows preguntará la primera vez.

### c) Otras vías

- PWA (instalar la web como app en la tablet): exige https y no quita la necesidad del ordenador como servidor; es un adorno encima de b), no una alternativa.
- App nativa para iPad/Android: habría que rehacer la interfaz y decidir dónde viven los datos y cómo se sincronizan; es un proyecto nuevo, no una fase. No.
- Llevar los datos a un servidor en internet: rompe la regla de «todo se queda en este equipo» y añade coste mensual. No.
- Escritorio remoto desde la tablet al ordenador: funciona hoy sin tocar la app, pero se ve el escritorio de Windows pequeño y con el dedo es peor que todo lo medido arriba. Solo como apaño.

### Recomendación y orden

| Paso | Qué | Tamaño | Sirve para |
|---|---|---|---|
| 1 | Arreglos que ya son fallos: V1 (Compras), V2 (Inventario se sale), V9 (contraste) | Pequeño | Todos |
| 2 | Modo táctil: T1, T2, T4, T7 (alturas de 44–48 px, campos con teclado numérico, acciones de fila separadas) | Mediano | Surface e iPad |
| 3 | Modo estrecho: V4 (barra lateral plegable), V3, V5, V6, V7 (tarjetas en vez de tablas por debajo de ~900 px), T8 | Mediano–grande | Surface en vertical e iPad |
| 4 | Prueba con una tablet de verdad (teclado en pantalla, cámara, tamaño real del dedo) | Pequeño | Decide si hace falta más |
| 5 | Solo si la tablet no es Windows: «modo tablet por la wifi» con el mínimo de arriba | Grande | iPad / Android |

Los pasos 1–3 no cambian datos ni garantías: son estilos y disposición. El paso 5 sí toca la seguridad del servidor y merece su propio plan (`docs/PLAN_*.md`) y sus pruebas.

Decisiones del dueño:

1. ¿Qué tablet será? Windows (acaba en el paso 4) o iPad/Android (necesita el paso 5).
2. ¿La tablet sustituye al ordenador o lo acompaña? Si lo acompaña, el ordenador es quien guarda los datos y tiene que estar encendido.
3. ¿En vertical o apaisada, fija en un soporte? Apaisada a 1024 o más ahorra buena parte del paso 3.
4. ¿La tienda tiene una wifi solo para el negocio, separada de la de clientes? Sin eso, el paso 5 no es recomendable.
5. ¿Qué se hará desde la tablet? Si es solo producir, pesar, contar y cerrar, el paso 3 se puede limitar a esas pantallas.

## 5. Cómo repetir las mediciones

- `node work/shot-tablet.cjs` — recorre 16 pantallas, 4 vistas del Calendario, el detalle de una receta y 9 modales en los tres tamaños; deja 90 capturas `work/shots-tablet/<tamaño>-<pantalla>.png`, `medidas.json` (todo el detalle) y `resumen.txt` (una línea por pantalla). Con `SHOTS=0` solo mide. Tarda unos 3 minutos.
- `node work/shot-tablet-detalle.cjs [pantalla]` — lee `medidas.json` y saca los totales de este informe (pulsables por tipo, tamaños de letra, tablas, modales, contraste).
- `node work/shot-tablet-extra.cjs` — controles recortados o que exigen deslizar de lado, barra lateral que no cabe, tamaño de los campos de hora y fecha.
- Los tres trabajan sobre una copia temporal de `data/` que borran al acabar; no conectan WhatsApp ni cruceros.

Límites de lo medido:

- Se midió con Electron en este equipo (ratón, escala de pantalla 1,25): `pointer: coarse` era falso, así que las dos reglas táctiles que ya existen no estaban activas. No se ha probado en ninguna tablet real ni en Safari.
- «Pulsable» cuenta `button, a, input, select, textarea, summary, [data-action], [data-nav]` visibles; una casilla dentro de su etiqueta se mide por la etiqueta. El menú lateral se cuenta en cada pantalla (16 × 21 = 336).
- El contraste se calcula por carácter visible contra el primer fondo opaco; no mide textos sobre degradados, marcadores de campo vacío ni botones desactivados.
- No se midió: teclado en pantalla, gestos, rendimiento en una tablet, la pantalla de recetario con contraseña puesta, ni WhatsApp conectado.
- V10 y V13–V15 salen de mirar las capturas, no de una cifra.
