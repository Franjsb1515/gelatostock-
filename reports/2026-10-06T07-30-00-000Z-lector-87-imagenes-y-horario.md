# 0.61.0 · Lector de imágenes a prueba con 87 tipos (15 por área), horario sin límite de personas, textos pulidos

Fecha: 2026-10-06. Versión anterior: 0.60.0. Encargo del usuario: «prueba con más tipos de imágenes, que sepa dónde va cada una y de qué se trata; 15 imágenes generadas por cada área»; «horarios: más de 3 líneas de personas y eliminar»; «un agente en paralelo que limpie y pula la aplicación y los textos»; «recomendaciones al finalizar».

## 1. Batería de imágenes: de 50 a 87 tipos

Casos nuevos en tests/fixtures/bateria-imagenes/casos.cjs (las imágenes se generan con scripts/make-image-battery.cjs en work/bateria-imagenes/, fuera de git; siguen siendo SINTÉTICAS):

| Área | Antes | Ahora | Qué se añadió |
|---|---|---|---|
| Documentos («Añadir un documento») | 19 | 26 | variantes de archivo válidas: PNG 16 bits, JPEG CMYK, JPEG progresivo, PNG semitransparente, JPEG en gris, PNG entrelazado de 16 colores, foto tumbada con marca de orientación (EXIF 6) |
| Calendario («Subir foto») | 16 | 16 | — |
| Cuadrantes (tabla persona × día) | 5 | 15 | desenfoque leve, reducido al 50 % y JPG 35, ruido fuerte, girado 5°, moaré, 700 px de ancho, modo oscuro + desenfoque, JPG de calidad 20, dibujado con líneas en papel de color, dibujado con líneas girado 2° con ruido (opción `lines` nueva en el generador) |
| Adjuntos de WhatsApp | 4 | 15 | ticket con ruido, factura girada 90°, albarán a 600 px, italiano, WebP oscuro, perspectiva, papel con sombra, captura de una conversación, ilegible, letra pequeña muy comprimida, inglés del revés |
| Formatos no admitidos o dañados | 6 | 15 | SVG, TIFF, AVIF, ZIP renombrado a .png, PNG renombrado a .jpg, JPG cortado, PDF renombrado a .png, JPG con solo la cabecera, imagen de 1 × 1 píxel (vale rechazarla o aceptarla sin texto: `either`) |

Resultado final (reports/bateria-imagenes-v0610.json, work/eval-battery-0610b.log):

| Área | Casos | En su ideal | Inventos |
|---|---|---|---|
| Documentos | 26 | 26 | 0 |
| Calendario | 16 | 14 | 0 |
| Cuadrantes | 15 | 3 | 0 |
| WhatsApp | 15 | 14 | 0 |
| Formatos | 15 | 15 | 0 |
| **Total** | **87** | **72** | **0** |

Fuera de su ideal (ninguno inventa): C01 y C09 (fecha no leída en una foto a mano girada y en una girada 5°, ya conocidos); 12 cuadrantes «a revisar» (ninguna casilla mal dada por segura: R04 no encuentra a una persona en modo oscuro; R09 girado 5° y R11 a 700 px no se leen y lo dicen); W11 (media hoja en sombra: lee 7 líneas con muy pocas letras y ahora lo avisa).

### Lo que estaba mal y se arregló en esta versión (con la primera pasada como evidencia, work/eval-battery-0610.log)

1. **Dos inventos en cuadrantes** (R08 ruido fuerte, R13 JPG de calidad 20): «19:00-00:00» se leía «13:00-00:00» o «15:00-00:00» con confianza alta y se daba por seguro. Regla nueva en core/roster.ts: si en el mismo cuadrante conviven dos horas que solo se distinguen por un dígito que la lectura confunde (9/3, 9/5, 8/3, 1/7, 0/6, 0/8), ninguna se da por segura y la casilla lleva las dos como opciones. Primero se probó «solo si la otra se repite más»: no bastaba, porque la mal leída se repetía igual (dos casillas de la misma persona). Después: 0 inventos; R10 y R12 siguen exactos; tu cuadrante real (scripts/evaluate-roster.cjs): 56 seguras bien, 0 mal y seguras.
2. **Adjuntos de WhatsApp sin aviso** (W11, W13 y, tras el primer arreglo, W04): el servidor conectaba a WhatsApp el lector de una sola pasada (`recognizeLocal`) y no el de Documentos; si la foto no se leía, el adjunto se archivaba en silencio. Ahora `whatsapp.ocr = readDocumentPhoto` (el camino único de src/photo-read.cjs) y, si el lector avisa o no sale texto (también un PDF escaneado), la nota del adjunto dice «No se ha podido leer el texto del adjunto: ábrelo y revísalo» y queda en el registro. La medición usa exactamente esa conexión.
3. **Lectura a medias en Documentos** (W11): medido en los 41 documentos y adjuntos, los bien leídos traen 9 letras o más por línea y el de la sombra 3,7. Regla en readDocumentPhoto: con 4 líneas o más y menos de 6 letras por línea, aviso «Puede que falte parte del texto… comprueba el proveedor y el tipo antes de guardar». No corrige nada.

