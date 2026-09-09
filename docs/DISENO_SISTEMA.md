# Sistema de diseño «Mediterraneo» · GelatoStock para Artello

Documento de referencia de la interfaz (src/styles.css, src/ui/*.js, src/index.html). Describe los tokens, la escala tipográfica, los componentes y sus estados, la identidad por pantalla, el inventario de defectos encontrado antes de la revisión de 2026-09-09 y lo que cambió en cada pantalla. Sin fuentes web ni recursos externos: la CSP exige `'self'`, así que la tipografía es de sistema (Segoe UI en Windows) y Georgia para títulos.

## 1. Principios

- Objeto de la casa: sobrio, cálido, artesano y preciso. Crema como fondo, paneles casi blancos, pistacho profundo para títulos y acciones principales; rosa y azafrán solo como acentos de estado o de sección.
- Legibilidad antes que ornamento: ningún texto por debajo de 12 px; contraste AA (≥ 4,5:1 en texto normal, ≥ 3:1 en texto grande e iconos); párrafos de ≤ 72 caracteres (`--measure: 64ch`).
- Ritmo de 8 px: espaciados, alturas de control y separaciones se toman de `--s-1…--s-8`.
- Una sola escala tipográfica (12/13/14/15/18/22/32) y dos interlineados (1,2 títulos; 1,55 texto).
- Cada decisión visual tiene un motivo funcional. Nada nuevo en funciones: solo composición, tokens y plantillas.

## 2. Tokens (`:root` en src/styles.css)

### Paleta

| Token               | Valor     | Uso                                                |
| ------------------- | --------- | -------------------------------------------------- |
| `--pistacho`        | `#35604a` | Títulos, botón primario, navegación activa         |
| `--pistacho-oscuro` | `#2f5a44` | Hover del primario, texto sobre pistacho claro     |
| `--pistacho-claro`  | `#e6eedc` | Fondo de navegación activa, píldora «sage»         |
| `--pistacho-suave`  | `#f0f4e9` | Avisos suaves, zonas de carga, tarjeta local       |
| `--rosa`            | `#c85c73` | Marcador de navegación activa, puntos de no leído  |
| `--rosa-texto`      | `#9a3652` | Texto sobre rosa claro (5,9:1), peligro            |
| `--rosa-claro`      | `#fbe7ec` | Píldora «peach», error de formulario               |
| `--azafran`         | `#e0a53a` | Solo decorativo (punto del hero, acento Compras)   |
| `--azafran-texto`   | `#7f5410` | Texto sobre azafrán claro (5,7:1)                  |
| `--azafran-claro`   | `#fbeccf` | Píldora «sand», ejemplo de Control de entregas     |
| `--lavanda-texto`   | `#5d4e8c` | Texto sobre lavanda claro (6,0:1)                  |
| `--lavanda-claro`   | `#eee9f4` | Píldora «lavender», acento IA local                |
| `--arena-claro`     | `#f3eddf` | Aviso estándar, avatar                             |
| `--crema`           | `#fbf7f0` | Fondo de la app                                    |
| `--crema-panel`     | `#fffdf9` | Paneles, barra lateral, superior                   |
| `--crema-hundida`   | `#f5f0e6` | Cabeceras de tabla, rutas, hover de botón          |
| `--acero`           | `#6b7680` | Acento de Documentos, Actividad y Configuración    |
| `--tinta`           | `#1e2a2f` | Texto principal, aviso flotante                    |
| `--ink-soft`        | `#4a5560` | Texto secundario (7,1:1 sobre crema)               |
| `--ink-muted`       | `#5a6670` | Metadatos y notas (≥ 4,9:1 sobre todos los tintes) |
| `--border`          | `#e6dfd2` | Bordes de panel y campos                           |
| `--border-soft`     | `#efeae0` | Separadores internos                               |
| `--focus`           | `#8fb07a` | Anillo de foco (3 px, desplazado 2 px)             |

Contrastes calculados con work/contrast.cjs (fórmula WCAG). `#6b7680` sobre crema da 4,34:1, por eso los textos apagados usan `--ink-muted` (#5a6670) y el acero queda para acentos e iconos.

### Tipografía

| Token     | Tamaño | Uso                                                     |
| --------- | ------ | ------------------------------------------------------- |
| `--fs-12` | 12 px  | Metadatos, píldoras, rótulos (eyebrow, cabeceras tabla) |
| `--fs-13` | 13 px  | Botones, etiquetas de campo, texto secundario           |
| `--fs-14` | 14 px  | Texto base, campos, celdas principales                  |
| `--fs-15` | 15 px  | h3, burbuja de mensaje                                  |
| `--fs-18` | 18 px  | h2 de panel                                             |
| `--fs-22` | 22 px  | Títulos de diálogo, tarjeta de entrega y proveedor      |
| `--fs-32` | 32 px  | h1 de página (Georgia), cifras del Resumen              |

Interlineados: `--lh-title: 1.2`, `--lh-text: 1.55`. Ancho de lectura: `p { max-width: 64ch }` (≈ 60–72 caracteres) salvo en tablas, burbujas y chat, que lo redefinen.

### Espaciado, radios y sombras

- `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 40, `--s-8` 48.
- `--r-sm` 6, `--r-md` 10, `--r-lg` 14, `--r-xl` 18.
- `--shadow-sm` (paneles y botones), `--shadow-md` (aviso flotante, botón crema), `--shadow-lg` (diálogos).
- Estructura: `--sidebar` 240 (216 por debajo de 1280 px), `--topbar` 64, `--control-h` 40, `--control-sm` 32, `--content-pad` 32 (24 en ventanas estrechas), `--content-max` 1560.

## 3. Identidad por pantalla

`render()` añade `class="page-<id>"` a `<main>`; cada clase redefine `--accent`, `--accent-soft` y `--accent-text`. El acento aparece solo en: punto y rótulo de la cabecera (`.eyebrow`), pestaña seleccionada, conversación seleccionada, bloque de propuesta y ejemplo, puntos de actividad e icono de aviso. Los botones primarios siguen siendo pistacho en toda la app para no confundir la jerarquía.

| Pantalla      | `--accent` | Texto de acento | Carácter                                  |
| ------------- | ---------- | --------------- | ----------------------------------------- |
| Resumen       | pistacho   | `#35604a`       | Rótulo «TU NEGOCIO, EN ORDEN», hero verde |
| Inventario    | `#5c8a4c`  | `#2f5a44`       | Pestañas verdes, tabla                    |
| Compras       | azafrán    | `#7f5410`       | Ejemplo de entregas en azafrán claro      |
| Producción    | `#7f9b5a`  | `#3f6a2f`       | Tarjetas de receta en serif               |
| Mensajes      | rosa       | `#9a3652`       | Conversación seleccionada rosa claro      |
| WhatsApp      | `#4a7a5c`  | `#35604a`       | Paneles de estado                         |
| Proveedores   | `#c99a42`  | `#7f5410`       | Nombres en serif                          |
| Documentos    | acero      | `#4a5560`       | Propuesta en arena claro                  |
| Actividad     | acero      | `#4a5560`       | Puntos de actividad en acero              |
| IA local      | `#8a78b8`  | `#5d4e8c`       | Resultado y chat en lavanda claro         |
| Configuración | acero      | `#4a5560`       | Tarjetas neutras                          |

El rótulo de cabecera muestra el nombre de la sección (Resumen conserva «TU NEGOCIO, EN ORDEN»); el título en Georgia y la descripción no cambian.

## 4. Componentes y estados

- **Cabecera de página** (`.page-heading`): rótulo con punto de acento, h1 serif 32 px, descripción 14 px ≤ 64ch, acciones a la derecha con envoltura (`flex-wrap`). En ventanas estrechas las acciones bajan de línea sin solaparse.
- **Botones** (`.btn`): 40 px de alto, 13 px, radio 10; `primary` (pistacho, hover pistacho oscuro), `secondary` (panel con borde, hover crema hundida), `danger` (rosa texto, hover rosa claro), `cream` (solo en el hero), `full`. Estado `disabled` al 50 % sin cambio en hover; `:active` baja 1 px; foco con anillo verde de 3 px. `.text-button` (13 px, 28 px de alto, hover pistacho suave). `.icon-button` 36 px (`.bordered` 32 px). Los botones dentro de tarjetas de documento y de fotos usan 32 px (`--control-sm`).
- **Filas de acciones** (`.row-actions`, `.setting-actions`, `.message-actions`, `.heading-actions`): flex con hueco de 8 px y envoltura; todos los botones comparten altura.
- **Campos** (`.field`, `.inline-input`, `.quantity`, `.ingredient-row`): etiqueta 13 px semibold, control de 40 px (36 en tablas), borde `--border`, foco con borde pistacho y anillo pistacho claro, `readonly` en crema hundida. `.form-grid` en dos columnas para fichas. `.check`/`.check-label` con casilla en color pistacho.
- **Píldoras** (`.pill` + `neutral|sage|peach|lavender|sand|rose`): 12 px, radio completo, texto AA sobre cada tinte.
- **Avisos** (`.notice`, `.subtle`, `.inline`, `.home-notice`): icono con color de acento, título 14 px, texto 13 px ≤ 64ch; en el Resumen los avisos múltiples se separan 12 px.
- **Panel** (`.panel`, `.panel-heading`): radio 14, borde, sombra suave; cabecera con título 18 px y descripción 13 px; acciones alineadas al centro.
- **Tabla** (`table`, `.table-wrap`, `.delivery-table`): cabecera 12 px sobre crema hundida, celdas 13/14 px, `strong` en tinta, desplazamiento horizontal dentro del panel (`overflow: auto`), nunca en la página.
- **Pestañas y búsqueda** (`.tab`, `.search`): 32 px de alto; pestaña seleccionada en acento suave; búsqueda con foco visible.
- **Estado vacío** (`.empty`, `.compact`): icono, título y frase que indica qué hacer (Mensajes: cambiar filtro o borrar búsqueda; Compras: añadir producto o preparar reposición; Documentos: añadir foto/PDF o autorizar chats; Producción: registrar producción o crear receta).
- **Diálogo** (`dialog`, `.modal-heading`, `.modal-body`, `.modal-footer`): 580 px, radio 18, título serif 22 px, cuerpo desplazable con pie fijo, fondo difuminado; error de formulario en rosa claro.
- **Aviso flotante** (`#toast`): tinta sobre crema, centrado en el área principal.
- **Burbujas** (`.message-bubble`, `.outgoing`, `.ai-chat-msg`): 15 px, radio asimétrico, ≤ 72ch; salientes en pistacho claro; chat con mensajes propios alineados a la derecha.
- **Tarjeta de documento** (`.doc-card`): rejilla de 76 px + contenido; miniatura a la izquierda, nombre/metadatos/etiquetas a la derecha; propuesta (`.doc-suggestion`) y acciones (`.doc-actions`) ocupan todo el ancho; botón «Aceptar» alineado a la derecha del texto; tarjetas de mínimo 340 px.
- **Tarjeta de producción** (`.production-card`) y **receta** (`.recipe-card`): nombre en serif 18 px, cantidad y fecha en línea propia, tabla con borde, acciones al pie.
- **Tarjeta de entrega** (`.delivery-card`): número de pedido en versalitas 12 px, proveedor serif 22 px, progreso, tabla y pie con siguiente paso y acciones alineadas a la derecha con envoltura.
- **Navegación** (`.sidebar`, `.nav-item`, `.nav-count`): marca con lema en línea propia, ficha del negocio, lista agrupada («MI NEGOCIO»), tarjeta local (oculta por debajo de 900 px de alto), Configuración y perfil anclados abajo; elemento activo en pistacho claro con marcador rosa; contador en pistacho (rosa oscuro en activo).
- **Iconografía**: SVG de src/ui/core.js, trazo 1,65, esquinas redondeadas; 18 px en navegación, 16 px en botones, 20 px en cifras.

## 5. Inventario visual «antes» (output/design/antes, 2026-09-09)

Capturas de cada pantalla a 1280×800, 1440×900, 1920×1080 y 1000×700 más 27 diálogos, generadas con work/design-capture.cjs (Electron sin empaquetar + Playwright, `GELATO_DATA_DIR` en work/). La auditoría automática del DOM (texto < 11 px, contraste, texto cortado, solapamientos, alturas de botón, desplazamiento horizontal) dio 1 165 hallazgos en pantallas y 118 en diálogos. Resumen por pantalla:

- **Todas**: rótulos de 8–10 px (`.eyebrow`, `.message-label`, `.nav-label`, `th`, `.pill`, `.stat small`, `.brand small`, `footer`); texto apagado `#909787`/`#8d9490` a ≈ 3:1; botones de 38 px con texto de 11 px; barra lateral con barra de desplazamiento visible a 1440×900 y «Configuración» y el perfil fuera de la vista sin desplazar; lema de marca partido en dos líneas.
- **Documentos**: la caja de propuesta desbordaba la tarjeta, el botón «Aceptar» pisaba el texto y las cinco acciones se apilaban en columnas de tres líneas.
- **Resumen**: cifras 28 px con etiquetas de 9–10 px; aviso combinado sin separación entre bloques; texto del hero a 11 px sobre el degradado.
- **Inventario**: cabeceras de tabla 9 px, detalle de producto 9–10 px, acciones «Contar/Editar» de 10 px.
- **Compras**: carrito con notas de 9 px; pie de la tarjeta de entrega con texto y botones a distintas alturas al reducir la ventana.
- **Producción**: nombre y cantidad de la producción pegados («Gelato de chocolate4 kg»); tarjeta de receta de 260 px.
- **Mensajes**: rótulos de 8 px, estado de conversación 9 px, fecha 9 px; estado vacío sin indicación.
- **WhatsApp**: notas de 10 px y textos apagados por debajo de AA.
- **Proveedores**: información de 11 px en gris claro.
- **Actividad**: tabla con las mismas cabeceras de 9 px; filas con texto apagado.
- **IA local**: chat en la columna izquierda con la derecha vacía; notas de 10 px.
- **Configuración**: rutas y notas de 8–10 px; pie de foto con botones en línea con el nombre; lista de aprendizaje con botón desalineado.
- **Diálogos**: descripciones de 11 px, etiquetas de campo de 11 px, textos de 10 px (`.fineprint`); contraste insuficiente en todos.
- **Inicio**: correcto (≈ 1,4 s, no bloquea); se conserva.

## 6. Qué cambió por pantalla y por qué

- **Estructura**: `src/styles.css` reescrita desde cero sobre tokens (463 reglas ordenadas por componente, formato Prettier de una declaración por línea; un solo `!important`, el de `prefers-reduced-motion`; sin bloques de «ajustes tras revisión» ni colores sueltos); misma nomenclatura de clases para no romper contratos de la prueba de escritorio. `<main class="page-…">`, rótulo por sección y lema de marca en línea propia en `src/ui/core.js`.
- **Barra lateral**: sin barra de desplazamiento a ≥ 800 px de alto (elementos de 38 px, tarjeta local oculta por debajo de 900 px, ficha del negocio oculta por debajo de 760 px); Configuración y perfil siempre visibles; nombres largos con puntos suspensivos.
- **Resumen**: cifras en Georgia 32 px, etiquetas 13 px; hero con degradado más oscuro para que el texto de 14 px cumpla AA; aviso combinado con bloques separados; tarjeta de bandeja con vista previa de tres líneas.
- **Inventario**: cabeceras 12 px, celdas 13/14 px, pestañas y búsqueda de 32–40 px, acciones de fila como botones de texto de 13 px.
- **Compras**: carrito con cantidades de 36 px y precio alineado; resumen con total serif; tarjetas de entrega con número en versalitas, proveedor serif, ejemplo en acento azafrán y pie con acciones alineadas.
- **Producción**: nombre y cantidad en líneas propias; tabla con borde dentro de la tarjeta; recetas de ≥ 320 px con acciones al pie; ventas y mermas con campos de 36 px.
- **Mensajes**: filtros con etiquetas de 13 px; lista con conversación seleccionada en acento rosa; burbuja 15 px ≤ 72ch; lectura por reglas en panel con separadores; estado vacío que dice qué hacer (título + indicación, manteniendo el texto exacto que comprueba la prueba).
- **WhatsApp**: paneles con acciones de 40 px, notas 12–13 px AA, diagnóstico en monoespaciada de 12 px, QR con borde.
- **Proveedores**: rejilla de tarjetas ≥ 340 px, nombre serif 22 px, información 13 px, pie con acciones a la misma altura.
- **Documentos**: tarjeta rediseñada (ver componentes); botón «Aceptar» alineado; acciones en fila con envoltura ordenada; plantilla en `src/ui/views.js` (`documentCard`).
- **Actividad**: tabla con la misma cabecera 12 px; actividad reciente con puntos de acento y texto 14 px.
- **IA local**: chat ocupa las dos columnas; resultado en lavanda claro con título 18 px; mensajes propios a la derecha.
- **Configuración**: rutas 12 px legibles; archivo de fotos en rejilla de ≥ 200 px con pie y acciones en fila (`src/ui/views.js`); lista de aprendizaje con botón de 32 px alineado; pasos con 14 px.
- **Diálogos**: título serif 22 px, descripción 13 px, campos 40 px, pie fijo con el cuerpo desplazable, error en rosa claro.
- **Inicio**: sin cambios de tiempo (1,4 s + 0,5 s de desvanecimiento, sin bloquear); tokens aplicados.

## 7. Criterios de aceptación y verificación

Método: `node work/design-capture.cjs despues` vuelve a capturar en output/design/despues y escribe audit.json / audit-resumen.txt con los mismos criterios. Compara con output/design/antes.

- Sin solapamientos ni textos cortados a 1280×800, 1440×900, 1920×1080 y 1000×700: ver sección 8.
- Contraste AA: ver sección 8.
- Foco visible: `:focus-visible` con anillo de 3 px en todo control; campos con borde pistacho y anillo claro; orden de tabulación el del DOM (barra lateral → cabecera → contenido).
- Escala única y ritmo de 8 px: solo se usan `--fs-*` y `--s-*`; excepciones documentadas (hero 34/38 px, inicio 56 px, cifra monetaria 26 px, control de entregas 26 px).
- Botones en fila con envoltura: `.row-actions`, `.setting-actions`, `.message-actions`, `.heading-actions`, `.doc-actions`, `.supplier-card-footer`, `.tracking-tabs`.
- Tarjetas ≥ 320 px: `.doc-grid` 340, `.recipe-grid` 320, `.supplier-grid` 340, `.stat` en 4/2 columnas.
- Párrafos ≤ 72 caracteres: `--measure: 64ch`.
- Estado vacío con guía: Resumen, Inventario, Compras, Producción (tres), Mensajes, Documentos, Actividad, WhatsApp, Configuración.
- Inicio ≤ 1,5 s: `dismissSplash()` sin cambios (1,4 s), la interfaz ya está renderizada debajo.

## 8. Resultado de la verificación (2026-09-09)

- `node work/design-capture.cjs despues`: 44 capturas de pantalla (11 pantallas × 4 tamaños, más vista completa), 27 diálogos y estados especiales (carrito con líneas, recetario bloqueado, listas vacías). Auditoría del DOM: 0 hallazgos en las 73 vistas auditadas (antes: 1 165 en pantallas y 118 en diálogos). Resumen en output/design/despues/audit-resumen.txt y detalle en audit.json. El diálogo «Enviar por WhatsApp» no se captura porque sin canal conectado el servidor responde 400 y la app muestra un aviso en lugar del diálogo (comportamiento previo, no de diseño).
- Foco por teclado: `node work/design-focus.cjs` recorre con Tab y guarda output/design/despues/foco-navegacion.png, foco-contenido.png y orden-tabulacion.txt (marca → navegación → Configuración → campana → acciones de cabecera → contenido).
- `npm test`: 110 pruebas aprobadas, 0 fallos.
- `npm run format:check`: sin avisos.
- `npm run package:win`: dist/GelatoStock-0.14.0-win32-x64 reconstruido con el CSS final.
- `npm run test:desktop` sobre ese ejecutable: 11 PASS, salida 0 (copia en output/design/despues/desktop-smoke-final.txt). El único mensaje de consola (400 en /api/whatsapp preview sin conexión) ya aparecía en reports/desktop-smoke-2026-09-09-v0140.txt.
- Contratos de la prueba conservados: textos, `aria-label`, ids (`#doc-supplier`, `#message-filter`, `#ai-text`, `#ai-mode`, `#ai-chat-input`, `#modal-form`) y clases (`.doc-card`, `.delivery-card`, `.orders-panel`, `.production-card`, `.reply-reading`, `.ai-result`, `.ai-chat-answer`, `.conversation`, `.detection-status`, `.photo-grid img`, `.icon-button[aria-label="Ver mensajes"]`).

## 9. Límites conocidos

- La auditoría de contraste es aproximada (no evalúa texto sobre degradados ni imágenes); el hero se calculó a mano (`#eef4e6` sobre `#35604a` ≥ 6:1).
- El separador «/» de la miga de pan es decorativo y se dejó en `--ink-muted` para superar AA aunque no transmite información.
- Los diálogos largos (Nuevo proveedor, Añadir documento) se desplazan dentro del cuerpo a 900 px de alto; el pie con Guardar/Cancelar queda siempre visible.
- No se han añadido fuentes propias (CSP `'self'`); en Mac la tipografía de sistema será distinta y debe revisarse en hardware real.
- El texto de la interfaz no se ha reescrito (voseo/tuteo tal como estaba) salvo la guía del estado vacío de Mensajes y el rótulo por sección.
- A 1000×700 la tabla de Inventario (seis columnas) pasa a texto con saltos de línea y, si aun así no cabe, se desplaza dentro del panel (`.table-wrap`), nunca la página.
- Las herramientas de captura y auditoría viven en work/ (design-capture.cjs, design-focus.cjs, contrast.cjs), carpeta excluida de Git; las capturas en output/design/ también. Si se quieren conservar como prueba del repositorio habrá que moverlas a scripts/ y tests/, cosa que este encargo no autorizaba.
