# TODO — estado del prototipo

La especificación completa permanece en docs/TODO.md. Este archivo indica el estado real de 0.1.0.

## Entregado y comprobado

- [x] Código, dependencias, documentos y ejecutable dentro de D:/APPGELATOSTOCK.
- [x] Ventana de escritorio Windows con componentes incluidos.
- [x] Inventario, conteo, búsqueda, categorías y alta de producto.
- [x] Carrito, propuesta de reposición y pedidos por proveedor.
- [x] Envío simulado y recepción parcial con conversión de presentaciones.
- [x] Mensajes de demostración, prioridades, revisión y asociación de pedido.
- [x] Persistencia local y copias/restauración validadas por pruebas.
- [x] Archivo manual de imágenes dentro del prototipo.
- [x] Historial de actividad separado de los informes de desarrollo.
- [x] Pruebas de dominio y servidor; prueba del ejecutable con reinicio.
- [x] Revisión visual de resumen, compras y mensajes.
- [x] Instrucciones de continuidad y reportes por sesión.

## Antes de usar como sistema real

- [ ] Confirmar productos, proveedores, recetas, unidades y sistema de ventas reales.
- [ ] Revisar arquitectura y código con Claude.
- [ ] Migrar JSON a SQLite con adjuntos separados, operaciones transaccionales y migración probada.
- [ ] Añadir edición completa de productos y proveedores; entradas/salidas/ajustes con motivos y reversión explícita.
- [ ] Ampliar validación de copias y pruebas de interrupción eléctrica/disco lleno.
- [ ] Definir autenticación y permisos si lo usa más de una persona.
- [ ] Mejorar accesibilidad con auditoría de contraste, teclado y pruebas con usuarios.
- [ ] Empaquetar, firmar y probar en MacBook Neo A18 Pro real.
- [ ] Firmar la distribución Windows y crear instaladores/actualizaciones seguras.

## Funciones siguientes

- [ ] OCR local integrado y revisión de extracción.
- [ ] Motor/modelo local redistribuible, medido en 8 GB y gestionado dentro de la app.
- [ ] Memoria de equivalencias y correcciones aprobadas.
- [ ] Canal de WhatsApp real con recepción por eventos, notificaciones y recuperación.
- [ ] Probar retención y entrega de mensajes mientras la app está cerrada.
- [ ] Reglas de relevancia ligadas a pedidos; prioridad independiente de relevancia.
- [ ] Notificaciones nativas configurables: hoy los avisos están dentro de la app.
- [ ] Integración comprobada con Makro España u otro proveedor real.
- [ ] Recetas, producción, ventas, mermas, lotes y vencimientos.
- [ ] Sincronización entre lugares con resolución de conflictos y único envío por pedido.

## Límites conocidos

Una sola instancia/escritor por conjunto de datos. Límite de archivo 24 MB. Sin pagos, sin conectores externos, sin sincronización. El clasificador por palabras puede equivocarse: las etiquetas son revisables y no ejecutan compras. Las fotos no cambian stock.