Garantías de siempre, repetidas: scripts/evaluate-calendar-photos.cjs 8/12 exactas y 0 inventos; evaluate-roster 0 «mal y seguras»; tests/roster.test.cjs 4/4.

### Respuesta honesta a «¿identifica de forma casi perfecta?»

- Dónde va cada imagen (área y tipo): en documentos y adjuntos, 40 de 41 exactos; en fotos del Calendario, 14 de 16; en archivos raros, 15 de 15 rechazados o aceptados sin inventar.
- De qué se trata (proveedor, tipo, día, horas, casillas): lo que lee lo propone y lo etiqueta; lo dudoso lo marca. En cuadrantes es prudente: 12 de 15 quedan «a revisar» aunque no se equivoque en lo que da por seguro.
- Lo que no hace: una foto girada 5° pierde la fecha o el cuadrante entero; un cuadrante a 700 px de ancho no se lee; media hoja en sombra se lee a medias (ahora avisa).
- Todo esto es con imágenes generadas. Sin fotos reales del usuario no se puede afirmar nada más.

## 2. Horario de la semana: más de tres personas y quitar

src/ui/views-calendar.js: cada línea de turno sale de `calShiftRow` y lleva una «×» (`calShiftRemove`, quita la línea sin redibujar); cada día lleva «+ Otra persona» (`calShiftAdd`, añade una línea y pone el foco). El formulario sigue mostrando tres líneas por defecto. `calReadWeek` lee las que haya: nada se guarda hasta «Guardar la semana». Estilo: la regla `.cal .cal-shift` (src/styles.css) tiene una columna más de 44 px; la primera versión dejaba la «×» en una segunda línea (captura work/check-calendario-fase2-semana.png antes y después). work/check-calendario-fase2.cjs: sin errores de página.

## 3. Textos pulidos (agente en paralelo)

Informe propio: reports/2026-10-06T06-00-00-000Z-pulido-de-textos.md. 56 puntos en pantalla y 16 frases de Guía y Ayudante; 17 archivos, +91 −91; solo textos (sin lógica ni selectores). Comprobado por el agente: 285 pruebas, typecheck, chat 60/60, volcado de las 15 pantallas sin palabras prohibidas. Lo que no cambió por ser decisión del usuario está en TODO.md ([decidir]).

## 4. Pruebas y cierre

- `npm test` 285/285 · `npm run format:check` limpio · `npm run typecheck` sin errores.
- Chat del Ayudante (la guía cambió por el pulido y el aviso de adjuntos): **60/60** (54 de la guía, 2 del modelo, 1 regla, 3 «Arte + gelato»; media 1.239 ms). reports/ai-chat-v0610.json.
- Ejecutable: dist/ArtelloAPP-0.61.0-win32-x64/ArtelloAPP.exe. Prueba de escritorio: la primera pasada falló tras 2 PASS porque el pulido cambió la etiqueta «No relevante» por «No afecta a tus pedidos» (src/ui/core.js, relevanceLabel) y scripts/desktop-smoke.cjs buscaba la antigua en dos sitios; la segunda pasada falló tras 17 PASS por lo mismo con «Dos lecturas coinciden» → «Las dos lecturas coinciden» en el Ayudante. Se actualizaron las dos expectativas a los textos nuevos (cambios de texto a propósito, no de comportamiento; el agente de textos no los detectó porque buscó cadenas exactas y estas van partidas) y se repitió: **23 PASS, salida 0** (reports/desktop-smoke-2026-10-06-v0610.txt).

## 5. Recomendaciones

1. **Manda fotos reales** (una factura, un albarán, un horario a mano, tu cuadrante de otro mes, un adjunto de WhatsApp tal cual llega): es lo único que puede subir la confianza por encima de «sintético». Con 5–10 fotos se puede medir de verdad y ajustar sin inventar.
2. **Cuadrantes**: haz la captura de pantalla en lugar de la foto cuando puedas (nítida, sin girar, a tamaño completo): 3 de 15 exactos son los nítidos; girado 5° o pequeño no se leen. Si las fotos son lo habitual, la siguiente mejora es enderezar la imagen antes de buscar la cuadrícula y ampliar las pequeñas (pendiente en TODO).
3. **Documentos**: foto de frente, sin sombra que parta la hoja; si sale «puede que falte parte del texto», repítela. Guardar con proveedor a mano sigue siendo válido.
4. **Decide los cinco puntos de texto** que el pulido dejó en tus manos (TODO.md): «Simular envío» y los pedidos de demostración, los productos y proveedores de ejemplo mezclados con los tuyos, el texto de Cruceros, los nombres «Producción a mano» y «Corregir relevancia», y el aviso «en pruebas» de WhatsApp. Son los textos que más confunden y no se pueden cambiar sin tu decisión.
5. **Antes de entregar la app**: quitar los datos de ejemplo (productos, proveedores y pedidos de demostración) para que la persona que la reciba solo vea lo tuyo.
