# Para qué sirve Control de entregas

El carrito prepara lo que quieres comprar. Control de entregas compara cada pedido autorizado con la mercancía que realmente llega, para actualizar el inventario y recordar lo que falta.

1. Autoriza el carrito: se crea un pedido por proveedor, sin sumar stock.
2. En este prototipo, Simular envío permite probar el flujo. No contacta al proveedor.
3. Abre Registrar lo que llegó y escribe SOLO las cantidades de esa entrega. Usa las unidades indicadas: litros, kilos o unidades. No introduzcas cajas si el campo dice litros.
4. Al guardar, esas cantidades se suman al stock. Una recepción parcial sigue En curso con el detalle pendiente.
5. Al recibir todo, pasa a Cerrados. Allí también aparecen cancelaciones, sin mercancía esperada.

Ejemplo: pides dos cajas de leche de 6 L. Pedido: 12 L. Llegan 4 L y registras 4. Recibido: 4 L, falta recibir: 8 L. Cuando llegan los 8 restantes, registras 8, no 12. El sistema impide superar lo pendiente y las pruebas verifican que un reintento de la misma operación no duplique stock.

Las columnas mantienen cada producto y unidad por separado. El indicador cuenta productos COMPLETOS: con una entrega parcial de leche puede mostrar 0 de 1, aunque la columna Recibido ya indique 4 L. No suma litros con kilos para producir un porcentaje engañoso.

Los importes son estimaciones de los precios guardados al autorizar, no facturas pagadas. Los estados de entrega no prueban pagos ni confirmaciones reales del proveedor.
