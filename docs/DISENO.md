# Diseño e interacción

## Objetivo

Que una persona del negocio pueda registrar existencias, preparar un pedido y entender una novedad del proveedor sin conocimientos técnicos. La IA aparece como ayuda para una tarea concreta, integrada en la pantalla correspondiente.

## Navegación principal

- Inicio: faltantes críticos, pedidos pendientes, mensajes importantes y acciones del día.
- Stock: búsqueda, filtros, conteo rápido, movimientos y carga de foto.
- Compras: carrito por proveedor, pedidos y recepción.
- Proveedores: contactos, conversación, documentos y condiciones de compra.
- Configuración: negocio, copias, conexiones, avisos y componentes locales.

Recetas y producción se añaden cuando exista ese módulo. Evitar menús vacíos de funciones futuras.

## Flujos principales

### Cargar stock

Elegir «Contar stock», «Registrar entrada» o «Añadir faltante» antes de introducir cantidades. La unidad aparece junto al campo. Tras guardar se muestra el movimiento y una acción para corregirlo.

### Cargar una foto

Botón «Cargar foto» → elegir propósito → seleccionar imagen → ver progreso → comparar original y filas extraídas → corregir → aplicar. Las filas dudosas muestran el motivo. Conservar el borrador si falla el análisis.

### Comprar

Carrito agrupado por proveedor. Mostrar producto, presentación, cantidad y costes. Antes de autorizar, dejar visibles los gastos desconocidos. Sin internet, el botón explica «Autorizar y dejar pendiente de envío». Tras enviar, mostrar evidencia disponible, no una confirmación comercial inventada.

### Recibir un mensaje

Aviso: «Proveedor X: cambio en tu pedido». Dentro: mensaje original, interpretación, motivo de importancia y acciones como «Revisar cambio», «Vincular pedido» o «Marcar revisado». No abrir ventanas que interrumpan una recepción de mercadería.

### Registrar entrega

Comparar solicitado, confirmado y recibido; permitir diferencias y entrega parcial. Mostrar el efecto en stock antes de guardar.

## Prioridad de avisos

| Nivel | Ejemplo | Comportamiento |
|---|---|---|
| Requiere atención | Cancelación, sobrecoste o sustitución en pedido activo | Aviso destacado con motivo y acción |
| Informativo | Confirmación o fecha de entrega acordada | Aviso discreto y registro en el pedido |
| Baja prioridad | Promoción sin relación con un pedido | Contador o resumen según preferencia |
| Por revisar | No se identifica a qué pedido corresponde | Bandeja de revisión, sin cambios comerciales |

Relevancia y prioridad son configurables. Permitir silenciar avisos sin borrar mensajes. No usar sonido por defecto para todos los eventos. Si el sistema operativo bloquea notificaciones, mantener contador y bandeja dentro de la app.

## Lenguaje y aspecto visual

Texto en español claro, importes en euros y unidades siempre visibles. Jerarquía visual simple, espacios consistentes y botones principales fáciles de identificar. Evitar jerga como tokens, webhook o inferencia en los flujos del negocio.

Estados mediante texto e iconos además del color. Navegación por teclado, foco visible, contraste suficiente y mensajes que no dependan de recordar una notificación fugaz. Diseñar para ventana pequeña y pantalla completa.

Mostrar «Sin conexión: tus cambios están guardados» y «3 pedidos pendientes de envío». Diferenciar ese estado de «Conexión con proveedor no configurada» y de un error de envío.

## Pruebas de diseño

- Pedir a una persona del negocio que cargue un conteo sin ayuda.
- Verificar que distingue cajas de unidades y entrada de faltante.
- Probar que encuentra un mensaje importante y entiende por qué lo es.
- Revisar pantalla vacía, carga, éxito, error, sin red y datos ambiguos.
- Verificar que puede corregir una lectura y registrar una entrega parcial.
- Inspeccionar visualmente cada entrega de interfaz en el tamaño objetivo.
- Registrar dificultades observadas y corregirlas antes de añadir pantallas.
