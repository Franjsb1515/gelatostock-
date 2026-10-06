# Lector de imágenes: batería de 50 tipos, eficiencia y arreglos (sobre 0.57.0, árbol en 0.58.0)

## Resumen
1. Se probaron las cuatro áreas que leen fotos (Documentos, Calendario, cuadrantes de turnos y adjuntos de WhatsApp) con 50 tipos de imagen distintos, inventados y regenerables (tipografías, textos, calidades y formatos). Antes: 26 exactas, 1 invento, 5 fallos en silencio. Después: 31 exactas, 0 inventos, 0 fallos en silencio.
2. El invento era grave: un horario a mano con «11-23» leído «14-23» y propuesto como hora de apertura con seguridad. Ahora el Calendario lee la foto dos veces con píxeles distintos y solo usa las cifras que salen iguales; la línea dudosa se enseña y la persona la escribe.
3. Fotos tumbadas (90° y 180°), tablas con líneas y papel con sombra, que antes salían en blanco o a medias y sin aviso, ahora se leen (la lectura prueba varias preparaciones y se queda con la mejor).
4. Lo que no se lee se dice ahora en todas las áreas con el mismo consejo: «con más luz, más cerca y de frente». En Documentos antes se callaba; un adjunto de WhatsApp sin texto se marca «Sin texto leído».
5. Los seis formatos no admitidos (HEIC, GIF, BMP, texto renombrado, vacío, más de 5 MB) se rechazan en menos de 35 ms con mensaje claro; un JPG roto, también. Dos fotos a la vez ya no se rechazan: se leen en cola.
6. Coste: la lectura es más lenta (misma carga, alternando antes/después: Documentos +8 %, Calendario +40 %, peor caso 4,7 s frente a 2,9 s) porque hace más pasadas; se descartó reducir las fotos grandes (no ahorra nada medido) y mantener un lector siempre encendido (ahorra 0,28 s por foto a cambio de ~100 MB permanentes).
7. Las garantías existentes se mantienen: fotos del Calendario 8/12 exactas y 0 inventos; cuadrantes 0 «mal y seguras» (45/11/0 y 56/0/0); `npm test` 281/281; typecheck y formato en verde.
8. No se leen y se dice: desenfoque fuerte, foto sin texto, una palabra, PDF escaneado, cuadrante reducido o ladeado (se queda en nota). Sin fotos reales del dueño: todo es sintético.

## Qué se midió y cómo
- Verdad de cada imagen: `tests/fixtures/bateria-imagenes/casos.cjs` (texto, área, qué debe proponer la app y qué no puede inventar). Imágenes: `node scripts/make-image-battery.cjs` → `work/bateria-imagenes/` (fuera de git; misma técnica que las fotos del Calendario: Electron + sharp).
- Medición: `node scripts/evaluate-image-battery.cjs --fase antes|despues` llama a las funciones reales (`src/photo-read.cjs`, que es lo que usa el servidor; `importDocument` de WhatsApp con un almacén de mentira; sin conectar nada). Resultado: `reports/bateria-imagenes-v0580.json` (lleva las dos fases; el nombre sale de package.json, que la sesión principal subió a 0.58.0 mientras tanto).
- «Texto clave leído» = proporción de palabras clave del caso presentes en el texto leído, sin tildes ni mayúsculas. Clases: EXACTA / PARCIAL-Y-AVISADA / NO LEÍDA-Y-DICHA / NO LEÍDA-SIN AVISO (no inventa, pero calla) / INVENTO.
- Cada caso lleva un «ideal» (lo mejor posible con esa imagen): 44 de 50 lo alcanzan después (37 antes).

## Los 50 tipos, antes → después
Los tiempos de esta tabla son los de cada pasada completa y NO son comparables entre columnas (el equipo tenía otra carga en cada fase: la otra sesión ejecutaba pruebas). La comparación justa está en «Eficiencia».

