# TODO — estado del prototipo

La especificación completa permanece en docs/TODO.md. Este archivo indica el estado real de 0.11.0.

## Entregado y comprobado

- [x] Código, dependencias, documentos y ejecutable dentro de D:/APPGELATOSTOCK.
- [x] Ventana de escritorio Windows con componentes incluidos.
- [x] Inventario, conteo, búsqueda, categorías y alta de producto.
- [x] Carrito, propuesta de reposición y pedidos por proveedor.
- [x] Envío simulado y recepción parcial con conversión de presentaciones.
- [x] Mensajes de demostración, prioridades, revisión y asociación de pedido.
- [x] Persistencia local y copias/restauración validadas por pruebas.
- [x] Archivo manual de imágenes con proveedor, fecha y reclasificación.
- [x] Carpetas automáticas y fichas/datos por proveedor; recuperación de archivo derivado.
- [ ] Abrir carpetas desde la app e importar otros tipos de documento.
- [x] Limpieza periódica configurable de actividad y conversaciones; retención de copias automáticas.
- [x] Recetario protegido con contraseña local (pantalla y acciones; no cifra el disco).
- [x] Historial de actividad separado de los informes de desarrollo.
- [x] Pruebas de dominio y servidor; prueba del ejecutable con reinicio.
- [x] Revisión visual de resumen, compras y mensajes.
- [x] Instrucciones de continuidad y reportes por sesión.

## Antes de usar como sistema real

- [ ] Confirmar productos, proveedores, recetas, unidades y sistema de ventas reales.
- [ ] Revisar arquitectura completa con Claude (pendiente core/, servidor y WhatsApp).
- [x] Auditoría 0.8.1 de la entrega 0.8.0: parche/commit, pruebas, código de IA y documentos de continuidad.
- [x] Migrar JSON a SQLite con adjuntos separados, operaciones transaccionales y migración probada.
- [x] Editar productos y proveedores; entradas/salidas/mermas y ajustes con motivos y reversión explícita (unidad base protegida).
- [x] Cancelar pedidos pendientes sin alterar stock.
- [x] Núcleo TypeScript estricto, validación de contratos y 102 pruebas automatizadas.
- [x] Prueba automática de corte brusco del proceso con base íntegra (tests/store.test.cjs).
- [ ] Prueba de disco lleno y validación del corte en el equipo real.
- [ ] Autenticación y permisos por persona si la app la usan varias personas (hoy: una contraseña opcional para el recetario).
- [ ] Mejorar accesibilidad con auditoría de contraste, teclado y pruebas con usuarios.
- [ ] Empaquetar, firmar y probar en el Mac real del usuario (modelo y RAM por confirmar).
- [ ] Firmar la distribución Windows y crear instaladores/actualizaciones seguras.

## Funciones siguientes

