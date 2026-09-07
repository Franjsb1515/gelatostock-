# Camino de la aplicación y meta final

## Meta final

Una aplicación de escritorio instalable para una gelatería con café de especialidad y postres en España. Desde un único lugar, el negocio conoce sus existencias, prepara reposición, autoriza pedidos, recibe novedades de proveedores y registra lo entregado. La operación básica y la interpretación con IA son locales. Internet se utiliza para comunicarse y, si se habilita, sincronizar.

La experiencia deseada es: instalar → abrir → cargar productos → trabajar. Conectar WhatsApp u otros proveedores añade un asistente dentro de la app, porque requiere cuentas y autorización propias. No se exige al usuario instalar o administrar un motor de IA por separado.

## Ejemplo de un día de uso

Por la mañana se registra leche, café y envases disponibles. La app propone reposición teniendo en cuenta pedidos en camino. El usuario revisa el carrito y autoriza comprar. Si no hay internet, queda pendiente.

Con conexión, se envía por el canal configurado. El proveedor responde «solo quedan dos cajas, el resto llega mañana». Un evento entrega el mensaje a la app. Esta conserva el original, lo asocia al pedido y muestra un aviso importante por cambio de cantidad. Registra automáticamente solo los hechos admitidos por reglas validadas; cualquier aceptación comercial pendiente requiere revisión.

Al recibir dos cajas, el usuario registra esa recepción. Se suma esa cantidad al stock y el resto continúa pendiente. Una foto del albarán ayuda a cargar la entrega, con revisión antes de aplicarla.

## Arquitectura funcional propuesta

Una interfaz de escritorio contiene inventario, compras, bandeja de proveedores y configuración. Un núcleo local gobierna movimientos, autorizaciones, reglas y colas. Una base de datos conserva datos y memoria aprobada. Un módulo de lectura local interpreta imágenes y texto bajo demanda.

Los conectores son módulos separados del núcleo: envío, recepción de eventos y recuperación de pendientes. Para WhatsApp puede ser necesario un receptor externo mínimo de webhooks. Ese componente no ejecuta la IA del negocio; su necesidad, coste y retención deben verificarse y comunicarse. Local no significa que WhatsApp funcione sin internet.

## Camino por etapas

| Etapa | Resultado útil | Condición para avanzar |
|---|---|---|
| 1. Núcleo offline | Stock, carrito y recepción manual | Flujo completo probado sin red y datos recuperables |
| 2. Lectura integrada | Fotos y memoria de equivalencias | Instalador autónomo y evaluación en equipo real |
| 3. Mensajes | Bandeja y avisos por eventos | Recuperación y deduplicación comprobadas |
| 4. Compras | Envío autorizado al primer proveedor | Sin duplicados y con confirmaciones verificables |
| 5. Distribución | Instalación para usuarios Mac/Windows | Equipos limpios y actualizaciones probadas |
| 6. Optimización | Recetas, ventas y varios equipos | Datos reales que justifiquen cada ampliación |

Distribuir prototipos internos antes es posible; la etapa 5 es la validación para uso general. Cada etapa entrega algo utilizable y conserva lo anterior. No se promete una fecha sin estimar alcance, integraciones y pruebas.

## Qué significa aprender

La app acumula equivalencias, preferencias y correcciones aprobadas. Puede reconocer que un código de albarán corresponde a un producto y recordar su presentación. Esto no equivale a entrenar el modelo ni a permitir que un mensaje externo cambie las reglas del negocio.

## Uso en otros equipos y lugares

El instalador completo debe incluir lo necesario para uso local, sujeto a licencias y requisitos de hardware. Una nueva instalación puede iniciar un negocio vacío o restaurar una copia. Esa restauración no es sincronización en vivo.

Compartir un negocio entre lugares requiere una fase explícita: identidad, acceso seguro, intercambio de cambios, conflictos y control de quién envía cada pedido. Si ambos equipos trabajan offline, los conflictos deben hacerse visibles al reconectar. No habrá avisos instantáneos en un ordenador apagado o sin red.

## Límites iniciales

No incluye pagos autónomos, integración universal con cualquier web, entrenamiento de modelos, conteo exacto de productos ocultos ni vigilancia permanente de pantalla. Se priorizan capturas aportadas por el usuario y mensajes entrantes de proveedores.

## Cómo evaluar el éxito

- Menos tiempo para pasar de un faltante a un pedido revisado.
- Menos errores de presentación, cantidad y duplicación.
- Mensajes importantes visibles con explicación y acción pendiente.
- Exactitud de extracción medida por producto, cantidad y unidad, incluyendo cuántos casos requieren revisión.
- Inventario coherente y recuperable después de fallos.
- Consumo de memoria y tiempos de análisis aceptables en el equipo objetivo, con umbrales acordados tras el prototipo.
- Cero necesidad de API de IA de pago para las operaciones definidas como locales.

## Información pendiente

Elaboración propia o compra de productos; sistema de ventas; lista y enlaces de proveedores; cuenta/canal de WhatsApp; número de usuarios y equipos; muestras de documentos; presupuesto de conectividad externa. Recoger cada dato cuando afecte a la etapa correspondiente.