| Id | Área | Tipo | Ideal | Antes | Después | Texto clave | ms (no comparable) |
|---|---|---|---|---|---|---|---|
| D01 | Documentos | Letra con remates (serif) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 585 → 2159 |
| D02 | Documentos | Letra de palo (sans) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 1184 → 1722 |
| D03 | Documentos | Monoespaciada | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 614 → 1619 |
| D04 | Documentos | Condensada | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 564 → 1961 |
| D05 | Documentos | Negrita y MAYÚSCULAS | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 1266 → 2027 |
| D06 | Documentos | Letra pequeña (9 px) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 518 → 1991 |
| D07 | Documentos | Ticket térmico estrecho y largo, letra de recibo, miles con punto | EXACTA | EXACTA | EXACTA | 0.90 → 0.90 | 1390 → 3013 |
| D08 | Documentos | Dos fuentes mezcladas y tabla con líneas | EXACTA | NO LEÍDA-SIN AVISO | EXACTA | 0.10 → 1.00 | 461 → 2913 |
| D09 | Documentos | Dos columnas y tabla sin líneas | EXACTA | PARCIAL-Y-AVISADA | EXACTA | 0.90 → 0.90 | 1317 → 2746 |
| D10 | Documentos | Otro idioma: italiano | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 614 → 2105 |
| D11 | Documentos | Otro idioma: catalán | EXACTA | EXACTA | EXACTA | 0.88 → 0.88 | 628 → 1958 |
| D12 | Documentos | Girada 90° | EXACTA | NO LEÍDA-SIN AVISO | EXACTA | 0.00 → 1.00 | 970 → 3155 |
| D13 | Documentos | Girada 180° (del revés) | EXACTA | NO LEÍDA-SIN AVISO | EXACTA | 0.00 → 1.00 | 1451 → 4588 |
| D14 | Documentos | Texto claro sobre fondo oscuro | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 865 → 2852 |
| D15 | Documentos | Perspectiva (foto de lado, trapecio) | EXACTA | EXACTA | EXACTA | 0.90 → 0.90 | 1166 → 841 |
| D16 | Documentos | Desenfoque fuerte (ilegible) | NO LEÍDA-Y-DICHA | NO LEÍDA-SIN AVISO | NO LEÍDA-Y-DICHA | 0.00 → 0.00 | 783 → 1105 |
| D17 | Documentos | Sello y firma encima del texto | EXACTA | EXACTA | EXACTA | 0.90 → 0.90 | 1281 → 1067 |
| D18 | Documentos | Dos documentos en la misma foto | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | 1.00 → 1.00 | 995 → 763 |
| D19 | Documentos | Resolución muy alta (4000 px de ancho) | EXACTA | PARCIAL-Y-AVISADA | EXACTA | 0.90 → 0.90 | 1964 → 1461 |
| C01 | Calendario | A mano, letra suelta, papel pautado, girada 2° | EXACTA | INVENTO | PARCIAL-Y-AVISADA | 1.00 → 1.00 | 757 → 1219 |
| C02 | Calendario | A mano, letra caligráfica enlazada | EXACTA | EXACTA | EXACTA | 0.80 → 0.80 | 539 → 778 |
| C03 | Calendario | Letra grande (64 px), fecha «5 de octubre» | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 683 → 765 |
| C04 | Calendario | Ruido y JPEG muy comprimido, fecha 05-10-26 | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 516 → 610 |
| C05 | Calendario | Abreviaturas (Lun., Mar.) y horas «11h» | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 548 → 676 |
| C06 | Calendario | Lista con viñetas, tildes y ñ, línea muy larga | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 598 → 561 |
| C07 | Calendario | Captura de pantalla de móvil con barra de estado | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 450 → 569 |
| C08 | Calendario | Foto de una pantalla (moaré) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 1036 → 1448 |
| C09 | Calendario | Girada 5° | EXACTA | EXACTA | PARCIAL-Y-AVISADA | 1.00 → 1.00 | 605 → 917 |
| C10 | Calendario | Bajo contraste (gris sobre gris) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 456 → 604 |
| C11 | Calendario | Papel de color arrugado con sombra diagonal | EXACTA | PARCIAL-Y-AVISADA | EXACTA | 0.30 → 1.00 | 504 → 1222 |
| C12 | Calendario | Recorte que corta el borde del texto | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | 0.43 → 0.43 | 431 → 540 |
| C13 | Calendario | Sin texto: foto de un objeto | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 582 → 736 |
| C14 | Calendario | Muy poco texto: una palabra | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | 1.00 → 1.00 | 386 → 410 |
| C15 | Calendario | Resolución baja (600 px de ancho) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 623 → 728 |
| C16 | Calendario | Versalitas | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 706 → 818 |
| R01 | Cuadrante | Captura nítida (PNG) | EXACTA | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | — | 10403 → 10530 |
| R02 | Cuadrante | JPG comprimido y reducido al 70 % | EXACTA | NO LEÍDA-Y-DICHA | PARCIAL-Y-AVISADA | — | 974 → 5229 |
| R03 | Cuadrante | Foto de móvil girada 2° | EXACTA | NO LEÍDA-Y-DICHA | PARCIAL-Y-AVISADA | — | 1801 → 3835 |
| R04 | Cuadrante | Modo oscuro (colores invertidos) | EXACTA | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | — | 1255 → 9398 |
| R05 | Cuadrante | Tabla sin líneas | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | PARCIAL-Y-AVISADA | — | 1136 → 4352 |
| W01 | WhatsApp | Adjunto JPG recomprimido (1000 px, calidad 30) | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 738 → 936 |
| W02 | WhatsApp | Adjunto en cursiva con desenfoque leve | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 553 → 831 |
| W03 | WhatsApp | Adjunto WebP en inglés | EXACTA | EXACTA | EXACTA | 1.00 → 1.00 | 570 → 813 |
| W04 | WhatsApp | PDF escaneado (una foto dentro, sin texto) | NO LEÍDA-Y-DICHA | NO LEÍDA-SIN AVISO | NO LEÍDA-Y-DICHA | 0.00 → 0.00 | 55 → 822 |
| F01 | Formatos | HEIC (foto de iPhone) | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 1 → 3 |
| F02 | Formatos | GIF | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 0 → 22 |
| F03 | Formatos | BMP | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 0 → 10 |
| F04 | Formatos | Un .txt renombrado a .jpg | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 0 → 14 |
| F05 | Formatos | Archivo vacío | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 0 → 2 |
| F06 | Formatos | Imagen de más de 5 MB | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | NO LEÍDA-Y-DICHA | — | 15 → 31 |

