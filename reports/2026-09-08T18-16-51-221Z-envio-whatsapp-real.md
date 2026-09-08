# Sesión 013 · Envío real de pedidos por WhatsApp · versión 0.9.1

## Contexto
El usuario probó el conector: vinculó por QR y cambió entre sus dos números propios (registro del canal: vinculación 18:07, chat autorizado 18:09). Esperaba que la app enviara el pedido y no lo hacía porque hasta 0.9.0 el canal era solo de recepción. Autorizó implementar el envío real con estas condiciones: solo a chats autorizados, confirmación explícita del texto exacto, una vez por pedido, primera prueba a sus propios números.

## Implementación
- src/whatsapp.cjs send(): exige sesión conectada, normaliza el número, comprueba que está autorizado para la cuenta, valida el texto (1–4.000), rechaza un segundo envío del mismo pedido y envíos concurrentes; envía con client.sendMessage; registra en la tabla sent y en el historial.
- src/whatsapp-store.cjs: tabla sent (cuenta, id, destinatario, hora, texto, pedido), recordSent, sentFor; view() incluye enviados.
- core: orderMessage(state, pedido) compone el texto determinista; el pedido guarda dispatch (canal, destino, id, hora, texto); la acción send acepta dispatch y anota «ENVIADO por WhatsApp» sin tocar stock.
- src/server.cjs /api/whatsapp: preview (texto, destinatario, conectado, autorizado) y send (pedido pendiente, proveedor con WhatsApp, texto idéntico a la vista previa, envío y registro en el pedido).
- src/app.js: botón «Enviar por WhatsApp» en Control de entregas con vista previa y motivos de bloqueo; el pedido muestra destino y hora; la conversación de WhatsApp muestra los enviados como burbujas propias.

## Pruebas
- tests/whatsapp.test.cjs: conector con cliente simulado (desconectado, no autorizado, texto vacío, envío, duplicado, registro).
- tests/domain.test.cjs: texto del pedido y send con dispatch sin cambiar stock.
- tests/server.test.cjs: flujo completo por HTTP con cliente simulado: vista previa, rechazo sin conexión, rechazo de texto alterado, envío único, estado enviado y vista del canal.
- npm test: 85/85. npm run format:check: aprobado.
- Sonda work/attack.cjs: 26/26.

## Límites
- No se ha enviado ningún mensaje real en esta sesión: la prueba con teléfono la hace el usuario desde la app (Compras → Control de entregas → Enviar por WhatsApp) a su número autorizado.
- Sin reintentos ni cola offline: si no hay conexión, el pedido queda pendiente y se envía a mano después.
- El proveedor debe tener su WhatsApp en la ficha y estar autorizado en la cuenta conectada.
- Recepción de la respuesta: llega a la pantalla WhatsApp y se lee por reglas; todavía no se vincula automáticamente al pedido.

## Evidencia final
- npm test: 85/85 (reports/tests-2026-09-08-v091.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.9.1-win32-x64.
- npm run test:desktop: 9 PASS con modelo real; el envío real no forma parte de la prueba automática (no se usan sesiones reales). reports/desktop-smoke-2026-09-08-v091.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M docs/WHATSAPP_PROVEEDORES.md
 M package-lock.json
 M package.json
 M src/app.js
 M src/server.cjs
 M src/styles.css
 M src/whatsapp-store.cjs
 M src/whatsapp.cjs
 M tests/domain.test.cjs
 M tests/server.test.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-08T18-16-51-221Z-envio-whatsapp-real.md
?? reports/desktop-smoke-2026-09-08-v091.txt
?? reports/tests-2026-09-08-v091.txt
```
