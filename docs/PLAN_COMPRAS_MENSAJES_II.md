# Plan · Compras y Mensajes II

Encargo condensado el 2026-09-20 sobre la versión 0.33.0. Sale de TODO.md §1 y §3 y de las cuatro respuestas del usuario de ese mismo día. Este documento es el que se lee al empezar cada fase; el detalle de cada fase cerrada va a reports/ y a docs/CONTINUIDAD.md.

Objetivo del usuario, con sus palabras: dejar el apartado de compras y mensajes «al 100 %».

## 1. Respuestas del usuario (2026-09-20)

- **«Simulación» y «Simular envío» en Compras**: dejarlo por ahora, le sirve para probar. Hay que recordárselo más adelante para sacarlo. → no se toca en este plan; queda como fase diferida al final.
- **Sustituto cuando falta un producto**: el mismo producto comprado a otro proveedor. No hace falta el «producto parecido».
- **Listas de precios**: le llegan en PDF (WhatsApp o correo) y en papel, que fotografía. Pide mejorar de verdad la foto y «que no haya errores».
- **Reclamar respuesta**: un clic, ve el texto, lo puede cambiar y se envía. Uno a uno.

## 2. Lo que ya existe (no se rehace)

- Carrito por proveedor, «Preparar reposición» descontando lo pendiente, autorización que crea un pedido por proveedor, envío real por WhatsApp con confirmación en pantalla, envío por lotes, control de entregas parciales.
- Avisos de pedido sin enviar, enviado sin respuesta y entrega vencida: `orderReminders` en core/orders.ts ya los calcula (tipo `unanswered`). Hoy solo avisan; no ofrecen nada que hacer.
- Lectura de respuestas por reglas (core/messages.ts, 10 categorías), vínculo con el pedido, y acciones propuestas desde el mensaje: fijar fecha, confirmar, quitar la línea que falta, cancelar.
- Historial de precios por producto (`state.prices`) con un campo `source` que ya admite `edit`, `document` y `message`; hoy solo se escribe `edit`.
- Documentos por proveedor con tipo `lista_precios` ya reconocido por reglas; OCR local de imágenes (tesseract, español). Los PDF se archivan sin leer.
- `sharp` viaja ya dentro del paquete de Windows (lo exige el motor de IA), así que el tratamiento de imagen no añade descargas en Windows.

## 3. Decisiones

1. **Un producto, un proveedor principal y hasta cinco alternativos.** El alternativo lo escribe él: proveedor, formato de compra y precio. Nada se rellena solo: sin precio escrito, ese alternativo se muestra con «No disponible» y no calcula importes.
2. **Comprar a un alternativo no cambia la ficha del producto.** Se elige en la línea del carrito («Comprar a …»); al autorizar, esa línea va al pedido de ese proveedor con su formato y su precio como instantánea. El proveedor principal del producto se queda como está.
3. **La app no elige el sustituto.** Cuando un mensaje dice que falta un producto y está vinculado a un pedido, la app enseña los alternativos que él apuntó, con el precio de cada uno y la diferencia con el principal, y él pulsa. Si no hay alternativos apuntados, ofrece apuntarlos.
4. **Reclamar respuesta es un envío como los demás**: texto propuesto a la vista, editable, una sola vez, a un chat autorizado, con registro en el pedido. Como mucho un recordatorio por pedido y día, y nunca automático.
5. **La plantilla del recordatorio se edita en Configuración**, junto a la del pedido, con los mismos huecos ({numero}, {proveedor}, {negocio}, {dias}).
6. **Precios leídos de un documento nunca se aplican solos.** Una lista leída propone líneas; él confirma cada una; lo confirmado entra en el historial con `source: document` y con el documento citado.
7. **El texto de un PDF se lee del propio archivo, no por OCR.** Cuando el PDF lleva texto, lo leído es exacto. Cuando es un escaneo sin texto, la app lo dice y ofrece tratarlo como foto.
8. **Toda lectura sigue siendo una propuesta revisable.** Ninguna fase de este plan cambia stock, precios ni pedidos por su cuenta.

## 4. Lo que no es viable, y qué hago en su lugar

- **«Que no haya errores» al leer una foto de una tarifa: no se puede garantizar.** Una foto de móvil de una tabla a varias columnas se lee con errores incluso con el mejor OCR local. Lo que sí puedo: leer el PDF exacto cuando lo lleva (Fase 3), preparar la imagen antes de leerla y, sobre todo, poner el original al lado de una tabla de revisión línea a línea (Fase 4). Se mide con sus fotos reales y se dice el número; no se promete cero.
- **Descargar el catálogo y los precios de la web del proveedor: no.** Sin cuenta y sin permiso, no se entra en webs de proveedores. Lo aplazado de Makro sigue aplazado.
- **Que la app adivine un sustituto por sí misma: no.** No hay dato que lo sostenga; solo enseña lo que él apuntó.
- **Leer automáticamente la lista y actualizar precios: no.** Rompe la garantía de que nada cambia solo; y un error de lectura falsearía el coste de las recetas.
- **Medir la mejora de lectura con material inventado por mí: no vale.** Hoy todos los corpus son sintéticos. Para dar una cifra creíble necesito fotos y PDF reales suyos (punto 6).

