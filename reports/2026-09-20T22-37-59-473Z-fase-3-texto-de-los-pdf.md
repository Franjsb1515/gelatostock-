# Sesión 046 (tercera parte) · Compras y Mensajes II, fase 3: el texto de los PDF · versión 0.36.0

## Encargo
Fase 3 del plan: leer el texto de los PDF, que hasta ahora solo se archivaban. El plan pedía además decidir en esta sesión si el peso que añade al ejecutable es aceptable, y decirlo si no lo era.

## La decisión: unpdf
Se compararon cuatro caminos antes de escribir código:

| Camino | Peso sin comprimir | Notas |
| --- | --- | --- |
| `pdfjs-dist` 6.3 | 34,8 MB | el motor completo, con visor y wasm que no se usan |
| `pdf-parse` 2.4 | 21,3 MB | arrastra pdfjs-dist y `@napi-rs/canvas` (binario nativo por sistema) |
| `pdf2json` 4.1 | 11,9 MB | salida por posiciones, más trabajo para reconstruir líneas |
| **`unpdf` 1.8.1** | **2,1 MB** | pdf.js ya empaquetado para servidor, sin dependencias ni binarios nativos |
| Escribirlo a mano | 0 MB | habría que resolver xref, ObjStm, Flate y los mapas ToUnicode; muchas formas de equivocarse en silencio |

Se eligió unpdf: es el mismo motor de pdf.js que usa el resto, no añade binarios por sistema (importa para el Mac pendiente), no toca la red y cabe en dos megas. Medido en el ejecutable de Windows: la carpeta de la aplicación pasa de **1.530,3 MB a 1.532,4 MB (+2,1 MB, un 0,14 %)**, de los cuales 2,04 MB son unpdf. El peso es aceptable y así queda dicho.

## Lo que se ha construido
- **src/pdftext.cjs (`readPdfText`)**: acepta el archivo tal cual o como data URL, exige la cabecera `%PDF-`, y corta en 10 MB, 20.000 caracteres y 30 segundos. Devuelve `{ text, pages, truncated, reason }`. No es OCR: es el texto que el PDF ya lleva dentro, así que cuando lo lleva la lectura es exacta.
- **Cuando no hay texto** (un escaneo o una foto guardada como PDF), `text` queda vacío y `reason` lo explica con palabras suyas: «Este PDF no trae texto dentro… Elige el proveedor a mano, o haz una foto de la hoja para leerla con la cámara». No se rellena nada.
- **Servidor**: `POST /api/pdf` (con cookie y control de Origin, cuerpo hasta 14 MB) devuelve la lectura y, si hay texto, la propuesta de proveedor de las reglas de siempre.
- **Documentos**: al elegir un PDF, la app lo lee en el equipo, llena «Texto leído del documento», dice cuántas páginas tiene y propone proveedor, tipo y pedido igual que con una foto. Guardar sigue siendo decisión de la persona.
- **WhatsApp**: un PDF que manda un proveedor autorizado se archiva con su texto (antes llegaba sin nada que leer).

## De paso
- «Guardar foto» pasa a «Guardar documento» y «Proveedor de la foto» a «Proveedor del documento»: la pantalla ya no es solo de fotos. La prueba de escritorio busca los nombres nuevos.
- Últimos mensajes en voseo corregidos, que se vieron leyendo la app con datos reales: «Elegilo o añadí sus datos» (ahora «No se encontró ningún proveedor tuyo en el texto. Elígelo a mano o añade sus datos en Proveedores»), «Añadilo», «Volvé», «Esperá», «Confirmá o corregí», «Verificá», «Probá». Ninguna prueba dependía de esos textos.
- La pantalla de IA local ya no dice «Para PDF todavía debes copiar el texto».

## Pruebas
- Dos PDF de prueba impresos por el motor real de Chromium (work/make-pdf-fixture.cjs, que usa Electron): `tests/fixtures/factura-texto.pdf` (una factura con líneas, base, IVA y total) y `tests/fixtures/escaneo-sin-texto.pdf` (solo una imagen, como un escaneo).
- `npm test`: 184 pruebas, 0 fallos. Nuevas: tests/pdftext.test.cjs (el texto sale exacto, incluidas las líneas de producto y «Total: 121,00 EUR»; las reglas que ya existían leen ese texto y dicen «factura», 121,00 € y el pedido GS-014; el escaneo devuelve texto vacío con su motivo; se rechaza lo que no es un PDF), el caso de `/api/pdf` en tests/server.test.cjs (incluye que sin cookie responde 403 y que el proveedor se reconoce por su alias) y un adjunto PDF en tests/whatsapp.test.cjs.
- `npm run typecheck`, `npm run format:check`: limpios. `npm run package:win`: ejecutable 0.36.0 con unpdf dentro.
- `npm run test:desktop`: 21 PASS (uno nuevo: dentro del ejecutable, el PDF con texto se lee y se ve en «Texto leído del documento», y el escaneado enseña su aviso sin proponer proveedor). Salida en work/desktop-0360.log.
- `node scripts/evaluate-ai.cjs --chat`: 26/26, con un caso nuevo sobre PDF. Salida en work/audit-chat-0360.txt.
- **Sobre una COPIA de los datos reales** (work/check-fase3-cm2.cjs): con sus proveedores (FRAN, OMAR y los de la demo), el PDF con texto se lee («PDF de 1 página leído»), el texto sale correcto, la app dice honestamente «No se encontró ningún proveedor tuyo en el texto» porque la factura de prueba es de un proveedor inventado para el ejemplo, y al guardarlo queda archivado con la propuesta «factura» y 337 caracteres de texto. El escaneado muestra su aviso y deja el texto vacío. Sin errores de consola.

## Límites que quedan
- **No hay medición con documentos reales suyos.** Hoy no tiene ningún PDF guardado en la app (0 documentos), así que la única evidencia es con PDF impresos por Chromium. Para decir un porcentaje de acierto con tarifas de verdad hacen falta las suyas: es la pregunta abierta del plan y ahora está en TODO.
- Un PDF escaneado sigue sin leerse: habría que pasarle OCR página a página, que es trabajo de la fase 4.
- De un PDF se lee el texto, pero todavía no se extraen las cantidades, la fecha ni las líneas de precio: eso es la fase 4 (listas de precios) y la 5 (catálogo por proveedor).
- unpdf devuelve el texto por páginas en el orden del archivo; en una tabla a varias columnas ese orden puede no coincidir con lo que se ve. Por eso el texto se enseña para revisar y nunca cambia precios ni stock por su cuenta.
