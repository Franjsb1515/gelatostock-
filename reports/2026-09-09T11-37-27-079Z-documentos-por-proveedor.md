# Sesión 023 · Documentos por proveedor con propuesta de tipo y pedido · versión 0.14.0

## Petición
Un lugar donde alojar documentos y recibos de pago y pedidos, separado por proveedor, vinculable a un pedido, y que «la IA» proponga qué es y a qué pedido y proveedor pertenece.

## Diseño
- Se reutiliza el archivo de fotos (SQLite + adjuntos por huella + carpetas derivadas por proveedor) ampliándolo a documentos: PDF admitido (hasta 10 MB, cabecera %PDF- verificada), campos order, source (foto/whatsapp) y suggestion.
- Propuestas por reglas (core/documents.ts), no por el modelo: (1) número GS-nnn en el texto → ese pedido; (2) si no, único pedido no cancelado del proveedor en los 60 días anteriores a la fecha del documento; (3) si hay varios, el que coincide en importe con el total del documento (±5 % o 0,50 €); (4) tipo por encabezado (factura, proforma, abono, albarán, tarifa, oferta, recibo → factura). La propuesta se guarda en el documento y se recalcula al organizar, cambiar tipo o vincular; desaparece cuando ya no aporta nada.
- Acciones: photo (ahora con order y source), linkDocument (valida proveedor del pedido), applySuggestion (aplica proveedor/pedido/tipo propuestos), organizePhoto (si cambia el proveedor, se desvincula el pedido de otro proveedor). validate() comprueba que el pedido vinculado exista y sea del mismo proveedor.
- WhatsApp: los adjuntos de un proveedor autorizado se archivan como documento con fecha del mensaje y, si son imagen, texto OCR local (recognizeLocal inyectado por el servidor; mejor esfuerzo).
- Interfaz: pantalla Documentos agrupada por proveedor con filtros; tarjeta con miniatura o PDF, tipo, pedido, propuesta con «Aceptar», vincular/cambiar/desvincular, revisar texto con IA, dónde está el archivo. Control de entregas lista los documentos de cada pedido. Configuración enlaza a Documentos.

## Pruebas
- Dominio: propuesta por número, por único pedido y por importe; aceptar propuesta; vínculo manual con validación de proveedor y desvinculación; PDF con origen WhatsApp.
- Almacén: PDF guardado por huella, servido con su tipo y archivado en la carpeta del proveedor; PDF falso rechazado.
- Canal: adjunto de proveedor autorizado archivado con OCR simulado.
- Prueba de escritorio: pantalla Documentos con filtro y diálogo de vínculo.
- Sonda de seguridad 26/26.

## Límites
- El texto de los PDF no se lee (solo imágenes por OCR); proveedor y pedido se eligen a mano o por el nombre del remitente de WhatsApp.
- La propuesta por importe depende del precio estimado del pedido, no del precio real facturado.
- La IA local solo interviene si el usuario pulsa «Revisar texto con IA»; el vínculo lo confirma siempre la persona.

## Evidencia final
- npm test: 110 aprobadas (reports/tests-2026-09-09-v0140.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.14.0-win32-x64.
- npm run test:desktop: 11 PASS (completa). reports/desktop-smoke-2026-09-09-v0140.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M core/store.ts
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/server.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/events.js
 M src/ui/forms.js
 M src/ui/views.js
 M src/whatsapp.cjs
 M tests/domain.test.cjs
 M tests/store.test.cjs
 M tests/whatsapp.test.cjs
?? core/documents.ts
?? docs/GUIA_USO.md
?? docs/PROMPT_DISENO.md
?? reports/2026-09-09T11-37-27-079Z-documentos-por-proveedor.md
?? reports/ai-evaluation-v0140-quick.json
?? reports/desktop-smoke-2026-09-09-v0140.txt
?? reports/tests-2026-09-09-v0140.txt
```