## 5. Fases

Una fase por sesión, una versión por fase, un solo cierre (pruebas, formato, ejecutable, prueba de escritorio, evaluación del chat si cambia src/ai-help.cjs, informe, CHANGELOG, TODO, continuidad, commit y ZIP).

### Fase 1 · Si falta, cómpralo a otro (0.34.0)

- Ficha del producto: «Otros proveedores donde lo compro», con proveedor, formato y precio por cada uno (máximo cinco). Schema: `alternates` en `productFields`; acción `editProduct` y formulario.
- Carrito: cada línea puede comprarse al proveedor principal o a uno alternativo. Al autorizar, los pedidos se agrupan por el proveedor elegido en la línea, y la línea guarda formato y precio de ese proveedor.
- Mensaje de «falta de producto» vinculado a un pedido: además de «quitar del pedido», ofrece «Comprarlo a …» con los alternativos apuntados, su precio y la diferencia. Un clic lo pone en el carrito de ese proveedor; no envía nada.
- De paso: los formularios de Inventario dejan de decir «unidad base» y dicen la unidad del producto («Cantidad disponible en kg»). Hay que cambiar también los nombres que busca scripts/desktop-smoke.cjs (cambia la etiqueta por decisión, no para que pase la prueba).

### Fase 2 · Reclamar respuesta y plantillas (0.35.0)

- En un pedido enviado sin respuesta ni confirmación: botón «Reclamar respuesta». Enseña el texto propuesto, se puede cambiar, se envía una sola vez por WhatsApp al chat autorizado y queda registrado en el pedido (`nudges`). Un recordatorio por pedido y día.
- El aviso del Resumen de «enviado sin respuesta» lleva a ese botón.
- Plantilla del recordatorio editable en Configuración.
- Plantillas de respuesta editables por categoría (TODO §3): hoy las respuestas rápidas son fijas en el código; pasan a Configuración, con las actuales como punto de partida.

### Fase 3 · Leer el texto de los PDF (0.36.0)

- Nueva dependencia local (pdfjs-dist u otra equivalente sin red) para sacar el texto de un PDF archivado. Sin internet, dentro del paquete, con límite de tamaño y de páginas.
- Documentos: un PDF con texto propone proveedor, tipo, fecha y total con las reglas que ya existen (core/documents.ts), igual que hoy hace una foto.
- Un PDF escaneado sin texto lo dice con claridad y no inventa.
- Decidir en esa sesión si el peso añadido al ejecutable es aceptable; si no lo es, se dice y se queda fuera.

### Fase 4 · Listas de precios en foto, en serio (0.37.0)

- Preparación de la imagen antes del OCR con `sharp` (gris, contraste, tamaño), y lectura por líneas.
- Pantalla de revisión: a la izquierda la foto o el PDF, a la derecha una tabla con lo leído (nombre, formato, precio) y a qué producto suyo corresponde cada línea. Se confirma línea a línea; lo que no cuadre se queda fuera.
- Memoria de equivalencias por proveedor (TODO §3): el nombre del proveedor para un producto se recuerda y se propone la próxima vez.
- Medición con el juego de documentos reales del punto 6 y cifra publicada en el informe.

### Fase 5 · Catálogo y precios por proveedor (0.38.0)

- Ficha del proveedor: qué le compra, a qué precio y desde cuándo, con el origen de cada precio (a mano, documento o mensaje) y el documento citado.
- Confirmar una línea de una lista escribe el precio con `source: document`; un mensaje de «sube de precio» confirmado escribe `source: message`.
- El carrito y el coste de las recetas usan ese precio como hasta ahora; el historial y los avisos de subida ya existen.

### Fase diferida (cuando lo pida)

- Quitar de Compras el vocabulario de «simulación» y el botón «Simular envío». Exige migración del almacén (`simulated` y `demo` son hoy literales en el schema) y tocar la prueba de escritorio. Él lo quiere conservar mientras prueba.

## 6. Preguntas abiertas

- **Material real para medir (Fase 4, y útil ya en la 3)**: hacen falta entre cinco y diez tarifas suyas de verdad —fotos como las que hace y algún PDF—. Puede tapar el nombre del proveedor, pero los precios y los formatos tienen que ser los reales. Sin eso, la cifra de acierto no vale nada y se dirá que no hay medición.
- **Orden**: el plan pone primero el sustituto y el recordatorio porque son los que usa cada semana, y deja las listas de precios para después por ser el trabajo largo. Si prefiere empezar por las listas, se cambia el orden sin tocar el resto.