Recuento: antes EXACTA 26 · PARCIAL-Y-AVISADA 8 · NO LEÍDA-Y-DICHA 10 · NO LEÍDA-SIN AVISO 5 · INVENTO 1. Después EXACTA 31 · PARCIAL-Y-AVISADA 9 · NO LEÍDA-Y-DICHA 10 · NO LEÍDA-SIN AVISO 0 · INVENTO 0.

Notas de la tabla:
- C01 (antes INVENTO): «Miércoles 11-23» y «Viernes 11-23» se leían «14-23» con confianza 76–88, indistinguible de una lectura buena por la confianza sola (las buenas van de 72 a 96). Ahora la segunda lectura no confirma esas cifras y las dos líneas (y el título «del 42. al 18») se enseñan como dudosas. Se pierde la exactitud de esos días, no se inventa nada.
- C09 (antes EXACTA, ahora PARCIAL): la segunda lectura lee «41» donde pone «11» en el título, así que la fecha queda sin proponer y la persona elige el día. Es el precio de contrastar: una línea buena se descarta a veces.
- D18 (dos documentos): la app dice «Hay varios proveedores posibles. Elige el emisor» y propone «factura» (es el primer encabezado). Ideal alcanzado.
- C12 (recorte): las primeras letras de cada línea se pierden («istacho 3,2 kg»): va como nota con la fecha; no se apunta ninguna venta.
- R04 (modo oscuro): antes se leía como texto suelto; ahora se ve como cuadrante (42 casillas seguras y bien, 0 mal), pero falta una persona (la fila de SARA no se reconoce): a revisar.
- R02, R03, R05: no se ven como cuadrícula (líneas grises, ladeada, sin líneas) y van como nota con el texto en bruto, con aviso de cifras dudosas. Antes R02 y R03 salían «no se pudo leer».
- W04: el PDF escaneado no lleva texto y no se lee (haría falta convertir cada página en imagen; no se añade dependencia). Se archiva y la tarjeta dice «Sin texto leído».

## Eficiencia
Medido con `work/bateria-exp/bench.cjs` (no está en git): antes y después alternando en las 38 imágenes de texto, dos veces cada uno y quedándose con la mejor, para que la carga del equipo (la otra sesión estaba ejecutando pruebas) pese igual.