- [x] OCR local español en fotos para proponer proveedor y conservar texto.
- [x] Identificación común por nombre/alias, NIF y teléfono; propuesta en mensaje de prueba.
- [ ] Lectura de PDF, cantidades y fecha del documento con revisión de extracción.
- [ ] Evaluar OCR con facturas reales autorizadas y hardware Mac.
- [x] Modelo Qwen3 0.6B Q4 incluido y gestionado dentro de la app Windows; lecturas revisables.
- [ ] Medir consumo y calidad en 8 GB/Mac real y con documentos autorizados representativos.
- [x] Control de entregas con cantidades por línea, entregas abiertas/cerradas y recepción guiada.
- [x] Texto original mostrado sin explicaciones inventadas, límites de entrada/salida, cancelación y endpoints autenticados para IA.
- [x] Doble lectura con abstención, contraste de encabezados y comprobación limitada de importes en céntimos.
- [x] Resultado anterior retirado al cambiar texto o modo.
- [ ] Reducir abstenciones legítimas: proforma de prueba discrepó entre lecturas; conservar revisión hasta validar mejoras. 0.8.1 reconoce etiquetas IVA 21%/Total a pagar en la suma; falta corpus real.
- [x] Prompt maestro v2 y directriz de mejora continua para cualquier IA que continúe.
- [x] Chat de dudas local con guía fija y texto del editor; sin acceso a datos ni acciones.
- [x] Línea base de clasificación con 11 casos sintéticos (10/11, sin errores aceptados); repetirla ante cualquier cambio de prompt o modelo.
- [x] Comparativa de modelos para respuestas de proveedor (0.6B Q4 55/80, 1.7B Q8 36/80 frente a reglas 80/80): reglas como lectura principal; no cambiar de modelo sin repetir reports/ai-replies-exp-*.
- [ ] Evaluar el chat con preguntas reales del usuario; medir respuestas incorrectas o inventadas y ajustar la guía.
- [ ] Chat con contexto de inventario/pedidos: solo tras definir qué datos se exponen y con pruebas de fuga.
- [ ] Sandbox real del trabajador de IA: hoy solo se desactivan módulos de red de Node, no el proceso nativo.
- [ ] Evaluación independiente de razonamiento/precisión con corpus real autorizado; no inferir certeza de la coincidencia.
- [ ] Memoria de equivalencias y correcciones aprobadas.
- [x] Diseño de WhatsApp con chats autorizados: docs/WHATSAPP_PROVEEDORES.md.
- [x] Usuario elige prueba QR para WhatsApp normal/Business, con cambio de sesión.
- [x] QR experimental, cuentas separadas, permisos por cuenta e historial de cambio de número.
- [x] Copia de WhatsApp sin credenciales.
- [x] Vinculación por QR y cambio de número validados por el usuario con dos números propios (2026-09-08).
- [x] Envío real de pedidos por WhatsApp con vista previa, confirmación y un envío por pedido; probado con cliente simulado.
- [x] Envío y recepción reales comprobados con los dos números del usuario (2026-09-08 23:24–23:25): mensaje entregado y «Ok» importado.
- [x] Respuestas de WhatsApp en la bandeja principal, vinculadas al pedido enviado a ese número (si es único) y entrega prevista en el pedido.
- [x] Copia automática diaria con retención; errores no controlados registrados en archivo.
- [x] Tipo de documento confirmado por la persona en cada foto (memoria de decisiones).
- [ ] Memoria de equivalencias por proveedor (código de albarán → producto) consultada al leer documentos.
- [x] Implementar recepción experimental de WhatsApp por eventos; QR real verificado. Envío añadido en 0.9.1 con confirmación explícita.
- [x] Recuperación del historial reciente de chats autorizados al conectar y a demanda (solo texto); reconexión automática.
- [ ] Recuperar adjuntos del historial y mensajes más antiguos que los cargados por WhatsApp Web.
- [x] Mensajes llegados con la app cerrada: se recuperan del historial reciente al conectar (verificado con la sesión real).
- [x] Reglas de relevancia por referencia exacta del mismo proveedor, independientes de prioridad; correcciones con motivo.
- [x] Buscar mensajes sin tildes y filtrar por proveedor/estado.
- [ ] Validar clasificación con mensajes reales anonimizados y contexto lingüístico más amplio.
- [x] Notificaciones nativas de Windows al recibir un WhatsApp autorizado; conexión automática al abrir opcional.
- [ ] Notificaciones para mensajes de demostración y para entregas previstas; opción de silenciarlas.
- [ ] Integración comprobada con Makro España u otro proveedor real.
- [x] Recetas y producción con consumo estimado aprobado por la persona, producto terminado y hoja diaria (docs/PRODUCCION_Y_RECETAS.md).
- [x] Ventas y mermas diarias de producto terminado (Producción → Ventas y mermas del día).
- [ ] Lotes y vencimientos; rendimientos por receta.
- [x] Lectura por reglas de respuestas de proveedores (categoría, fecha resuelta, qué leer) y segunda lectura opcional con IA que solo anota.
- [ ] Lectura automática de respuestas de WhatsApp importadas y aviso al recibirlas; hoy las reglas se aplican a los mensajes de la bandeja.
- [ ] Validar categorías y fechas con respuestas reales de proveedores (corpus sintético de 80 mensajes ya en pruebas; estimación de generalización 75 % con el resto marcado para leer); ampliar horas y tramos.
- [ ] Sincronización entre lugares con resolución de conflictos y único envío por pedido.

## Límites conocidos

Una instancia de escritorio por perfil. SQLite detecta conflictos entre conexiones; no hay sincronización distribuida. Exportación JSON en memoria hasta 100 MB; fotos hasta 5 MB. Falta paginar el estado y probar gran volumen. Sin pagos ni sincronización; WhatsApp Web experimental requiere internet. El clasificador por palabras puede equivocarse: las etiquetas son revisables y no ejecutan compras. Las fotos no cambian stock.
