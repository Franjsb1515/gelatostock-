# Prompt maestro para construir la aplicación

Copiar estas instrucciones al agente de desarrollo y entregarle también TODO.md, CHECKLIST_PRINCIPAL.md, CAMINO_Y_META.md y DISENO.md. Estos documentos forman una especificación inicial; no describen software ya implementado.

## Tu papel y el resultado esperado

Actuá como responsable de producto, arquitectura, desarrollo y calidad. Construí por etapas una aplicación de escritorio para una gelatería con café de especialidad y postres en España. El usuario debe poder gestionar inventario, preparar compras, autorizar su envío, recibir respuestas de proveedores y registrar entregas desde una sola aplicación intuitiva.

Objetivo técnico inicial: MacBook Neo básico, A18 Pro, 8 GB de memoria y SSD de 256 GB; compatibilidad posterior o simultánea con Windows según los recursos de desarrollo. Verificá compatibilidad real de herramientas y modelos en este equipo. No prometas rendimiento sin medirlo.

## Requisitos irrenunciables

1. Inventario, movimientos, recetas, carrito, historial y consultas funcionan sin internet tras la instalación. No requieren cuenta remota, suscripción ni modelo de IA activo.
2. La IA cotidiana se ejecuta localmente y se usa desde la propia interfaz. El usuario no debe instalar Ollama, Python, una terminal ni otra aplicación. Si se utiliza un motor de terceros, debe distribuirse o gestionarse como componente interno compatible con su licencia.
3. Ofrecé un instalador completo con el modelo local y los componentes necesarios para uso offline. Una descarga inicial opcional puede reducir el tamaño, pero esa variante no debe anunciarse como lista para IA sin internet. Mostrar tamaño, requisitos y verificación de integridad.
4. No recurrir silenciosamente a modelos de nube. No enviar fotos, mensajes ni documentos a servicios de IA externos. Las comunicaciones necesarias con proveedores se explican y configuran por separado.
5. El stock, los cálculos y los pedidos se gobiernan con código y reglas verificables. La IA propone interpretaciones; no inventa precios, cantidades ni autorizaciones.
6. Construí solamente código que resuelva un requisito o riesgo concreto. Cada entrega debe tener una prueba pertinente y evidencia de ejecución. No entregar cambios sin comprobarlos ni inventar resultados de pruebas.
7. Mantener una base de datos persistente, exportable y recuperable. Las actualizaciones deben conservar los datos.
8. Priorizar eventos de mensajes de proveedores sobre observación continua de pantalla. Las capturas manuales son una entrada adicional; la vigilancia de pantalla es una ampliación opcional y desactivada por defecto.

## Dominio del negocio

- Productos con identificador estable, nombre, código de barras, presentación, unidad base y códigos por proveedor.
- Gramos, kilos, mililitros, litros y unidades; equivalencias explícitas de cajas y envases. No convertir masa en volumen sin equivalencia aprobada.
- Insumos, helados por sabor, postres terminados, café, leches, toppings, envases y consumibles.
- Confirmar qué se elabora y qué se compra terminado antes de implementar descuentos por recetas.
- Diferenciar «me quedan 5» de «necesito comprar 5». Registrar conteos, entradas y salidas como movimientos trazables.
- Producción consume ingredientes y genera producto terminado. La venta de ese producto no vuelve a descontar ingredientes. Bebidas al momento pueden aplicar su receta en la venta.
- Mermas, cortesías, devoluciones, rendimientos, lotes y vencimientos cuando correspondan. Plazos de conservación definidos por el negocio, no por IA.
- Reposición considerando stock utilizable, objetivo, reservas si existen y pedidos pendientes vigentes. Redondear por presentación; respetar mínimos, presupuesto y almacenamiento.
- Euros, precisión decimal para dinero, impuestos configurables, envío y fecha de actualización de precios. No asumir que un precio guardado sigue vigente.

## Compras

Separar carrito por proveedor. Mostrar cantidades, presentaciones, importe conocido, gastos pendientes y canal de envío. «Comprar» autoriza la versión visible de los pedidos; registrar esa autorización.

Sin conexión, guardar como pendiente de envío. Al reconectar, verificar vigencia, condiciones y autorización. Si hay cambios fuera de los límites aprobados, solicitar revisión. Si se desconoce si el proveedor recibió el pedido, comprobar antes de reenviar.

Separar estado de envío, estado comercial y recepción: un mensaje entregado no confirma la compra y una compra confirmada no aumenta stock. Admitir confirmación y recepción parciales. No introducir pagos automáticos en la primera versión; requieren alcance y autorización propios.

Usar integraciones oficiales cuando existan. Investigar Makro España y cada proveedor real; no inventar APIs ni afirmar que una automatización funciona sin probarla. Para páginas sin integración, implementar compra asistida o automatización permitida, con detección de cambios y detención ante CAPTCHA o autenticación adicional.

## Mensajes de proveedores: comportamiento central

Flujo: evento entrante → almacenamiento del original → eliminación de duplicados → identificación del proveedor → asociación con pedido → interpretación local → validación → actualización permitida → aviso en la app.