| | Antes | Después |
|---|---|---|
| Documentos y WhatsApp, media | 1,5–1,8 s | 1,5–1,7 s (+8 % en Documentos, menos en WhatsApp por el ruido de la carga) |
| Calendario, media | 1,7 s | 2,4 s (+40 %: segunda lectura para contrastar cifras) |
| p95 / peor caso (38 imágenes) | 2,9 s / 2,9 s | 4,6 s / 4,7 s (C09, girada 5°: varias pasadas más la segunda lectura) |
| Cuadrante nítido (R01, casilla por casilla) | 10,4 s | 10,5 s (sin cambios) |
| Memoria por lectura (RSS, media / p95 / peor) | 24 / 93 / 122 MB | 25 / 101 / 133 MB |
| Rechazo de un formato no admitido | ≤ 15 ms | ≤ 31 ms |

Hechos medidos sobre el lector:
- El lector (un hilo de tesseract) se arranca en cada foto: 278 ms de arranque medidos; durante la lectura ocupa ~100 MB. Se mantiene así a propósito (ver descartes).
- Dentro de una foto el mismo hilo hace todas las pasadas (antes también era un hilo por foto, con una sola pasada).
- Tiempo máximo: 30 s por foto (ya existía); nuevo: pasados 12 s no se empiezan más pasadas. La tabla de un cuadrante tiene su propio límite de 120 s (sin cambios).
- Dos fotos a la vez: antes la segunda se rechazaba («Ya hay una lectura en curso»), y un adjunto de WhatsApp que llegara mientras se leía otra foto se archivaba sin texto. Ahora se leen en cola (las dos: medido, 1,6 s en total); con más de 6 esperando se rechaza con mensaje.
- Una imagen enorme NO se reduce antes de leerla: medido con D19 (4000 px): 833 ms a tamaño real frente a 793–1274 ms reducida a 1200–2400 px. No hay ahorro que justifique perder detalle.
- Orientación de la cámara (marca EXIF de «gírame», típica del móvil): antes se ignoraba; ahora se endereza antes de leer (extra medido: texto clave 1,00, confianza 93).
- JPG roto (cortado por la mitad): antes el mensaje era técnico («Error attempting to read image»); ahora «No se ha podido abrir la imagen: parece dañada o incompleta…», en 0,4 s.

## Cambios hechos
- `src/ocr.cjs` (lectura): varias pasadas y elección de la mejor por cuántas letras y cifras se leen con seguridad (bloque de texto; análisis de página si la primera no es claramente buena; si aun así es pobre, sin sombras y dada la vuelta). Orientación EXIF. Segunda lectura con otros píxeles (`check`) para contrastar cifras. Cola en vez de rechazo. Mensajes sin jerga (antes «Falta el idioma OCR incluido. Reinstalá…»).
- `core/dayphoto.ts`: `doubtfulLines(text, second)` y quinto parámetro opcional de `readDayPhoto`: las líneas cuyas cifras no coinciden en las dos lecturas no se usan y se enseñan («los números no se leen igual dos veces seguidas. Escríbelos tú»). Una lectura con confianza < 35 ya no se propone como nota por larga que sea (antes bastaban 60 letras de basura).
- `core/identify.ts`: «Gelato ltalia» (l por I, confusión típica de la lectura) propone el proveedor, con menos peso que el nombre exacto y solo en Documentos (D09 y D19 pasan a exactas).
- `src/table-ocr.cjs`: una captura en modo oscuro se invierte antes de buscar la cuadrícula (R04 se ve como cuadrante; los cuadrantes claros, sin cambio).
- `src/photo-read.cjs` (nuevo): el camino de cada área en un solo sitio, usado por el servidor y por las mediciones; `advice` cuando no se lee.
- `src/server.cjs`: las dos rutas de fotos llaman a `photo-read.cjs`. `src/whatsapp.cjs`: registro sin «OCR».
- Pantalla: `src/ui/forms.js` enseña el aviso de foto no leída y dice «a mano» (no «manualmente»); `src/ui/calendar-photo.js` añade el consejo al «No se pudo leer»; `src/ui/views-documents.js` marca «Sin texto leído».
- Medición: `scripts/make-image-battery.cjs`, `scripts/evaluate-image-battery.cjs`, `tests/fixtures/bateria-imagenes/casos.cjs`; `scripts/evaluate-calendar-photos.cjs` ahora mide por el mismo camino que la app (`readCalendarPhoto`, incluida la detección de cuadrante y la segunda lectura), no solo la lectura suelta.
- Pruebas nuevas en `tests/dayphoto.test.cjs` y `tests/identify.test.cjs` (segunda lectura, l/I, cola de dos lecturas, archivo roto).

