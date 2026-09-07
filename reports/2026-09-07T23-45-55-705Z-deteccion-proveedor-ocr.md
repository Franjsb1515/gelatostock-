# Sesión 005 — 2026-09-07 — Detección local de proveedor, versión 0.5.0

## Objetivo y resultado

Detectar proveedor al subir fotos y compartir identificación con conversaciones/documentos de proveedores. Se entrega OCR local real para imágenes y propuesta de proveedor confirmable. El canal WhatsApp y la descarga desde Makro siguen sin conectar.

## Implementación

Tesseract.js 7.0.0 con español @tesseract.js-data/spa 1.0.0 incluidos en el paquete. Motor WASM y worker de Node en archivos locales. El worker bloquea fetch y el idioma se verifica en disco antes de leer; no hay descargas al usar la app ni APIs por tokens. Worker por lectura, una lectura a la vez, límite de 30 segundos y liberación posterior. Solo se aceptan datos de imagen en memoria (PNG/JPG/WebP hasta 5 MB), nunca rutas ni URLs suministradas. Se comprueba cabecera antes de procesar.

core/identify.ts utiliza nombre/alias completos, NIF/CIF o número de remitente. Nombres sin distinción de tildes/mayúsculas; varios candidatos de igual nivel requieren revisión. Para canal WhatsApp, un número coincidente único tiene prioridad sobre nombres mencionados en el cuerpo. Si el remitente no es único/conocido, no propone automáticamente a partir de una simple mención. El canal de prueba sin número analiza el texto como documento.

La ficha de proveedor incorpora NIF/CIF, teléfono internacional y alias separados por línea. No se rellenan datos comerciales reales inventados. Makro puede reconocerse una vez creada su ficha; esto no conecta su web.

Al cambiar la foto se inicia OCR; la propuesta aparece encima del selector. Guardar confirma proveedor y fecha elegidos. Una selección manual durante la lectura se conserva. Respuestas tardías de otro archivo/modal no pisan la selección vigente. Texto OCR limitado a 20.000 caracteres, visible y guardado con la foto; se incluye en metadatos, carpetas y copia portable. No se extraen cantidades ni se modifica stock.

En Simular mensaje se puede introducir un número de remitente de prueba o texto. La identificación propone proveedor, sin recibir mensajes externos. El número introducido aquí solo se usa para identificación de prueba: todavía no se conserva como metadato de un canal real ni constituye prueba de autenticidad.

Endpoints locales autenticados /api/ocr y /api/identify, con verificación de origen y límites de entrada. Empaquetado incluye el grafo de dependencias de producción del lockfile, modelos y licencias distribuidos por los paquetes. Verificar obligaciones de redistribución antes de distribución comercial firmada.

## Pruebas y evidencia

- npm test: compilación TypeScript estricta y 47/47 pruebas aprobadas.
- Pruebas nuevas: nombres/alias, límites de coincidencia, ambigüedad, NIF, remitente prioritario/desconocido/duplicado, ficha Makro, inmutabilidad, límites de entrada y persistencia de datos identificativos/texto OCR.
- OCR real sobre tests/fixtures/factura-ocr.png, imagen ficticia creada para la prueba: reconoce ORIGEN COFFEE. Worker con fetch bloqueado y español local. Rechaza URL e imagen con cabecera falsa.
- npm run test:desktop aprobado sobre binario reconstruido: subir factura ficticia, detectar s1 sin selección manual, guardar, reclasificar, comprobar carpeta, probar propuesta desde texto de mensaje y reinicio de flujos anteriores.
- Captura output/playwright/v05-ocr.png revisada. Se movió la propuesta arriba del selector para hacerla visible antes de desplazarse.
- Evidencias: reports/tests-2026-09-07-v05.txt y reports/desktop-smoke-2026-09-07-v05.txt. El nombre provisional de fecha 08 en logs se corrigió al día UTC verificado 07; no se alteraron resultados.
- npm run format:check aprobado antes del ajuste visual final; volver a comprobar al cierre.

## Límites y siguientes pasos

Prueba con factura sintética legible; falta corpus de facturas reales autorizado, fotos borrosas, inclinadas, de varias páginas y mediciones en Mac de 8 GB. La confianza OCR no es probabilidad de identidad; no se usa para fingir certeza del proveedor. NIF se compara como texto registrado, no se valida fiscalmente. El identificador no distingue semánticamente emisor/destinatario: revisión necesaria cuando hay dudas.

No incluye PDF, lectura de cantidades, fechas extraídas automáticamente, OCR retroactivo de fotos guardadas, aprendizaje automático de correcciones, WhatsApp real, recepción con app cerrada ni descargas de Makro. El OCR no es un modelo conversacional. Los alias se guardan explícitamente en las fichas. Próximo paso: PDF y pruebas con documentos reales, más diseño de integración autenticada para canales externos.

## Fuentes técnicas

- Documentación oficial de instalación local: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- API oficial: https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- Datos de idioma: https://github.com/naptha/tessdata

Se inspeccionó también el código de la versión instalada; las rutas locales y el empaquetado se probaron en Windows. Mac no validado. Diff de la plantilla es intermedio; parche final en reports/patches.

## Activación y cierre

Formato final aprobado. Se cerró normalmente 0.4, se generó copia portable y se abrió 0.5 con los mismos datos. Igualdad completa del estado antes/después verificada, sin advertencia del archivo por proveedor.
