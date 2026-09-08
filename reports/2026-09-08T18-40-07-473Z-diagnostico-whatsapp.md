# Sesión 014 · Diagnóstico y recepción de WhatsApp · versión 0.9.3

## Problema
Con la cuenta vinculada por QR (+54…, chat autorizado +34…, ambos del usuario), el usuario no recibía mensajes en la app ni le llegaban desde la app. El canal no tenía mensajes importados ni envíos registrados; el pedido «Enviar por WhatsApp» no se había usado (tabla sent vacía) y la recepción descartaba en silencio.

## Causas probables y cambios
- WhatsApp identifica muchos contactos con LID (…@lid) en lugar de número. receive() solo aceptaba …@c.us o el resultado de getContactLidAndPhone; si esa llamada fallaba o devolvía vacío, el mensaje se descartaba sin rastro. Ahora se intenta también msg.getContact().number y se registra el resultado.
- No existía forma de ver por qué se descartaba un mensaje. Nuevo diagnóstico local (data/whatsapp/diagnostico.log, rotado a 1 MB): ready, entrante ignorado (propio, grupo, estado, anterior a la conexión, sesión anterior), remitente resuelto, no autorizado, importando, enviando/enviado. Nunca guarda texto de mensajes. Se muestra en la pantalla WhatsApp.
- Envío de prueba: /api/whatsapp sendText a un chat autorizado, con el mismo send() (validación, registro y una vez por pedido cuando aplica).
- Texto de la pantalla actualizado: ya no dice «no hay envíos».

## Pruebas
- tests/whatsapp.test.cjs: resolución por LID con cliente simulado, remitente no autorizado registrado, log sin contenido, diagnóstico en la vista.
- npm test 86/86; formato correcto; sonda de seguridad 26/26 (sin cambios de superficie salvo sendText, que exige sesión conectada y chat autorizado).

## Qué debe hacer el usuario
1. Abrir 0.9.3, WhatsApp → comprobar «Conectado» y el diagnóstico (debe aparecer «ready: cuenta …»).
2. «Enviar mensaje de prueba» al chat autorizado; mirar el diagnóstico: «enviando…» y «enviado… id …». Si aparece un error, copiarlo.
3. Responder desde el otro teléfono; el diagnóstico debe mostrar «remitente … resuelto a …» y «autorizado; importando». Si dice «no autorizado», el número real difiere del autorizado (revisar prefijo); si dice «no resoluble», enviar el diagnóstico completo.

## Límites
- No se ha probado con el teléfono en esta sesión; el ejecutable se prueba con cliente simulado y la prueba de escritorio no usa sesiones reales.

## Diagnóstico real con el registro del usuario (data/whatsapp/diagnostico.log, 18:45–19:01)
- La recepción funciona: llegaron eventos de varios contactos, los identificadores LID se resolvieron a números y se descartaron por «no autorizado para esta cuenta». Es decir, los mensajes del otro teléfono no aparecían porque el chat autorizado pertenece a la cuenta +54… y el usuario volvió a vincular con +34… a las 18:50 (cada cuenta tiene su propia lista de chats autorizados).
- El envío no salía: sendMessage devolvía en 20 ms sin identificador («enviado … id ?») y el mensaje nunca llegó. Causa confirmada en whatsapp-web.js 1.34.7: cuando no existe un chat para «número@c.us» (WhatsApp ahora identifica chats por LID), sendMessage devuelve undefined en silencio. Corrección: se resuelve el identificador real con getNumberId, se reintenta por LID si hace falta y, si WhatsApp no devuelve identificador, el envío falla de forma visible y no se registra. Prueba unitaria añadida.
- Un LID sin número (141330546204775) se aceptó como «número» por tener 15 dígitos; solo afecta al texto del diagnóstico, no a permisos.

## Instrucciones para el usuario
1. Comprobar en WhatsApp qué cuenta está conectada y autorizar el otro número para ESA cuenta («Autorizar chat»).
2. «Enviar mensaje de prueba»: el diagnóstico debe decir «chat destino …» y «enviado … id …». Si dice «NO confirmado», abrir en el teléfono una conversación con ese número y repetir.
3. Responder desde el otro teléfono: debe aparecer «autorizado; importando» y el mensaje en la conversación.

## Evidencia final
- npm test: 87/87 (reports/tests-2026-09-08-v092.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.9.3-win32-x64 (0.9.2 no se pudo sobrescribir con la app abierta).
- npm run test:desktop: 9 PASS (prueba completa). reports/desktop-smoke-2026-09-08-v093.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M package-lock.json
 M package.json
 M src/app.js
 M src/server.cjs
 M src/styles.css
 M src/whatsapp.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-08T18-40-07-473Z-diagnostico-whatsapp.md
?? reports/desktop-smoke-2026-09-08-v092.txt
?? reports/desktop-smoke-2026-09-08-v093.txt
?? reports/tests-2026-09-08-v092.txt
```
