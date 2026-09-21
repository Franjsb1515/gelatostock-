# Sesión 047 · Aviso de mensajes nuevos · versión 0.38.0

## Encargo

El usuario no mandó tarifas reales, así que la **fase 4 del plan (listas de precios en foto) no se toca**: sin sus fotos y sus PDF no hay forma de medir el acierto de la lectura y cualquier cifra sería inventada. En su lugar, de los dos pendientes que él señaló, se hace el que no necesita ninguna decisión suya: «lectura automática de respuestas de WhatsApp al importarlas, con aviso» (TODO §3). El otro, mermas de ingredientes con motivos y aviso de objetivo, está marcado **[decidir]** y espera a que él diga cómo lo quiere.

## Lo primero: esa línea de TODO estaba mal, y se corrige

TODO decía «hoy las reglas se aplican al abrir la bandeja». **No es cierto**: desde 0.9.0, un mensaje de un chat autorizado entra en la bandeja en cuanto llega (`importToInbox` en src/whatsapp.cjs dispara la acción `message`, y `classify` de core/domain.ts lo lee por reglas ahí mismo). Comprobado leyendo el camino y con la prueba «un mensaje autorizado de un proveedor entra en la bandeja principal una sola vez».

Lo que sí faltaba, y es lo que el usuario notaba, es **enterarse**: con la app abierta, la interfaz solo traía el estado cuando él hacía algo (`mutate`) o al arrancar. Un mensaje que llegaba mientras miraba Inventario no aparecía en ninguna parte hasta el siguiente clic, y la notificación de Windows decía el texto suelto del mensaje, sin la lectura. La línea de TODO queda corregida con esta explicación.

## Qué cambia en pantalla

- **Aviso abajo a la derecha** cuando llega un mensaje nuevo: «Mensaje nuevo de Origen Coffee · Falta de producto · hay que leerlo», con «Abrir el mensaje» y «Ahora no». Abrirlo trae el estado fresco, va a Mensajes, lo deja seleccionado y lo marca leído.
- **El aviso no redibuja la pantalla.** Es un recuadro propio (`#incoming`), fuera del dibujo de la página: si estabas escribiendo un cierre del día o un formulario, no pierdes nada. Lo demás (el contador de la barra lateral, la bandeja) se pone al día en el siguiente cambio de pantalla.
- **La notificación de Windows** dice ahora la misma lectura: «WhatsApp · Fresco Mercado · Falta de producto» y, si hay que leerlo, lo dice antes del texto.
- **Configuración → Aviso de mensajes nuevos**: un interruptor apaga los dos avisos (el de la app y el de Windows). Apagado, los mensajes entran igual y se ven al abrir Mensajes.
- Guía de la app y guía del chat actualizadas con las tres cosas.

## Lo que sigue sin hacer la app sola

- El aviso **no cambia nada**: ni stock, ni pedidos, ni precios. Solo dice que ha llegado algo y qué han leído las reglas.
- **No interrumpe**: no abre ventanas, no cambia de pantalla, no roba el foco. La pantalla solo cambia si pulsas «Abrir el mensaje».
- El latido **no lleva el texto del mensaje**, solo la lectura por reglas (categoría, resumen y si hay que leerlo). Está probado.

## Núcleo y servidor

