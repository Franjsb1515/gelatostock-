# Checklist principal de aceptación

Esta lista sirve para revisar entregas y decidir si pueden usarse en el negocio. TODO.md contiene las tareas de implementación.

## Primordial — antes de usar datos reales

- [ ] La app se instala mediante interfaz gráfica, sin terminal ni aplicaciones auxiliares que el usuario deba manejar.
- [ ] Abre sin internet y sin una suscripción activa de IA.
- [ ] Guarda los datos y los conserva al cerrar o reiniciar.
- [ ] Stock, cantidades y dinero funcionan con la IA apagada.
- [ ] Diferencia stock contado, faltante solicitado y mercadería recibida.
- [ ] Convierte cajas y unidades correctamente; evita descuentos dobles.
- [ ] Permite corregir errores y ver el historial.
- [ ] Una copia de seguridad se ha restaurado con éxito.
- [ ] Las simulaciones se distinguen de acciones reales.
- [ ] Se han probado los flujos principales en el sistema operativo que se entrega.

## Principal — antes de activar compras

- [ ] El carrito muestra proveedor, presentación, cantidades y costes conocidos.
- [ ] La autorización corresponde al contenido exacto que se envía.
- [ ] El pedido offline permanece pendiente y visible.
- [ ] Al reconectar, no se envían pedidos caducados o modificados fuera de autorización.
- [ ] Doble clic, reinicio y reintento no duplican compras.
- [ ] Un resultado desconocido no desencadena un reenvío a ciegas.
- [ ] Enviado, confirmado y recibido son estados distintos.
- [ ] Las entregas parciales actualizan únicamente lo recibido.

## Principal — mensajes de proveedores

- [ ] Un mensaje entrante llega mediante evento del canal, sin vigilar la pantalla.
- [ ] Se identifica el proveedor y se conserva el mensaje original.
- [ ] Solo se extrae información operativa relevante; el resto sigue en la conversación.
- [ ] Los mensajes dudosos quedan para revisión.
- [ ] Un mensaje importante muestra motivo y acción sugerida.
- [ ] Se puede corregir prioridad, asociación y preferencias de aviso.
- [ ] No se aceptan sustituciones o sobrecostes sin autorización.
- [ ] Se comprueba recuperación tras interrupciones dentro de la retención acordada.
- [ ] Los costes y requisitos del conector se muestran antes de activarlo.

## Principal — fotos, IA integrada y diseño

- [ ] El instalador completo permite usar IA sin conexión posterior.
- [ ] No hay llamadas ocultas a modelos externos.
- [ ] Fotos y extracción pueden compararse y corregirse.
- [ ] Un documento repetido no duplica existencias.
- [ ] La app señala lo que no reconoce y no inventa cantidades.
- [ ] Las correcciones guardadas pueden consultarse y deshacerse.
- [ ] El análisis puede cancelarse y no bloquea el inventario.
- [ ] La interfaz explica errores y ofrece un siguiente paso claro.
- [ ] Los estados se distinguen por texto e icono, además de color.
- [ ] El rendimiento se midió en el Mac de 8 GB y se documentaron límites.

## Evidencia mínima de una versión

Adjuntar versión, equipo/SO, pruebas ejecutadas y resultados; capturas de los flujos revisados; fallos conocidos; funciones simuladas; procedimiento de copia y recuperación. «El código compila» no demuestra por sí solo que el flujo de negocio funciona.
