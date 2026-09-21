# Sesión 047 (cuarta parte) · WhatsApp mantiene la sesión · versión 0.40.2

## Encargo

Del usuario, el 2026-09-21: «cuando la cierro y abro, el whatsapp se desconecta, quisiera que mantenga la sesión a menos que yo la desconecte».

## Qué pasaba de verdad (con evidencia)

- **La sesión nunca se perdía.** `close()` (src/whatsapp.cjs) cierra el navegador con `pupBrowser.close()` y **nunca** hace `logout()`; el perfil de WhatsApp Web sigue en `data/whatsapp/sessions/session-<id>`. En su carpeta hay cuatro sesiones: tres del 2026-09-08 (de cuando cambió de número en las pruebas) y la vigente, `session-33043be1…`, con archivos de hoy.
- **Lo que fallaba era arrancar conectado.** En su `data/whatsapp/whatsapp.sqlite`, la tabla meta tenía `autoconnect = 0` (leído en solo lectura, sin tocar nada), junto a `session = 33043be1…`, `lastPhone = +34XXXXXXXXX` y su cuenta activa. Con ese ajuste, `src/desktop.cjs` no llama a `connect()` al abrir, así que la app arrancaba en «Desconectado» aunque el teléfono siguiera vinculado. Reconectar al abrir era un interruptor aparte («Conectar al abrir») que había que acordarse de encender.

## Qué cambia

- **Al conectar, la app recuerda la sesión.** En el evento `ready` se llama a `rememberSession()`: enciende el recuerdo si estaba apagado y lo deja escrito en la meta de WhatsApp. Desde ese momento, cada vez que abre la app se reconecta sola, sin pedir otro QR.
- **Solo «Cerrar sesión / cambiar número» la olvida.** `disconnect()` apaga el recuerdo antes de desvincular: es la única vía por la que la persona cierra la sesión, y entonces la app deja de reconectarse sola.
- **Para quien ya estaba vinculado, no hay que tocar nada.** `migrateRememberedSession()` corre una sola vez al abrir (marca `autoconnect_v2` en la meta): si hay cuenta activa y la carpeta de su sesión sigue en el disco, enciende el recuerdo. Si después la persona lo apaga a mano, **se respeta**: la marca impide volver a encenderlo.
- **Pantalla WhatsApp**: el botón pasa de «Conectar al abrir: sí/no» a **«Mantener la sesión al abrir: sí/no»**, y la letra pequeña dice lo que importa: al conectar por QR la sesión queda guardada, cerrar la app no la cierra, y solo «Cerrar sesión / cambiar número» la cierra.
- Guía de la app y guía del chat actualizadas.

## Lo que no cambia

- **Nada de esto envía ni lee mensajes solo**: sigue todo igual (solo chats autorizados, envío con confirmación en pantalla y una vez por pedido).
- No se toca la carpeta de sesiones ni se borran las tres antiguas: son del usuario y ocupan disco, pero borrarlas es decisión suya.
- Si la sesión caduca o se desvincula desde el teléfono, la app pedirá el QR otra vez: eso no lo decide la app.

## Pruebas

- `npm test`: **198 pruebas, 0 fallos** (salida en reports/tests-2026-09-21-v0402.txt). Dos nuevas en tests/whatsapp.test.cjs: (1) recordar al conectar, que una instancia nueva sobre la misma carpeta lo sigue recordando, y que `disconnect()` lo olvida; (2) que una sesión ya vinculada se recuerda **una sola vez** y que apagarlo después se respeta.
- `npm run typecheck` y `npm run format:check`: limpios.
- `node scripts/evaluate-ai.cjs --chat`: **33/33**, con un caso nuevo («¿Por qué se desconecta WhatsApp cuando cierro la app?»). Salida en work/audit-chat-0402.txt. Con la primera redacción el buscador traía el párrafo general de WhatsApp; se reescribió empezando por «Cerrar la app no desconecta WhatsApp».
- `npm run package:win`: ejecutable 0.40.2 reconstruido (work/audit-package-0402.txt).
- **Sobre una COPIA de su carpeta de WhatsApp** (copia de `data/whatsapp/whatsapp.sqlite` y una carpeta de sesión vacía con el mismo nombre, en work/): al instanciar la conexión, `autoConnect` pasa a `true` y la vista queda con su cuenta. Sobre los datos reales no se escribió nada en esta comprobación.
- `npm run test:desktop`: **sigue sin poder terminarse en este equipo** (se corta en `page.screenshot: Timeout`, pantalla suspendida). La prueba de escritorio no cubre el QR de WhatsApp en ningún caso, así que esta corrección no dependía de ella; queda pendiente igual desde la 0.40.0.

## Cómo comprobarlo él

1. Abrir la app. En WhatsApp debería decir «Mantener la sesión al abrir: sí».
2. Si aparece «Desconectado», pulsar «Conectar por QR» una vez: al estar la sesión guardada, normalmente no pide QR nuevo.
3. Cerrar la app y volver a abrirla: tiene que conectarse sola.
4. Para cortarla a propósito: «Cerrar sesión / cambiar número». A partir de ahí no se reconecta hasta que él vuelva a vincular.

## Límites que quedan

- Si el equipo se queda sin internet al abrir, la reconexión reintenta con esperas crecientes (hasta 20 intentos); si falla, la pantalla lo dice y hay que pulsar «Conectar por QR».
- Las tres carpetas de sesión antiguas (del 8 de septiembre) siguen ocupando sitio en `data/whatsapp/sessions`. No se borran solas a propósito; se puede hacer a mano con la app cerrada.
- Nada de esto se ha probado con una desconexión real del teléfono: la prueba de vincular y desvincular con su número la lanza él.
