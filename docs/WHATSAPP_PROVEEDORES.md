# Actualización 0.6 — 2026-09-08

El usuario autorizó QR experimental con su cuenta y cambio de número. Se implementó WhatsApp Web con cuentas separadas, lista autorizada y log de cambios. QR real probado; vinculación/recepción con su teléfono pendientes. La recomendación oficial del diseño inicial se conserva como alternativa de producción, no como transporte de esta entrega. Ver el informe 2026-09-08T04-18-52-587Z-whatsapp-qr-cuentas.md.

---

# WhatsApp de proveedores — propuesta de integración

Estado: diseño previo a conectar una cuenta. La versión 0.5 no recibe WhatsApp real. No se ha creado una conexión, servidor público, QR de sesión ni suscripción.

## Experiencia propuesta

Dentro de GelatoStock, una bandeja exclusiva para contactos autorizados. En Proveedores se introduce el número internacional y se activa «Mostrar este chat». Otro contacto puede autorizarse explícitamente sin convertirlo en proveedor. Un chat nuevo no se incorpora por una mención al nombre del proveedor ni por el texto de un adjunto.

Los contactos autorizados aparecen con mensajes recientes, adjuntos, pendiente de revisar e indicador de conexión/última recepción. Al retirar autorización se detienen nuevas importaciones; el usuario decide por separado si conservar el historial ya importado. Grupos, estados, llamadas e historial masivo fuera del primer alcance.

El flujo de un mensaje: validar origen del evento → comprobar número/cuenta y lista autorizada → deduplicar ID del mensaje → guardar contenido y metadatos permitidos → descargar adjuntos admitidos → proponer tipo de documento y ejecutar OCR local → archivar por proveedor y fecha → avisar en la bandeja. La clasificación factura/lista de precios/albarán aún debe implementarse. Una factura no suma stock ni confirma pago. Una tarifa no sustituye precios sin revisión.

La app no debe descargar adjuntos, ejecutar OCR, mostrar ni persistir contenido de remitentes no autorizados. El transporte o una sesión vinculada puede recibir eventos de la cuenta completa: el filtro es de GelatoStock, no un permiso selectivo concedido por WhatsApp. Un número dedicado al negocio reduce la exposición de conversaciones personales.

## Opciones técnicas

1. Recomendación para operación: WhatsApp Business Platform oficial. Recibe eventos mediante webhook HTTPS accesible desde internet; requiere configuración de cuenta y receptor externo/servicio. Evaluar coexistencia con WhatsApp Business y su elegibilidad antes de comprometer el flujo de alta o QR. No es lo mismo que incrustar WhatsApp Web. Puede implicar tarifas de Meta y del alojamiento/proveedor, independientes de tokens de IA.
2. Alternativa experimental: automatizar WhatsApp Web con biblioteca no oficial y QR. Mantiene una sesión local, requiere internet y un proceso activo. Cambios de WhatsApp pueden romperla y existen riesgos de restricciones de cuenta. No seleccionada ni instalada. No prometer funcionamiento continuo ni acceso limitado a proveedores a nivel de cuenta.
3. Incrustar la web oficial como navegador solo aporta su interfaz; por sí solo no implementa archivo automático, filtro de acceso ni recepción estructurada. Ocultar chats visualmente no equivale a impedir lectura o almacenamiento.

## Offline y privacidad operativa

El inventario, OCR y archivo permanecen locales. Los mensajes nuevos necesitan internet. Para recibir cuando la app está cerrada se necesita un receptor que permanezca activo; en la vía oficial debe mantener una cola de entrega autenticada hasta que el equipo recupere conexión. Limitar retención y no guardar secretos de sesión en el ZIP de Claude, Git ni copias de negocio generales.

Primera implementación centrada en recepción. Envíos, respuestas automáticas y compras reales no se activan como efecto lateral del alta de WhatsApp. Futuras respuestas manuales deben mostrar destinatario y texto antes de enviar.

## Criterios de aceptación

- [ ] Confirmar si el número es WhatsApp Business, normal o personal compartido.
- [ ] Elegir transporte con costes, dependencia de internet y soporte conocidos.
- [ ] Alta real comprobada por el usuario; ningún QR decorativo ni conexión fingida.
- [ ] Lista autorizada explícita, con número internacional y detección de duplicados.
- [ ] Mensaje de proveedor admitido visible sin recargar y con ID/origen/hora conservados.
- [ ] Mensaje ajeno ignorado antes de descargar su adjunto o guardarlo en SQLite/logs.
- [ ] Quitar un chat impide nueva importación; no borra historial sin decisión explícita.
- [ ] Webhooks/eventos duplicados y fuera de orden no duplican mensajes ni archivos.
- [ ] Autenticación del canal y separación respecto del servidor loopback actual.
- [ ] Adjuntos con límites, validación, nombre seguro y metadatos de procedencia.
- [ ] Clasificación de documento separada de identificación de proveedor y prioridad.
- [ ] Estados desconectado, reconectando y fallo claros; recuperación tras reinicio probada.
- [ ] Recepción y recuperación tras app cerrada comprobadas antes de prometer disponibilidad.
- [ ] Pruebas con cuenta y mensajes de prueba autorizados; sin mensajes a terceros involuntarios.

## Fuentes consultadas el 2026-09-07

- WhatsApp, dispositivos vinculados: https://faq.whatsapp.com/378279804439436/
- WhatsApp, aplicaciones no oficiales: https://faq.whatsapp.com/1217634902127718/
- Meta, ejemplos Cloud API y validación de firmas: https://github.com/fbsamples/whatsapp-api-examples
- Meta, recepción: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/receivingMessages/
- Precios oficiales: https://business.whatsapp.com/products/platform-pricing
- Biblioteca alternativa, autenticación por QR: https://wwebjs.dev/guide/creating-your-bot/authentication.html

La página Meta específica de coexistencia devolvió 429 durante la consulta. La elegibilidad y condiciones de ese flujo requieren verificación adicional; no se garantiza que esté disponible para la cuenta del usuario. Las tarifas deben revisarse al configurar, no se fija un precio en este documento.

## Envío implementado en 0.9.1
Autorizado por el usuario el 2026-09-08 tras validar QR y cambio de número con dos números propios. Reglas: solo pedidos en estado pendiente; destinatario = WhatsApp de la ficha del proveedor, que además debe estar autorizado para la cuenta conectada; el servidor compone el texto (orderMessage) y rechaza cualquier texto distinto al de la vista previa; un envío por pedido (tabla sent del canal y campo dispatch del pedido); bloqueo de envíos concurrentes; sin reintentos automáticos: si el envío falla, el pedido sigue pendiente y se puede repetir a mano. Si el envío se realiza pero falla el registro en el inventario, la tabla sent del canal conserva la prueba y el pedido no se reenvía. Ningún mensaje se envía sin pulsar «Enviar ahora».

## Respuestas desde Mensajes (0.15.0)
Un mensaje recibido por WhatsApp de un chat autorizado puede responderse desde su detalle en Mensajes. La app propone textos cortos según la lectura por reglas (fecha aceptada, «mándanos lo que tengas», «lo compramos por otro lado», sí/no a una pregunta, «te llamo»); el texto se muestra en un diálogo, se puede editar y se envía una sola vez con la misma ruta y comprobación en la página que los pedidos (whatsapp.send). Al enviar, el mensaje queda cerrado con la decisión «Respondido por WhatsApp: …». Sin canal conectado, sin remitente real o para mensajes de demostración no hay botón de respuesta.
