# Sesión 015 · WhatsApp real: envío y recepción comprobados · versión 0.9.4

## Objetivo
El usuario pidió comprobar que WhatsApp funcione de verdad, con sus dos números propios (cuenta vinculada +34…, otro teléfono +54…), autorizando enviar mensajes de prueba.

## Cómo se probó
work/wa-live-test.cjs abre el servidor de la app sobre el directorio de datos real (sesión guardada en data/whatsapp/sessions, sin QR nuevo), autoriza el otro número para la cuenta conectada, envía un mensaje de prueba y espera la respuesta del teléfono hasta 4 minutos. Cuatro ejecuciones (23:13, 23:15, 23:16, 23:18) y una final a las 23:24.

## Hallazgos y correcciones (whatsapp-web.js 1.34.7, WhatsApp con identificadores LID)
1. Envío: la librería devolvía undefined y la app lo daba por fallido, pero el mensaje sí salía (ack 2 en el chat = entregado). Causa: con chats LID, Msg.get(clave) no encuentra el mensaje recién enviado; además getChatById/fetchMessages fallan. Corrección: resolver el destinatario con getNumberId, enviar con waitUntilMsgSent y, si no llega identificador, confirmar leyendo el propio chat dentro de WhatsApp Web (mensaje propio con el mismo texto) y tomar su identificador; si tampoco aparece, fallar de forma visible y no registrar.
2. Los identificadores de mensaje en chats LID no traen _serialized (ni en enviados ni en recibidos). Recepción: se reconstruye la clave estable fromMe_remoto_id; antes el «ok» del usuario (23:19) se resolvió, se autorizó y se descartó en silencio por falta de identificador.
3. Al cerrar el conector se retiran los oyentes de la página antes de cerrar el navegador: la librería intentaba reinyectarse en un navegador cerrado y provocaba un rechazo no controlado al salir.
4. Conclusiones del registro: la recepción por eventos funcionaba desde el principio; los descartes anteriores se debían a que cada cuenta vinculada tiene su propia lista de chats autorizados y el usuario había cambiado de cuenta.

## Resultado real (data/whatsapp/diagnostico.log)
- 23:24:13 enviado a +54… id true_119512414335078@lid_3EB0C36FE680D499E1C788 (confirmado en el chat, ack 1 en el momento, entregado después).
- 23:25:23 entrante de +54… resuelto desde LID, autorizado e importado: texto «Ok», guardado en la tabla messages con clave reconstruida.
- Envío y recepción reales comprobados en ambos sentidos con los números del usuario. Los tres envíos anteriores (23:13–23:18) también llegaron al teléfono aunque la app los diera por no confirmados; no se registraron como enviados.

## Pruebas automáticas
- tests/whatsapp.test.cjs: confirmación por chat resuelto, fallo visible sin chat, identificador reconstruido sin duplicados; tests/server.test.cjs: flujo HTTP de vista previa y envío único.
- Sonda de seguridad sin cambios de superficie.

## Límites
- La prueba real usó un mensaje de texto; adjuntos salientes no existen. Recepción de adjuntos ya estaba probada con cliente simulado.
- La respuesta recibida se muestra en la pantalla WhatsApp con lectura por reglas; todavía no se vincula automáticamente al pedido enviado.
- whatsapp-web.js es no oficial: un cambio de WhatsApp Web puede romper estas rutas; el diagnóstico del canal está para detectarlo.

## Evidencia final
- npm test: 88 aprobadas (reports/tests-2026-09-08-v094.txt). npm run format:check: aprobado. Sonda de seguridad: 26/26.
- npm run package:win: dist/GelatoStock-0.9.4-win32-x64.
- npm run test:desktop: 9 PASS (completa). reports/desktop-smoke-2026-09-08-v094.txt. La prueba real de WhatsApp no forma parte de la automática.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M package-lock.json
 M package.json
 M src/whatsapp.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-08T23-26-35-693Z-whatsapp-envio-recepcion-real.md
?? reports/desktop-smoke-2026-09-08-v094.txt
?? reports/tests-2026-09-08-v094.txt
```
