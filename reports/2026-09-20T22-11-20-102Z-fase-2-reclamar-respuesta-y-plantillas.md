# Sesión 046 (segunda parte) · Compras y Mensajes II, fase 2: reclamar respuesta y textos propios · versión 0.35.0

## Encargo
Fase 2 del plan docs/PLAN_COMPRAS_MENSAJES_II.md, tal como la pidió el usuario: «un clic, veo el texto y envío; uno a uno». Se suma lo que quedaba en TODO §3: las respuestas rápidas de Mensajes eran fijas en el código.

## Lo que se ha construido

**Reclamar respuesta.** Un pedido enviado de verdad por WhatsApp, todavía en curso y sin confirmación del proveedor, trae el botón «Reclamar respuesta». La app propone el texto (número del pedido, negocio, proveedor y los días que lleva enviado), se puede cambiar en el mismo cuadro y se envía una sola vez al número de la ficha. El pie del pedido deja constancia: «Recordatorio enviado una vez, el último el …». Como mucho un recordatorio por pedido y día: hasta mañana el botón queda en «Reclamado hoy», apagado.

**Desde el Resumen.** El aviso «se envió hace N días y no hay respuesta» lleva ahora el mismo botón para el primer pedido en esa situación, además de «Ver pedidos».

**Textos propios (Configuración).**
- «Plantilla del recordatorio»: el texto que se propone al reclamar, con {numero}, {proveedor}, {negocio} y {dias}. Vacío vuelve al de origen.
- «Respuestas rápidas»: los ocho botones de respuesta de Mensajes, cada uno con su texto editable. {fecha} se sustituye por la fecha que dijo el proveedor. Lo que no se cambia usa el texto de origen.

## Por qué así
- **Nunca automático.** El recordatorio lo lanza la persona, ve el texto exacto y confirma, igual que el envío de un pedido. Ninguna tarea programada reclama por su cuenta.
- **Uno por pedido y día.** Un proveedor que recibe tres recordatorios en una tarde es un problema real. El límite vive en el núcleo (`core/domain.ts`, acción `nudge`), no solo en el botón: el servidor comprueba lo mismo antes de enviar para no mandar un mensaje que la acción luego rechazaría.
- **Reclamar no cambia nada más.** No toca el estado del pedido, ni la fecha prevista, ni la confirmación, ni el stock. Solo añade el registro de lo enviado.
- **El hueco «un envío por pedido» se respeta.** El registro que impide reenviar un pedido (`sentFor`) sigue siendo del pedido; el recordatorio se envía como mensaje suelto, así que no ocupa ese hueco ni lo libera.
- **El texto del recordatorio sí es editable antes de enviar** (a diferencia del pedido, que se envía exactamente como se previsualiza): un recordatorio es una conversación, no un documento de compra.

## Pruebas
- `npm test`: 180 pruebas, 0 fallos. Nuevas:
  - núcleo: un recordatorio deja rastro sin tocar líneas, estado ni confirmación; sin envío real por WhatsApp se rechaza; dos veces el mismo día se rechaza y al día siguiente se acepta; un pedido ya confirmado no se reclama;
  - plantilla: el texto lleva el número del pedido, el negocio y «3 días» (o «1 día»), y una plantilla sin {numero} se ignora y vuelve la de origen;
  - servidor (`tests/server.test.cjs`): vista previa, envío con el texto cambiado por la persona, registro en el pedido y rechazo del segundo intento del mismo día, con cliente de WhatsApp falso.
- Cambios de expectativa en la prueba del servidor, explicados: el doble de WhatsApp devolvía siempre el mismo identificador de mensaje y el segundo envío chocaba con la clave única del registro (ahora devuelve uno por mensaje, como el real), y el diagnóstico del canal pasa a listar dos envíos porque ahora hay dos de verdad (el pedido y su recordatorio).
- `npm run typecheck` y `npm run format:check`: limpios. `npm run package:win`: ejecutable 0.35.0.
- `npm run test:desktop`: 20 PASS (uno nuevo: se escribe una respuesta rápida propia en Configuración, se guarda y vuelve a salir al reabrir el editor). Salida en work/desktop-0350.log.
- `node scripts/evaluate-ai.cjs --chat`: 25/25, con un caso nuevo («un proveedor no contesta a un pedido, ¿qué puedo hacer?»). El primer intento falló: la guía del chat respondía con el párrafo de «otro proveedor» porque el nuevo no contenía las palabras de la pregunta. Se reescribió el párrafo empezando por «Si un proveedor no contesta ni responde…» (437 caracteres) y pasa. Salida en work/audit-chat-0350.txt.
- **Sobre una COPIA de los datos reales** (work/check-fase2-cm2.cjs): se crea un pedido con un producto suyo y se marca como enviado hace tres días (envío ficticio que vive solo en la copia temporal, que se borra al terminar). En Compras aparece «Reclamar respuesta»; el cuadro propone «Hola, FRAN: os escribimos por el pedido GS-013 de Gelato & Café. Lo enviamos hace 3 días y todavía no tenemos respuesta…», avisa de que WhatsApp no está conectado y el botón queda en «Cerrar»: 0 recordatorios enviados. En el inicio, su aviso real de seguimiento («GS-013 (FRAN) … GS-012 (OMAR) se envió hace 2 días y no hay respuesta») trae el atajo «Reclamar respuesta de GS-013». Configuración enseña las tres tarjetas de textos y el editor lista las ocho respuestas rápidas. Sin errores de consola.

## Límites que quedan
- El recordatorio solo sale por WhatsApp y solo a un chat autorizado: un proveedor sin WhatsApp en su ficha no se puede reclamar desde la app.
- No hay recordatorio automático ni aviso programado: el Resumen avisa cuando la app está abierta y la persona decide.
- El envío real de un recordatorio está probado con un cliente de WhatsApp falso; con el canal de verdad, la prueba la tiene que lanzar el usuario con sus números (sigue en TODO).
- Las respuestas rápidas se editan una a una y siguen apareciendo por categoría de lectura; no se pueden añadir botones nuevos.
