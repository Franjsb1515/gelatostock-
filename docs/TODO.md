# TODO — plan de implementación

> Plan original (2026-09-07), conservado como referencia histórica. El estado real por entrega está en TODO.md de la raíz; no marcar casillas aquí.

Estado inicial: especificación preparada; aplicación aún no implementada. Mantener cada casilla abierta hasta tener evidencia de aceptación. Referencia normativa: PROMPT_MAESTRO.md.

## P0 — decisiones que habilitan el trabajo

- [ ] Confirmar equipo objetivo y versión de macOS; identificar Windows de prueba.
- [ ] Confirmar elaboración propia o compra de helados/postres.
- [ ] Reunir muestra de productos, presentaciones y documentos anonimizados.
- [ ] Identificar proveedores reales, enlaces y canal de pedidos.
- [ ] Identificar sistema de ventas y necesidad inicial de importación.
- [ ] Acordar primer equipo principal y uso independiente o compartido futuro.
- [ ] Elegir arquitectura de escritorio, datos y pruebas con una justificación breve.
- [ ] Verificar distribución del motor y modelo: licencia, hardware, tamaño y uso offline.
- [ ] Definir presupuesto para servicios externos de mensajería y distribución.

## P1 — núcleo local y diseño

- [ ] Crear bocetos de Inicio, Stock, Compras, Proveedores y Configuración.
- [ ] Revisar vocabulario y flujo con una persona del negocio.
- [ ] Crear estructura mínima de aplicación y base de datos versionada.
- [ ] Implementar catálogo, unidades y equivalencias de presentación.
- [ ] Implementar movimientos, conteos y registro de autor/origen.
- [ ] Implementar proveedores y precios con fecha.
- [ ] Calcular faltantes teniendo en cuenta pendientes vigentes.
- [ ] Implementar carrito por proveedor y pedido simulado identificado.
- [ ] Implementar recepción parcial y actualización de stock.
- [ ] Implementar exportación, copia y restauración.
- [ ] Probar flujo completo sin conexión y tras reiniciar.

Puerta de salida: el negocio puede registrar stock, preparar un pedido y recibir mercadería sin internet ni IA.

## P2 — IA y fotos integradas

- [ ] Crear conjunto de evaluación con fotos y resultados esperados.
- [ ] Probar OCR local y reglas antes de incorporar un modelo.
- [ ] Comparar modelos pequeños compatibles en el equipo objetivo.
- [ ] Medir memoria máxima, latencia y exactitud de campos críticos.
- [ ] Integrar motor interno sin instalación externa ni terminal.
- [ ] Crear instalador completo offline con componentes verificados.
- [ ] Implementar revisión de extracción y selección del tipo de movimiento.
- [ ] Detectar documentos repetidos y productos ambiguos.
- [ ] Guardar y deshacer equivalencias/correcciones aprobadas.
- [ ] Probar modelo desactivado, imagen ilegible y cancelación de análisis.

Puerta de salida: lectura local revisable y funciones básicas intactas aunque falle la IA; resultados medidos, no estimados.

## P3 — mensajes y avisos

- [ ] Verificar opciones oficiales del canal de WhatsApp elegido.
- [ ] Definir configuración de cuenta, plantillas y restricciones vigentes.
- [ ] Validar intermediario de eventos, costes y retención necesarios.
- [ ] Implementar conexión guiada dentro de la app.
- [ ] Guardar originales y adjuntos antes de interpretar.
- [ ] Validar origen de eventos y eliminar duplicados.
- [ ] Recuperar eventos tras desconexión, suspensión y reinicio.
- [ ] Asociar proveedor y pedido; dejar ambigüedades para revisión.
- [ ] Clasificar relevancia, urgencia y acción requerida por separado.
- [ ] Mostrar bandeja, conversación, avisos normales e importantes.
- [ ] Permitir corregir prioridades y configurar notificaciones.
- [ ] Probar eventos repetidos, fuera de orden y no identificados.
- [ ] Probar mensaje importante con pedido activo y promoción sin pedido.

Puerta de salida: un mensaje real de prueba aparece una sola vez, conserva evidencia, genera el aviso correcto y no modifica stock por sí solo.

## P4 — envío de pedidos

- [ ] Implementar autorización de la versión exacta del pedido.
- [ ] Implementar cola persistente y estados de envío verificables.
- [ ] Verificar vigencia al reconectar y cambios de condiciones.
- [ ] Evitar repetición por doble clic, reintento o fallo durante el envío.
- [ ] Resolver estados de resultado desconocido antes de reenviar.
- [ ] Integrar primer proveedor y probar con autorización concreta.
- [ ] Separar confirmación comercial, entrega del mensaje y recepción.
- [ ] Investigar Makro España y documentar integración disponible.
- [ ] Añadir compra asistida o integración web validada por proveedor.

Puerta de salida: un pedido autorizado se envía una sola vez y puede seguirse hasta su recepción parcial o total.

## P5 — distribución y operación

- [ ] Probar instalación gráfica en Mac limpio con hardware objetivo.
- [ ] Probar instalación y flujos básicos en Windows limpio.
- [ ] Verificar arranque offline sin herramientas de desarrollo instaladas.
- [ ] Preparar firma/notarización y procedimiento de actualización.
- [ ] Probar migración con datos existentes y recuperación ante fallo.
- [ ] Proteger credenciales y revisar qué datos salen del ordenador.
- [ ] Añadir diagnóstico legible, sin secretos, exportable por el usuario.
- [ ] Entregar ayuda de primer uso y procedimiento de restauración.

## P6 — ampliaciones, después de validar uso real

- [ ] Recetas, producción, rendimiento, mermas y lotes.
- [ ] Importación o integración con ventas.
- [ ] Reposición basada en consumo y plazos de entrega.
- [ ] Sincronización entre equipos con conflictos y envíos únicos.
- [ ] Captura de pantalla opcional con alcance y permisos visibles.
- [ ] Evaluar métricas de tiempo ahorrado, errores y coste operativo.

## Registro por entrega

Completar para cada entrega: fecha, requisito resuelto, cambios, pruebas ejecutadas, resultado, limitaciones, evidencia y siguiente paso. No marcar una prueba de Mac como realizada si solo se ejecutó en Windows.
