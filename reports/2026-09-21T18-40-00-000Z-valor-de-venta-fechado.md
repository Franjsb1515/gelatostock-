# Sesión 047 (quinta parte) · El valor de venta se puede fechar · versión 0.41.0

## Encargo

«Continúa». De TODO §5, el siguiente pendiente que se puede hacer sin él: **«Valor de venta con fecha de inicio elegible (hoy siempre vale desde el día de negocio en que se escribe)»**.

Antes de empezar se cerró el pendiente que quedaba de las versiones anteriores: `npm run test:desktop` pasó entero con el ejecutable 0.40.2 (**21 PASS**, salida guardada en reports/desktop-smoke-2026-09-21-v0402.txt). Incluye, dentro del ejecutable, las tres cosas nuevas de esta tanda: el aviso de mensajes nuevos, la merma con motivo y el objetivo de merma.

## El problema real

El valor de venta de un gelato se guardaba siempre con la fecha del día en que se escribía. Si el usuario apuntaba el precio el jueves, el lunes anterior se quedaba sin valor: su venta estimada salía «No disponible» y el resumen de ese día no cuadraba con lo que él sabía que había vendido. El núcleo ya guardaba un historial por fecha (`saleValues`) y la acción ya aceptaba `from`: **lo que faltaba era poder elegirlo en la pantalla**.

## Qué cambia en pantalla

- **Recetario → valor de venta**: el formulario de «Escribir valor» / «Cambiar» tiene ahora **«Vale desde»**, con hoy por defecto.
- Si lo escribes tarde, pones el día en que empezó a valer y **la venta estimada de esos días se recalcula**.
- Si ya sabes desde cuándo sube, puedes poner **un día futuro**: no cambia nada hasta que llegue.
- Los días anteriores a esa fecha **conservan el valor que tenían**, como siempre.
- La nota de Actividad dice desde qué día vale y, si dentro de esa fecha hay días ya cerrados, **cuántos son**: su resumen confirmado no cambia y el día avisa de que algo cambió.

## Una corrección propia, encontrada por las pruebas

Al principio puse un límite: prohibir fechar hacia delante. La prueba `confirmar el cierre congela el día` (tests/day.test.cjs) falló y enseñó que **fechar hacia delante ya estaba soportado a propósito** desde la 0.31.0, y que tiene sentido para una tienda («desde el lunes subo el precio»). Se quitó la prohibición en vez de cambiar la prueba: el límite lo ponía yo, no el negocio. La interfaz admite un año hacia atrás y otro hacia delante, para evitar teclear un año equivocado.

## Lo que no cambia

- **Un día cerrado sigue congelado.** Su resumen confirmado es una instantánea y no se reescribe; si el valor de venta cambia por detrás, el día lo avisa (eso ya existía desde la 0.31.0).
- El **coste** no se toca: cada producción guardó el suyo al aprobarse.
- Nada de esto cambia stock, ventas registradas ni pedidos: solo con qué precio se valora cada día.
- **El precio de compra no se fecha**: no es el mismo caso y por eso no se hizo a la vez. Como el coste de cada producción es una instantánea, cambiar la fecha de un precio no cambiaría ningún número pasado; solo movería el historial y la ventana de 30 días de los avisos de subida. Queda en TODO con esa explicación, para decidirlo.

## Núcleo

- `core/domain.ts · setSaleValue`: la fecha la elige la persona (sin límite artificial); la nota cuenta los días ya cerrados desde esa fecha para que no sorprenda el aviso de «algo cambió».
- `core/value.ts · saleValueOn` no cambia: ya elegía la entrada con el `from` mayor que no pasa del día mirado, así que una fecha futura no afecta a hoy.
- Interfaz: campo «Vale desde» en el formulario del valor de venta (src/ui/actions.js), con su explicación.

## Pruebas

- `npm test`: **199 pruebas, 0 fallos** (salida en reports/tests-2026-09-21-v0410.txt). Nueva en tests/value.test.cjs: un valor escrito hoy con fecha de hace tres días vale para ese día y no para el anterior, la venta estimada de ese día se recalcula, una fecha futura no toca el valor de hoy y sí el de mañana, y con un día ya cerrado desde esa fecha la nota lo dice y el cierre sigue confirmado.
- `npm run typecheck` y `npm run format:check`: limpios.
- `node scripts/evaluate-ai.cjs --chat`: **34/34**, con un caso nuevo («escribí tarde el precio, ¿puedo ponerlo desde el lunes pasado?»). Salida en work/audit-chat-0410.txt. Hubo que reescribir la frase de la guía del chat: con la primera redacción, la pregunta traía el párrafo del coste.
- `npm run package:win`: ejecutable 0.41.0 reconstruido (work/audit-package-0410.txt).
- `npm run test:desktop`: **no pudo terminarse con este ejecutable**. Se intentó dos veces y las dos se cortó en `page.screenshot: Timeout` al poco de empezar, el síntoma conocido de la pantalla suspendida (el equipo quedó sin nadie delante). La comprobación nueva del ejecutable está escrita en scripts/desktop-smoke.cjs («Vale desde» viene con hoy, admite un año a cada lado, y un valor fechado ayer convive con el de hoy en el historial) pero **todavía no se ha visto pasar**. La misma prueba, con el ejecutable 0.40.2, pasó entera esta tarde (21 PASS). Queda pendiente repetirla con el equipo despierto. Salida en work/desktop-0410.log.
- **Sobre una COPIA de los datos reales** (work/check-valor-desde.cjs, salida en work/check-valor-desde.txt): con su receta CHOCOLOCO, que ya tenía 200,00 €/kg desde el 21 de septiembre, se escribe 12,50 €/kg desde el 18 y el historial queda con las dos fechas, cada una en su día; una fecha futura entra en el historial sin cambiar el valor de hoy (sigue en 200,00 €). Sin errores de consola.

## Límites que quedan

- La fecha se elige **al escribir el valor**; una entrada ya guardada no se puede mover de día ni borrar desde la pantalla (se corrige escribiendo otra vez con esa misma fecha).
- El historial se enseña en la ficha de la receta como una línea de texto; no hay una tabla para repasarlo ni para quitar una entrada.
- Un día cerrado que quede dentro de la fecha elegida seguirá enseñando su resumen confirmado con el aviso de cambio: para que cuadre hay que reabrirlo y volver a confirmarlo.
- El precio de compra sigue apuntándose siempre con la fecha de hoy.
