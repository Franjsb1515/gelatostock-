# Sesión 046 · Compras y Mensajes II, fase 1: otro proveedor del mismo producto · versión 0.34.0

## Encargo
El usuario no trajo correcciones de uso (dejó vacío ese apartado), así que la sesión empieza el encargo grande: Compras y Mensajes II. Primero condensarlo en un plan con decisiones, fases y preguntas; después, una fase.

## Plan
docs/PLAN_COMPRAS_MENSAJES_II.md, con las cuatro respuestas del usuario del 2026-09-20:

- «Simulación» y «Simular envío» se quedan: los usa para probar. Queda como fase diferida y anotado en TODO.
- Sustituto = el mismo producto comprado a otro proveedor (no «producto parecido»).
- Las listas de precios le llegan en PDF y en papel que fotografía; pide mejorar la foto «para que no haya errores».
- Reclamar respuesta: un clic, ve el texto y envía; uno a uno.

Dicho antes de programar, y escrito en el plan: no se puede garantizar cero errores leyendo la foto de una tarifa. Lo que sí se puede es leer el texto exacto de un PDF que lo lleve (no es OCR), preparar la imagen antes de leerla y revisar línea a línea con el original al lado. Se medirá con documentos reales suyos; con material inventado por la sesión, la cifra no valdría nada.

Fases: 1 otro proveedor · 2 reclamar respuesta y plantillas editables · 3 texto de los PDF · 4 listas de precios en foto · 5 catálogo y precios por proveedor.

## Lo que se ha construido (fase 1)

**Núcleo.** `productFields.alternates`: hasta cinco proveedores más por producto, cada uno con `supplier`, `pack` y `price` escritos por la persona. Nada se deduce: sin precio, el importe sale como «No disponible». Acciones `setAlternate` (añade o actualiza; rechaza al proveedor habitual y el sexto) y `removeAlternate` (además limpia las líneas del carrito que lo usaban, para que nada se compre por sorpresa a quien ya no está). `editProduct` quita de la lista al proveedor que pase a ser el habitual.

**Carrito.** Cada línea lleva `supplier?` opcional. En la acción `cart`, omitir ese campo conserva la elección anterior (así los botones − y + no la borran) y nombrar al proveedor habitual la deshace. `authorize` agrupa por el proveedor de cada línea y copia el `pack` y el `price` de ese proveedor a la línea del pedido, que sigue siendo una instantánea.

**Interfaz.** Botón «Otros proveedores» en cada fila de Inventario, con el número de los que haya; el modal lista los apuntados y permite quitarlos. En el carrito, la línea de un producto con alternativas trae un desplegable con cada proveedor, su formato y su precio, y el importe de la línea y el total usan el elegido. En un mensaje que dice que falta un producto y está vinculado a un pedido, aparece «Comprarlo a …» por cada proveedor apuntado (con el importe de los mismos paquetes del pedido); confirma en un modal y lo deja en el carrito, sin enviar nada. Si el producto no tiene alternativas, el botón ofrece apuntarlas.

**De paso.**
- Fuera «unidad base» de los formularios de Inventario: ahora dicen la unidad del producto («Cantidad que hay ahora en kilos», «Cantidad en litros») y la etiqueta cambia al cambiar de producto (`unitLabel` y `retitleField` en src/ui/forms.js). También «Unidad base» → «Se mide en» y «Unidades base por paquete» → «Cuánto trae cada paquete».
- El alta de un producto decía «Proveedor de demostración»: ahora «Proveedor».
- Al autorizar un solo pedido, el texto decía «Se crearán 1 pedidos»: ahora «Se creará 1 pedido pendiente de envío».

## Por qué así
- **No cambia la ficha del producto.** Comprar esta vez a otro no convierte a ese proveedor en el habitual: el precio de la ficha es el que alimenta el coste de las recetas, y cambiarlo por una compra puntual falsearía el coste de producciones futuras.
- **La app no elige.** Solo enseña lo que el usuario apuntó, con el precio de cada uno a la vista; la comparación la hace él.
- **Sin migración de SQLite.** Productos y carrito se guardan como JSON dentro de sus tablas, así que los valores por omisión de zod bastan; `user_version` sigue en 5.

## Pruebas
- `npm test`: 178 pruebas, 0 fallos (tres nuevas en tests/domain.test.cjs: apuntar y actualizar un alternativo sin tocar la ficha; comprar a él y que el pedido lleve su formato y su precio; volver al habitual y que quitarlo limpie el carrito y rechace comprarle).
- `npm run typecheck` y `npm run format:check`: limpios.
- `npm run package:win`: ejecutable 0.34.0 reconstruido.
- `npm run test:desktop`: 19 PASS (uno nuevo: se apunta Origen Coffee como otro proveedor del pistacho con 2 kg y 30 €, el carrito se lo pide a él, el pedido nace con ese formato y ese precio y la ficha sigue en Gelato Italia). Salida en work/desktop-0340.log. Las dos primeras ejecuciones se lanzaron solapadas con otra y murieron en el paso del modelo local; la ejecución limpia termina con exit=0.
- `node scripts/evaluate-ai.cjs --chat`: 24/24, con un caso nuevo («mi proveedor no tiene un producto, ¿puedo pedírselo a otro?»). Salida en work/audit-chat-0340.txt.
- **Sobre una COPIA de los datos reales** (work/check-fase1-cm2.cjs, salida en work/check-fase1-cm2.txt), por la interfaz y con su propio producto y su proveedor FRAN: se apunta Origen Coffee con 4 kg y 12,50 €; la línea del carrito pasa de 49,00 € a 25,00 € al elegirlo; se autoriza y el pedido GS-013 sale a Origen Coffee con `pack: 4` y `price: 1250`; el proveedor de la ficha no cambia; en Resumen, Inventario, Compras, Producción y Recetario hay 0 apariciones de «unidad base» y «producto terminado»; los modales dicen «Cantidad que hay ahora en kilos» y «Cantidad en kilos»; sin errores de consola. La carpeta temporal se borra al terminar y data/ no se toca.

## Límites que quedan
- El precio que se escribe para otro proveedor no entra todavía en el historial de precios del producto (ese historial es del proveedor habitual); entrará con la fase 5, que es la que da a cada proveedor su catálogo y su precio.
- El coste de las recetas sigue usando el precio de la ficha, no el del pedido en que se compró: sin lotes no se sabe qué compra se gastó (ya estaba en TODO).
- «Comprarlo a …» aparece cuando las reglas reconocen de qué producto habla el proveedor; si no lo reconocen, quedan «Quitar del pedido» y el carrito normal.
- Nada de esto envía mensajes: reclamar respuesta es la fase 2.