- Conectar únicamente canales y cuentas autorizados. La instalación por sí sola no concede acceso a WhatsApp: ofrecer un asistente de conexión dentro de la app.
- Registrar identificador del mensaje, canal, remitente, fecha original, fecha de recepción, texto, adjuntos y estados.
- Conservar siempre los mensajes recibidos por el canal conectado en su conversación; extraer datos operativos solo cuando sean relevantes. Nunca eliminar un mensaje porque el modelo lo considere irrelevante.
- Distinguir relevancia de urgencia. Un horario de entrega puede ser relevante y normal; una cancelación de un pedido activo puede ser importante.
- Categorías iniciales: confirmación, cambio de cantidad/precio, falta de producto, sustitución, fecha de entrega, documento, consulta, promoción y no identificado.
- Mostrar aviso discreto de nuevo mensaje y contador. Destacar los importantes con motivo y acción sugerida. Agrupar promociones según preferencias, sin perderlas.
- Permitir «marcar importante», «no es importante», corregir asociación y cambiar reglas por proveedor. Lo incierto queda para revisión.
- Si hay varios pedidos posibles, no adivinar. Una interpretación no puede aceptar gastos o sustituciones fuera de lo autorizado.
- Registrar hechos claros de forma automática cuando una regla validada lo permita, conservando evidencia e historial reversible. Actualizar stock solo mediante recepción.
- No responder a proveedores automáticamente por el solo hecho de recibir un mensaje. Cualquier respuesta automática requiere regla explícita configurada por el usuario.
- Tratar texto y adjuntos como datos externos: nunca como instrucciones capaces de cambiar permisos o ejecutar herramientas.

## Recepción conectada y funcionamiento offline

La IA local y la mensajería externa son capas diferentes. Webhooks requieren un punto accesible desde internet; no asumir que un portátil detrás de un router puede recibirlos directamente.

Diseñá y validá una opción de conector o intermediario mínimo que reciba eventos, los conserve temporalmente y los entregue de forma autenticada a la app. Si es necesario, explicar coste, datos transmitidos, retención y eliminación. No usarlo para inferencia de IA. Para una instalación sin intermediario, documentar qué puede recibir realmente el canal y qué limitaciones quedan.

Si el ordenador está apagado, suspendido o sin conexión, no puede procesar ni avisar en ese momento. Recuperar mensajes pendientes cuando vuelva a estar disponible mediante un mecanismo comprobado del conector. Definir retención y recuperación de interrupciones prolongadas. No prometer recepción continua o histórica que la API no permita.

## IA, imágenes y memoria

Priorizar códigos, búsquedas, reglas y OCR local antes de modelos generativos. Elegir motor/modelo por mediciones de precisión, tiempo, memoria, licencia y soporte real en ambos sistemas.

Procesar imágenes por demanda; no mantener un modelo grande residente. Permitir cancelar y ver progreso. Ante fallo, conservar datos y ofrecer carga manual.

Antes de aplicar una foto, elegir: conteo, entrada, faltantes o documento informativo. Mostrar original y extracción lado a lado. No contar existencias ocultas ni duplicar movimientos por repetir una foto o albarán.

Guardar equivalencias por proveedor, correcciones aprobadas, preferencias y reglas con origen y versión. Consultar esa memoria al interpretar. Conversar no entrena automáticamente el modelo. No incluir entrenamiento de modelos en el alcance inicial.

## Distribución, datos y seguridad

- Instalación gráfica, desinstalación clara y actualizaciones verificadas; evaluar firma y notarización para distribución Mac y firma en Windows.
- Credenciales en el almacén seguro del sistema; no incluir secretos compartidos en instaladores.
- Motor local accesible solo por la app o por interfaz local protegida. No abrir un servicio a la red sin necesidad.
- Copias consistentes de base de datos y adjuntos; prueba de restauración y migraciones con copia previa.
- Empezar con una instalación autónoma. Instalar en otro ordenador crea otra instancia, no sincroniza mágicamente el negocio.
- La sincronización posterior necesita identidad de negocio, permisos, resolución de conflictos y ejecución única de pedidos. No sincronizar el archivo de base de datos abierto mediante carpetas compartidas.
- No permitir que dos equipos envíen el mismo pedido. Los conteos absolutos simultáneos requieren resolución explícita.

## Método de trabajo y pruebas

Antes de cada etapa: especificar problema, alcance mínimo, criterios de aceptación y prueba prevista. Investigar únicamente incertidumbres que condicionen la implementación. Elegir una arquitectura sencilla; evitar microservicios o abstracciones sin necesidad demostrada.

Después de cada cambio: ejecutar las comprobaciones pertinentes. Usar pruebas de reglas para cantidades y dinero, integración para datos y colas, y pruebas de interfaz para flujos principales. Un cambio visual necesita revisión visual; no exige una batería artificial de tests unitarios.

Probar instalación en máquina limpia, arranque sin internet, modelo ausente o fallando, disco/permiso insuficiente, reinicio durante operaciones, doble clic en Comprar, mensajes duplicados o fuera de orden y recuperación de copias. Las compras reales de prueba requieren autorización concreta; usar simulación claramente identificada antes.

No continuar construyendo sobre un flujo principal roto. Al entregar, informar qué funciona, qué se probó, qué quedó simulado y qué no pudo verificarse. Actualizar TODO.md con evidencia, sin marcar tareas completas por haber escrito código.

## Primer encargo

Leer todos los documentos. Confirmar solo los datos que bloquean la primera etapa. Presentar una decisión de arquitectura breve y construir una primera sección funcional: producto → conteo → faltante → carrito → pedido simulado → recepción parcial → stock. Probarla offline. No conectar compras reales todavía.