## Cambios descartados (medidos)
- Reducir las fotos grandes antes de leer: sin ahorro (833 ms frente a 793–1274 ms).
- Lector siempre encendido entre fotos: ahorraría 0,28 s por foto a cambio de ~100 MB fijos y de complicar las pruebas y el cierre; la app lee pocas fotos al día.
- Análisis de página siempre como primera opción: lee las tablas por columnas (más texto, pero sin pareja día-horas) y hacía fallar 01-horario-impreso de las fotos del Calendario (8/12 → 7/12). Se usa solo si la primera pasada no es claramente buena y gana solo si lee claramente más (umbral 1,3×, medido).
- Umbral más bajo para encontrar la cuadrícula de un cuadrante reducido (R02): lo ve como cuadrante, pero saca una «persona» inexistente («C Contmacio N») con un turno dado por seguro: INVENTO. Descartado.
- Confirmar una cifra con cualquiera de varias lecturas (unión): cuela «14-23» en C01. Solo vale una segunda lectura con píxeles distintos (ampliada 1,5×; 0,75× si la foto supera 2200 px); el análisis de página sobre los mismos píxeles repite los mismos errores.
- Rechazar cifras por confianza baja de la palabra: las mal leídas tenían 76–88 y las buenas 72–96; no separa.
- Leer PDF escaneados: haría falta convertir páginas en imágenes (dependencia nueva). Se dice «Sin texto leído».

## Qué NO se lee y qué se le dice a la persona
- Desenfoque fuerte, foto sin texto, una sola palabra: Calendario «No se pudo leer: la foto se guarda en su día y puedes escribir lo que dice. Si la repites: con más luz, más cerca y de frente.» Documentos: «La foto no se ha leído bien (o nada). Puedes guardarla igual y elegir el proveedor a mano. Si la repites: …».
- Cuadrante ladeado, reducido/comprimido o sin líneas: no se ve como cuadrante y va como nota con el texto en bruto y aviso de cifras dudosas. Para leerlo casilla por casilla hace falta la captura recta y nítida.
- Letra a mano con cifras: se leen, pero cualquier línea cuyas cifras no salgan iguales dos veces se aparta y se pide escribirla (C01: 3 de 6 líneas).
- Dos documentos en una foto: se pide elegir el proveedor.
- Un recorte que corta el texto: va como nota, no como ventas.
- PDF escaneado: «Sin texto leído» en la tarjeta de Documentos.
- Formatos no admitidos: «Usa una imagen JPG, PNG o WebP de hasta 5 MB.» / «El contenido no corresponde a una imagen válida.» / «La imagen supera 5 MB.» (coinciden con lo que acepta el servidor y con lo que dicen las pantallas: «JPG, PNG o WebP hasta 5 MB · PDF hasta 10 MB»).

## Textos de pantalla revisados
Coherentes entre áreas: «Elige una foto» / «Elige una foto o un PDF», mismos formatos y tamaños que el servidor, «Leyendo la foto en este equipo…», «a mano» en vez de «manualmente», sin «OCR», «confianza» ni «modelo» en pantalla (comprobado con grep en src/ui). Lo grande que queda (no hecho): Documentos no propone la fecha del documento desde la foto (el campo sale con la fecha de hoy); «Texto leído del documento» es un desplegable que la persona puede no abrir.

## Lo no comprobado
- Fotos reales del dueño: no hay ninguna; todo es sintético (fuentes del equipo, incluidas las de imitación de letra a mano). Las cifras de aciertos no prometen nada con fotos reales; las de «0 inventos» son la garantía que se mide.
- Pantallas: no se ejecutó `test:desktop` ni se reconstruyó el ejecutable (lo pide el reparto); los textos se cambiaron en el código y pasan `npm test`.
- Rendimiento en un equipo sin carga: los tiempos absolutos salieron con otra sesión ejecutando pruebas; la comparación alternada es la válida.
- Fotos con sombra lateral de otra forma, o cuadrantes reales: fuera de la batería.

## Cómo repetirlo
```
node scripts/make-image-battery.cjs            # imágenes en work/bateria-imagenes/
npm run build && node scripts/evaluate-image-battery.cjs --fase despues
node scripts/evaluate-calendar-photos.cjs      # 8/12, 0 inventos
node scripts/evaluate-roster.cjs               # 0 mal y seguras
```