- **`GET /api/pulse`** (src/server.cjs): consulta barata con la misma cookie y el mismo control de origen que el resto. Devuelve `revision`, `notices` (si el aviso está activo), `unread`, `toRead` y `last` (identificador, fecha, proveedor, categoría, etiqueta, resumen y `needsReading` del último mensaje). No devuelve el texto. Se apoya en `store.load()`, que ya compara la revisión de `meta` antes de releer nada.
- **`message_notices_off`** es un ajuste como `cruises_off`: `POST /api/maintenance` con `{ type: "messageNotices", enabled }`, y viaja en el sobre de estado como `messageNotices`.
- **src/whatsapp.cjs**: `importToInbox` devuelve ahora la lectura del mensaje que acaba de entrar (la que escribió el núcleo, no otra), y el evento local `message` la lleva. Se emite **después** de importar, para que el aviso pueda decir qué dice el mensaje.
- **src/desktop.cjs**: la notificación usa esa lectura y respeta el interruptor.
- **Interfaz** (src/ui/core.js): `pulse()` cada cinco segundos, que no se ejecuta con un modal abierto ni mientras hay una acción en curso; `showIncoming`/`hideIncoming` escriben directamente en `#incoming`; `staleState` recuerda que el estado quedó viejo y `nav()` lo refresca al cambiar de pantalla. `applyEnvelope` marca como visto el mensaje más nuevo. Acciones `incomingOpen` e `incomingHide` en src/ui/actions.js; interruptor en src/ui/events.js y tarjeta en src/ui/views.js; estilos con clases (la CSP prohíbe estilos en línea).

## Pruebas

- `npm test`: **193 pruebas, 0 fallos** (salida en reports/tests-2026-09-21-v0380.txt). Nueva en tests/server.test.cjs: el latido pide sesión (403 sin cookie), sube de revisión al entrar un mensaje, trae la lectura («Falta de producto», hay que leerlo) sin el texto del mensaje, y el interruptor lo apaga sin dejar de contar lo pendiente. Nueva en tests/whatsapp.test.cjs: el evento que dispara la notificación lleva la lectura que escribió la bandeja.
- `npm run typecheck` y `npm run format:check`: limpios.
- `npm run package:win`: ejecutable 0.38.0 reconstruido (work/audit-package-0380.txt).
- `npm run test:desktop`: **21 PASS** (los mismos bloques que antes; lo nuevo se comprueba dentro del último). Dentro del ejecutable: estando en Inventario entra un mensaje por la vía del servidor, el aviso aparece solo con «Mensaje nuevo de Fresco Mercado · Falta de producto», la pantalla sigue siendo Inventario, y al pulsar «Abrir el mensaje» se va a Mensajes y el aviso desaparece. Salida en work/desktop-0380.log.
- `node scripts/evaluate-ai.cjs --chat`: **30/30**, con dos casos nuevos (cómo me entero de que ha llegado un mensaje; cómo quito el aviso). Salida en work/audit-chat-0380.txt. Hubo que reescribir la frase del interruptor en la guía del chat: con la primera redacción, la pregunta de quitar el aviso traía el párrafo general.
- **Sobre una COPIA de los datos reales** (work/check-aviso-mensajes.cjs, salida en work/check-aviso-mensajes.txt): con la copia abierta en Inventario, un mensaje de su proveedor entra por la vía del servidor (como lo haría WhatsApp); a los pocos segundos aparece el aviso «Mensaje nuevo de Origen Coffee · Falta de producto · hay que leerlo» **sin que la pantalla se mueva de Inventario**; «Abrir el mensaje» lleva al mensaje con su lectura completa. Apagado el interruptor, un segundo mensaje no avisa pero sí está en la bandeja al entrar en Mensajes. Sin errores de consola.

## Límites que quedan

- **La fase 4 sigue parada.** Hacen falta entre cinco y diez tarifas reales suyas (fotos como las que hace y algún PDF, con precios y formatos de verdad; puede tapar el nombre del proveedor). Sin eso no hay medición, y una lectura de tarifa sin medir falsearía el coste de las recetas.
- El aviso llega **hasta cinco segundos** tarde: es el intervalo del latido. Se eligió así para no preguntar al servidor sin parar.
- El contador de mensajes de la barra lateral y la bandeja **no se actualizan solos**: lo hacen al cambiar de pantalla o al abrir el aviso. Es deliberado: refrescar la pantalla sola haría perder lo que se esté escribiendo.
- Solo avisa del **último** mensaje. Si llegan tres seguidos, el aviso enseña el más reciente; los otros están en la bandeja.
- La notificación de Windows solo existe en el ejecutable de escritorio, y no se ha probado en Mac.
- Nada de esto se ha probado con mensajes reales de sus proveedores: sigue pendiente la prueba real del ciclo completo con sus dos números (TODO §1).
