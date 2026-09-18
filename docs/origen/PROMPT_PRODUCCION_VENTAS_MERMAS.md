# Prompt maestro del usuario · producción, ventas, mermas y caja (2026-09-18)

Texto íntegro del documento Word del usuario, archivado como origen. El resumen operativo, las decisiones y las fases están en docs/PLAN_PRODUCCION_VENTAS_CAJA.md: lee aquel, no este.

```text
PROMPT MAESTRO
DEFINITIVO
Evolución inteligente de una app sólida de stock, producción, ventas, mermas y caja
Diseñado para que una IA de desarrollo audite primero la aplicación existente, preserve su identidad y arquitectura útil, recomiende qué mantener/mejorar/añadir/posponer y luego implemente únicamente cambios de alto valor con trazabilidad y pruebas.
Enfoque
Evolución, no reconstrucción
Prioridad
Integridad de datos + simplicidad de uso
Regla central
La app piensa; el usuario registra hechos simples
Versión definitiva — lista para copiar y entregar al agente que trabaja directamente sobre el repositorio.

Cómo usar este documento
Copia desde “INICIO DEL PROMPT” hasta “FIN DEL PROMPT” y entrégalo al agente de IA que tenga acceso al código de tu aplicación. El prompt está escrito para una app ya madura: obliga al agente a estudiar el producto antes de modificarlo, preservar su identidad y evitar una reconstrucción innecesaria.
Punto clave añadido
Producción y mermas del día deben poder editarse, corregirse o eliminarse desde una UX simple. Cada cambio debe recalcular automáticamente stock, venta esperada, costos, cierres y reportes. La interfaz puede decir “Eliminar”, pero internamente los movimientos críticos deben conservar trazabilidad mediante cancelación/soft-delete/auditoría en lugar de desaparecer sin rastro.

El documento también distingue costo productivo, valor comercial, venta esperada, venta real, caja esperada y caja real. Esto evita uno de los errores más peligrosos en este tipo de sistemas: mezclar dinero que cuesta producir con dinero que debería facturarse.

INICIO DEL PROMPT
0. Rol y contexto obligatorio
Actúa como un equipo senior integrado por Product Manager, UX/UI Designer, Software Architect, Backend Engineer, Frontend Engineer, Database Engineer, especialista en POS/ERP e inventarios, especialista en costos/operaciones gastronómicas, QA Engineer y especialista en migraciones y consistencia de datos.
Estás trabajando sobre una aplicación YA CONSTRUIDA, sólida, avanzada y con identidad propia. NO partes de cero. Tu primera responsabilidad es entenderla. No asumas que tus ideas son mejores por ser nuevas. La solución correcta debe surgir de comparar lo que ya existe con lo que realmente falta.
MANDATO PRINCIPAL
EVOLUCIONA LA APP SIN BORRAR SU IDENTIDAD. Conserva su diseño, lenguaje, navegación, patrones, arquitectura y flujos que ya sean buenos. No la conviertas en un dashboard genérico ni en un ERP pesado solo porque técnicamente podrías hacerlo.

1. Regla de oro: primero auditar, después decidir, después implementar
ANTES DE MODIFICAR CÓDIGO, realiza una auditoría profunda del proyecto completo. Lee el repositorio, no solo los archivos obvios. Reconstruye cómo funciona realmente la aplicación en producción y cómo se relacionan sus módulos.
Arquitectura general y stack.
Frontend, componentes, layouts, navegación, diseño responsive y sistema visual.
Backend, servicios, controladores, reglas de negocio y validaciones.
Base de datos, modelos, relaciones, migraciones, índices, constraints y datos históricos.
Autenticación, usuarios, roles y permisos.
Módulos de stock, producción, productos, recetas, costos, ventas, mermas, caja, reportes, configuración y cualquier otro módulo existente.
APIs, DTOs/schemas, hooks, state management, caché, eventos y jobs.
Pruebas existentes, convenciones, logging, auditoría y manejo de errores.
Terminología que ya utiliza la app y mental model actual de sus usuarios.
Paleta, tipografía, iconografía, componentes, densidad visual y patrones de interacción que definen la identidad del producto.
1.1 Informe de decisión obligatorio antes de la implementación
Después de estudiar la aplicación, genera un diagnóstico breve pero profundo y clasifica cada hallazgo en estas categorías:
MANTENER — ya está bien resuelto y cambiarlo aportaría poco o dañaría identidad/estabilidad.
MEJORAR — la idea actual es correcta pero UX, lógica, consistencia o implementación pueden evolucionar.
AÑADIR — falta una capacidad de alto valor y encaja naturalmente con la app.
INTEGRAR — hay dos capacidades existentes que conviene conectar en lugar de crear un módulo paralelo.
POSPONER — es útil, pero no debe entrar todavía por dependencia, riesgo o baja prioridad.
NO AÑADIR — crearía complejidad, duplicaría funciones, dañaría la identidad o no resuelve un problema real.
DEPRECAR/RETIRAR — solo si existe algo redundante o incorrecto; nunca eliminarlo sin verificar impacto y migración.
Para cada decisión importante explica: qué existe hoy, cuál es el problema u oportunidad, qué recomiendas, qué impacto tendrá, riesgo técnico y por qué conviene mantener/mejorar/añadir/no añadir. Luego define “QUÉ VAMOS A HACER” y continúa con la implementación de los cambios de mayor valor que sean seguros. No pidas confirmación para decisiones técnicas normales que puedes resolver inspeccionando el proyecto.
1.2 Prohibición de rediseño gratuito
No reemplaces componentes sólidos solo por preferencias personales.
No cambies librerías o framework sin una razón técnica fuerte.
No renombres conceptos que los usuarios ya conocen salvo que sean confusos o incorrectos.
No modifiques colores, branding, layout o navegación global si no mejora claramente el producto.
No crees pantallas duplicadas cuando una existente puede evolucionarse.
No conviertas la aplicación en otro producto.
No uses “modernización” como excusa para rehacer todo.
2. Objetivo de negocio y modelo mental del sistema
La evolución debe conectar de forma clara y automática el ciclo operativo completo:
STOCK INICIAL → PRODUCCIÓN → STOCK VENDIBLE → VENTAS / MERMAS / CORTESÍAS / CONSUMO / TRANSFERENCIAS → STOCK FINAL → VENTA ESPERADA → VENTA REAL → CAJA ESPERADA → CAJA REAL → DIFERENCIAS → CIERRE.
La aplicación debe responder sin cálculos manuales: cuánto se produjo; cuánto costó; cuánto representa comercialmente; cuánto se vendió; cuánto se desperdició; cuánto se regaló; cuánto se consumió internamente; cuánto se reserva; cuánto queda; cuánto debería facturarse; cuánto se facturó; cuánto efectivo debería existir; cuánto se declaró; y qué diferencia queda sin justificar.
3. Principios de diseño del producto
Complejidad interna, simplicidad externa. El sistema puede tener reglas avanzadas, pero el empleado debe registrar hechos simples.
Una fuente de verdad. Stock, costo, venta esperada y cierre no pueden calcularse de formas diferentes según la pantalla.
Movimientos trazables. Los cambios de inventario deben ser explicables.
Correcciones sin miedo. Equivocarse al cargar un peso no debe obligar a “arreglar” números manualmente.
No ocultar diferencias. Si existe una diferencia real, mostrarla y permitir clasificarla; no convertirla silenciosamente en merma.
No mezclar conceptos económicos. Costo, valor comercial, facturación y caja son métricas distintas.
Preservar identidad. Toda mejora visual debe sentirse como una versión mejor de esta misma app.
Progressive disclosure. Mostrar primero lo importante; los detalles avanzados solo al pedirlos.
4. Distinciones económicas obligatorias
NO mezcles estas magnitudes:
Costo de producción.
Costo por unidad de medida.
Valor comercial potencial del stock.
Venta teórica/esperada.
Venta real registrada.
Ingresos por medio de pago.
Caja física esperada.
Caja física real.
Costo de merma.
Valor comercial perdido por merma.
Stock transferido al siguiente día.
Diferencia de inventario no clasificada.
Ejemplo conceptual
Si producir 1.000 g cuesta €100 y esos 1.000 g se venden por €1.000, una merma real de 200 g implica €20 de costo productivo perdido y €200 de valor comercial perdido. Son dos métricas distintas y ambas pueden ser útiles.

5. Fórmula operativa correcta y conciliación por cantidad
El sistema debe poder conciliar cantidades físicas. Como base conceptual:
STOCK VENDIBLE DISPONIBLE = stock inicial vendible + producción liberada + transferencias entrantes + recuperaciones/reutilizaciones válidas.
SALIDAS NO VENTA = merma real + cortesías + consumo interno + transferencias salientes + descartes/ajustes clasificados.
CANTIDAD VENDIDA TEÓRICA = stock vendible disponible − salidas no venta − stock final vendible/reservado.
VENTA ESPERADA = suma del valor comercial histórico aplicable a la cantidad vendida teórica, respetando precios, presentaciones y reglas reales del negocio.
Si la app ya registra cada venta con cantidad/ítems, utiliza esos datos como fuente principal y usa la conciliación de inventario como control. Si NO registra cantidades exactas vendidas, la conciliación física puede utilizarse para estimar venta esperada. Decide cuál modelo corresponde tras auditar el producto actual; no implementes una fórmula ciega que duplique o contradiga el POS existente.
6. Producción: evolución del módulo
Analiza primero qué guarda hoy el módulo de Producción y mejora únicamente lo necesario. Como capacidades objetivo, la producción debe poder representar: fecha operativa, hora, producto, cantidad/peso, unidad, lote si aplica, responsable, costo histórico, valor comercial, estado, notas y relación con stock.
La carga debe ser rápida: producto + peso/cantidad + unidad; el resto debe autocompletarse cuando sea seguro.
Generar lote automáticamente si el negocio realmente lo necesita.
Normalizar unidades internamente sin obligar al usuario a pensar en conversiones.
Al confirmar producción, crear los movimientos de stock necesarios de manera atómica.
Si existen recetas/ingredientes, integrar descuento de materia prima solo si ya encaja con la arquitectura y aporta valor real.
Conservar snapshots históricos de costo/precio relevantes para que cambiar un precio mañana no reescriba el pasado.
7. Edición, corrección y eliminación de PRODUCCIÓN — requisito prioritario
El usuario debe poder corregir errores de carga sin romper el sistema. Producciones del día operativo ABIERTO deben mostrar acciones claras como “Editar” y “Eliminar/Anular”, sujetas a permisos razonables.
7.1 Editar producción del día
Al editar producto, peso, cantidad, unidad u otro dato que afecte cálculos, NO ajustes solo la fila visual. Debes recalcular de forma transaccional todo lo derivado que dependa de ese registro: stock, costo, valor comercial, recomendaciones de producción, ventas esperadas, diferencias, reportes y cualquier cierre preliminar.
Mostrar valor anterior y nuevo si la corrección es sensible.
Guardar quién editó, cuándo y motivo opcional/obligatorio según impacto.
Prevenir correcciones que generen stock imposible o conflictos con movimientos posteriores; en ese caso explicar qué está bloqueando el cambio y ofrecer la vía correcta.
Si una producción ya fue parcialmente consumida/vendida/transferida y el cambio de cantidad la dejaría por debajo de lo ya utilizado, no permitir una corrupción silenciosa. Proponer corrección/ajuste compatible.
Actualizar en tiempo real los resúmenes del día después de guardar.
7.2 Eliminar producción del día
La interfaz PUEDE ofrecer “Eliminar” porque es el lenguaje más intuitivo. Técnicamente, para movimientos con impacto de inventario/finanzas, prioriza anulación, soft-delete o evento reverso trazable en vez de hard-delete. El usuario no necesita ver esa complejidad.
Durante día abierto: permitir anular/eliminar si no crea inconsistencias.
Revertir automáticamente el movimiento de stock y todos los cálculos derivados.
Si existen movimientos dependientes, impedir el borrado destructivo y explicar qué debe corregirse primero o ejecutar una corrección segura.
Mantener registro de auditoría del dato original y de la anulación.
No mostrar registros anulados en vistas operativas normales, salvo filtro “Mostrar anulados”.
7.3 Día cerrado
Una vez cerrado el día, no permitas modificar silenciosamente el pasado. Según la arquitectura actual, utiliza una de estas estrategias: reapertura controlada por rol autorizado, corrección posterior mediante ajuste/reversión, o flujo de rectificación. Elige la opción más coherente con la app actual. En todos los casos debe quedar trazabilidad y el cierre/reporte debe recalcularse de forma determinista.
8. Mermas: convertirlas en un flujo realmente útil
Revisa el módulo actual de mermas. La carga debe ser extremadamente rápida y orientada a balanza. Idealmente el usuario selecciona producto, escribe el peso observado y elige qué pasó con ese producto.
Formulario recomendado — adaptar al diseño real de la app, no copiar ciegamente: Producto; Peso; Unidad; Qué ocurrió/Destino; Motivo cuando corresponda; Responsable autocompletado; Nota opcional; Registrar.
8.1 Clasificación semántica correcta
Merma real — producto que ya no puede venderse/reutilizarse: caída, contaminación, textura incorrecta, vencimiento, derretido, error de proceso, etc.
Reutilización / reserva — producto válido que se utilizará mañana o más adelante. NO es pérdida definitiva.
Cortesía / regalo — reduce stock y venta esperada, pero debe reportarse separado de merma técnica.
Degustación — salida identificada; puede agruparse o separarse según el negocio actual.
Consumo interno — reduce stock y venta esperada, con motivo/responsable si corresponde.
Transferencia — movimiento entre día/sucursal/área; no es pérdida.
Ajuste de inventario — para diferencias excepcionales y con auditoría.
8.2 Destinos configurables
Permite opciones configurables como: descartado, reutilizar mañana, reutilizar más adelante, regalado, degustación, consumo del personal, cortesía, transferido, otro. No hardcodees más categorías de las necesarias si la app ya dispone de una configuración equivalente.
9. Edición, corrección y eliminación de MERMAS — requisito prioritario
Una merma mal pesada o mal clasificada debe poder corregirse fácilmente durante el día. Cada registro del día abierto debe ofrecer “Editar” y “Eliminar/Anular” según permisos.
9.1 Editar merma
Permitir corregir producto, peso, unidad, motivo, destino, nota y responsable cuando el rol lo permita.
Al guardar, recalcular automáticamente stock, costo de merma, valor comercial perdido, venta esperada, KPI de merma, stock reservado, recomendaciones y conciliación diaria.
Si cambia de “Descartado” a “Reutilizar mañana”, devolver esa cantidad al flujo de stock reutilizable y eliminar su impacto como pérdida definitiva.
Si cambia de “Reutilizar mañana” a “Descartado”, retirar ese stock futuro y convertirlo en pérdida real.
Si cambia a “Cortesía” o “Consumo”, reclasificar el impacto sin duplicar la salida.
Registrar historial de antes/después.
9.2 Eliminar merma
Permitir una acción de usuario simple “Eliminar”.
Revertir la salida de inventario o transferencia relacionada.
Eliminar su impacto de costos/KPI/venta esperada/cierre.
Mantener un registro técnico trazable de la anulación si el movimiento ya impactó inventario o métricas.
Evitar hard-delete de evidencia crítica cuando exista cierre, auditoría o dependencia posterior.
9.3 UX de corrección
La persona no debe tener miedo de corregir un error. Tras una modificación, mostrar feedback humano, por ejemplo: “Merma actualizada: Chocolate 180 g. Stock disponible: 2,32 kg. Venta esperada recalculada: €X.” Evitar mensajes técnicos como “transaction updated”.
10. Transferencia automática al día siguiente y stock reutilizable
Si un sobrante se marca como válido para mañana, NO lo contabilices como merma. Debe convertirse en stock inicial/reutilizable del siguiente día operativo, conservando origen y trazabilidad.
Producto, cantidad, unidad y lote/origen si aplica.
Fecha de origen y fecha prevista de uso.
Estado: disponible, utilizado, descartado, vencido, transferido.
Fecha máxima de uso solo si el negocio la requiere y existe una regla fiable.
No obligar al empleado a volver a cargarlo manualmente al día siguiente.
Si el registro original se edita o elimina, actualizar/revertir automáticamente la reserva futura.
11. Stock de producción, mínimo, ideal y recomendación
Revisa qué sistema de stock ya existe y evita crear dos inventarios paralelos. Si la app distingue materia prima de producto terminado, respeta esa separación. El objetivo es que cada producto terminado pueda mostrar disponible, reservado, mínimo, ideal, máximo opcional y estado.
La recomendación inicial de producción debe basarse en reglas explicables: stock actual + reservas/reutilizables + stock mínimo/ideal + demanda reciente + producción ya planificada. No introduzcas IA predictiva antes de tener datos fiables.
Ejemplo de UX: “Chocolate — disponible 1,3 kg — mínimo 2 kg — recomendado producir 2,7 kg para alcanzar stock ideal”.
12. Ventas: esperado vs real sin confundir conceptos
Mejora el módulo de Ventas solo después de entender cómo registra hoy la facturación. Queremos que el encargado vea rápidamente: venta esperada, venta real y diferencia; pero la forma de calcular venta esperada debe ser coherente con el modelo real de la app.
Si ventas registra ítems/cantidades: comparar venta real con conciliación de stock y detectar diferencias.
Si ventas solo registra importes: estimar venta esperada desde el flujo físico y el precio histórico aplicable.
Si hay múltiples presentaciones/precios/promociones, no uses un único precio promedio sin justificarlo.
No considerar como venta faltante el stock válido que quedó para mañana.
Restar correctamente merma real, cortesía y consumo del universo vendible, mostrándolos por separado.
12.1 Desglose explicable
Una diferencia debe poder abrirse y explicarse con un “waterfall” simple: valor vendible inicial + producción + entradas − merma − cortesías − consumo − transferencias/reservas − stock final = venta esperada. Luego venta real registrada y diferencia.
13. Caja: separarla completamente de ventas
Venta total no equivale a efectivo físico. Mantén separadas facturación e ingresos por método de pago. La caja esperada en efectivo debe considerar únicamente efectivo y movimientos de caja aplicables.
Efectivo.
Tarjeta.
Transferencia.
Wallets/medios configurables.
Otros métodos.
Ingresos y egresos de caja si el sistema ya los maneja.
Al cierre mostrar: ventas totales, distribución por medio de pago, efectivo esperado, efectivo contado, diferencia y motivo/ajuste si corresponde.
14. Cierre diario / día operativo
El cierre debe ser uno de los puntos más claros del producto. Antes de cerrar, el encargado debe poder comprender en una pantalla qué ocurrió.
Stock inicial.
Producción.
Ventas.
Merma real.
Cortesías/regalos.
Consumo interno.
Transferencias.
Stock reutilizable/reservado.
Stock final teórico.
Stock final real si se realiza conteo/pesaje.
Diferencia de inventario.
Venta esperada.
Venta real.
Diferencia.
Caja esperada.
Caja real.
Diferencia de caja.
Una vez confirmado el cierre, generar un snapshot coherente. Si después hay una rectificación autorizada, actualizar mediante el mecanismo de reapertura/ajuste decidido durante la auditoría, nunca editando el pasado silenciosamente.
15. Stock teórico vs stock real
Distingue siempre stock teórico de stock real. Si el sistema calcula 1.850 g pero la balanza indica 1.720 g, la diferencia es −130 g de inventario. No convertirla automáticamente en merma. Permite investigarla y luego clasificarla si se determina la causa.
Las tolerancias de diferencia deben ser configurables, no mágicas. Si el producto actual no necesita tolerancias porcentuales, no agregues una configuración que nadie utilizará.
16. Inventario basado en movimientos y trazabilidad
Si la arquitectura actual lo permite, prioriza un ledger de movimientos como fuente explicable de stock. No impongas una migración masiva si la app ya tiene un modelo equivalente y confiable.
Conceptualmente: + producción, + entrada, − venta, − merma, − cortesía, − consumo, ± transferencia, ± ajuste. El stock disponible es el resultado de movimientos válidos, no un número sobrescrito sin historia.
Cada movimiento relevante debe registrar referencia de origen, usuario, fecha/hora, cantidad/unidad, tipo, motivo y estado/cancelación cuando corresponda.
17. Política definitiva de editar, borrar, anular y auditar
OBJETIVO UX
El usuario debe poder editar o borrar un error de manera natural. La robustez técnica no debe convertir la corrección en un proceso burocrático.

Define una política coherente con la aplicación existente:
Día abierto + registro sin dependencias complejas: editar directamente y recalcular; eliminar desde UI y revertir efectos.
Día abierto + registro con dependencias: permitir corrección segura, validando que no cree stock negativo o referencias imposibles.
Día cerrado: corrección controlada mediante reapertura o ajuste/reversión, según el diseño actual y permisos.
Auditoría: guardar antes/después, usuario, timestamp y motivo cuando el impacto lo justifique.
Vistas normales: ocultar anulados para no ensuciar la operación; permitir verlos desde historial/auditoría.
Hard delete: reservarlo para datos sin impacto o registros verdaderamente huérfanos si la arquitectura lo permite. No usarlo para borrar evidencia financiera/inventario consolidado.
Después de editar/anular cualquier producción o merma, ejecutar una única rutina central de recomputación/reconciliación del día o un mecanismo incremental equivalente probado. No dupliques fórmulas en UI, endpoint y reporte.
18. Integridad transaccional y consistencia
Registrar producción/merma/venta y su movimiento de inventario en una transacción atómica.
Si falla un paso crítico, rollback.
Evitar stock negativo accidental y race conditions.
Considerar edición simultánea por dos usuarios.
Usar optimistic/pessimistic locking o constraints solo donde el stack y volumen lo justifiquen.
Backend como autoridad final; frontend puede validar para UX, pero no reemplaza validación servidor.
Idempotencia donde existan reintentos de red o acciones críticas.
No usar floats inseguros para dinero; usar decimal/numeric o el patrón correcto del stack.
Normalizar unidad base por categoría y mantener conversiones fiables.
19. UX/UI: mejorar sin perder identidad
Antes de tocar diseño, identifica explícitamente la identidad visual actual: paleta, bordes, radios, sombras, densidad, tipografía, iconos, botones, cards, tablas, sidebar/navbar, formularios, tono de mensajes, nombres de módulos y comportamiento responsive.
Crea un pequeño “contrato de identidad” interno y usa ese contrato como restricción de diseño. Toda mejora debe parecer una evolución natural de la app actual.
Reutilizar componentes y design tokens existentes.
Mantener navegación y jerarquía si ya son comprensibles.
Reducir clicks y campos, no añadir pantallas por deporte.
Cards para resumen; tablas para detalle; drawers/modales solo cuando aporten.
Acciones rápidas visibles: Producción, Merma, Cortesía/Salida, Transferencia, Venta según roles.
Inputs de peso optimizados para balanza: escribir 425 + g, sin obligar a 0,425 kg.
Recordar unidad frecuente por producto cuando sea seguro.
Autocompletar responsable/fecha/hora.
Estados vacíos útiles y feedback humano después de guardar.
Usar semáforos con texto/icono, no solo color.
Responsive excelente en desktop, tablet y móvil.
19.1 Jerarquía por rol
Empleado — acciones rápidas y pocos datos.
Producción — qué producir, cuánto hay, registrar producción/merma rápido.
Encargado — stock, diferencias, alertas, cierre, correcciones.
Administrador — costos, configuración, auditoría, reportes, usuarios, reglas.
No crees roles nuevos si los existentes ya cubren estos permisos; adapta las capacidades al modelo actual.
20. Dashboard
No rediseñes el dashboard si ya es fuerte. Evalúa primero qué muestra y qué falta. El objetivo es que en aproximadamente 5 segundos pueda leerse el estado del día.
Venta real hoy.
Venta esperada.
Diferencia.
Producción del día.
Merma real (cantidad + costo + valor comercial).
Stock bajo.
Stock reservado/reutilizable para mañana.
Caja esperada vs real.
Alertas de diferencias relevantes.
Evita saturación. Los detalles deben abrirse al hacer click. Prioriza lo que exige una decisión hoy.
21. Alertas y prevención de errores
No permitir merma mayor al stock disponible sin advertencia/permiso excepcional.
Advertir pesos anormalmente altos/bajos comparados con histórico, sin bloquear innecesariamente.
Advertir si editar una producción invalida ventas/movimientos posteriores.
Detectar duplicados probables por doble click/reintento.
Alertar stock por debajo del mínimo.
Alertar diferencia de inventario/caja según umbral configurable.
Evitar notificaciones irrelevantes; cada alerta debe ser accionable.
22. Historial, auditoría y reversibilidad
Debe ser posible explicar qué pasó con un producto o con un día. Para operaciones sensibles conserva: creador, fecha/hora, última edición, antes/después, anulación, motivo y referencias relacionadas.
El historial debe ser comprensible para humanos. Ejemplo: “18:42 — Chocolate — Merma corregida de 250 g a 180 g por Ana. Stock +70 g. Venta esperada +€X.”
Si la app ya tiene audit log, extiéndelo. No construyas un segundo sistema de auditoría.
23. Base de datos y modelos: adaptar, no imponer
Antes de proponer nuevas tablas, identifica modelos existentes y sus responsabilidades. Conceptos que podrían ser necesarios —solo si no existen equivalentes—: Product, ProductionBatch/Entry, InventoryMovement, WasteEntry, WasteReason/Destination, Sale/SaleItem, Payment, StockThreshold, Transfer, DailyClosing, CashClosing, AuditLog.
Estos nombres son conceptuales. NO crees todos por defecto. Reutiliza y extiende entidades actuales. Prefiere una migración incremental, reversible y testeada. Preserva datos existentes.
24. Costos, precios y snapshots históricos
Cambiar precio hoy no debe alterar ventas/reportes históricos.
Cambiar costo de receta hoy no debe recalcular producciones antiguas salvo un proceso explícito.
Guardar snapshots de costo/precio o referencias versionadas donde corresponda.
Diferenciar costo de producto terminado de valor de venta.
Si existen promociones, tamaños o canales con precios diferentes, respetarlos en la conciliación.
25. Reportes y analítica
Revisa qué reportes ya existen. Mejora antes de duplicar. Como objetivos útiles: hoy, ayer, 7 días, 30 días, mes y rango personalizado.
Producción.
Ventas.
Costos.
Margen si los datos son suficientes.
Merma real en peso, costo y valor comercial.
Merma % = merma real / producción relevante × 100, con definición consistente.
Cortesías.
Consumo interno.
Transferencias/reservas.
Diferencias de inventario.
Diferencias de caja.
Productos con mayor merma.
Motivos de merma.
Tendencias vs periodo anterior.
No mezcles regalo/consumo/reserva con KPI de merma técnica. Permite verlos juntos como “salidas no venta” si sirve, pero conserva sus categorías.
26. Recomendaciones y predicción
Primero construye datos confiables. Una recomendación de producción basada en stock mínimo/ideal y ventas recientes es suficiente al principio. Deja la arquitectura preparada para predicción de demanda/anomalías futura, pero NO añadas IA opaca sin necesidad.
27. Configuración y extensibilidad
Evita magic numbers. Cuando realmente corresponda, hacer configurables: moneda, unidades, stock mínimo/ideal, tolerancias, métodos de pago, motivos/destinos de salida, permisos, sucursales/áreas y fecha/día operativo. No conviertas todo en un setting si solo existe un valor estable.
28. Día operativo, fechas y zona horaria
No supongas que 00:00 cierra el negocio. Si la app ya tiene concepto de jornada, respétalo. Si no existe y es necesario, diseña “día operativo” de forma simple y configurable. Guarda timestamps correctamente y evita errores por timezone.
29. Multi-sucursal y futuro
No sobreingenierices para una organización enorme, pero evita decisiones que vuelvan imposible soportar sucursales, depósitos o áreas de producción después. Si el modelo actual ya incluye location/store, úsalo. Si no, no agregues una jerarquía compleja sin necesidad inmediata.
30. Rendimiento y consultas
Revisar N+1 y agregaciones pesadas.
Añadir índices basados en consultas reales, no por intuición.
No recalcular toda la historia en cada pantalla.
Elegir recomputación diaria/incremental, snapshots o materializaciones según tamaño real del sistema.
Cachear solo si existe un problema medido.
Mantener exactitud por encima de micro-optimizaciones.
31. Seguridad y permisos
Autorización en backend para editar/anular/cerrar/reabrir.
No confiar en ocultar botones.
Acciones sensibles según roles actuales.
Evitar exponer costos si ciertos roles no deben verlos.
Registrar cambios críticos.
Validar inputs y referencias para evitar manipulación de stock por parámetros alterados.
32. Flujo diario ideal — adaptar a la app existente
Inicio del día
Stock heredado/reutilizable.
Productos bajo mínimo.
Recomendación de producción.
Pendientes/alertas.
Producción
Registrar peso/cantidad rápidamente.
Actualizar stock automáticamente.
Permitir corregir/eliminar errores mientras el día está abierto.
Durante el día
Ventas.
Mermas.
Cortesías/consumo.
Transferencias.
Correcciones con recálculo automático.
Cierre
Conciliar stock.
Venta esperada vs real.
Caja esperada vs real.
Resolver/explicar diferencias.
Cerrar jornada y generar snapshot.
33. Ejemplo completo de conciliación física
Ejemplo conceptual — no hardcodear estos valores:
Stock inicial vendible: 500 g.
Producción liberada: 5.000 g.
Total disponible: 5.500 g.
Merma real: 300 g.
Cortesía: 200 g.
Consumo interno: 100 g.
Reservado para mañana: 800 g.
Stock final físico: 600 g.
Cantidad atribuible a venta = 5.500 − 300 − 200 − 100 − 800 − 600 = 3.500 g. El valor esperado de venta se calcula con la estructura histórica de precios correcta. Si ventas registradas equivalen a 3.500 g/importe esperado, la conciliación es coherente. Si no, mostrar la diferencia en vez de inventar una merma.
34. Ejemplo crítico de edición
Situación: se registró una merma de Chocolate de 250 g, pero la balanza realmente marcaba 150 g.
1.  El usuario abre la merma y pulsa Editar.
2.  Cambia 250 g → 150 g y guarda.
3.  El sistema calcula delta +100 g de stock disponible.
4.  Recalcula costo de merma y valor comercial perdido.
5.  Recalcula venta esperada del día.
6.  Actualiza KPI/reportes/dashboard.
7.  Actualiza stock reservado/recomendación si dependían de ese saldo.
8.  Guarda auditoría: valor anterior 250 g, nuevo 150 g, usuario y hora.
9.  La UI confirma de forma simple el nuevo resultado.
Ninguna pantalla puede seguir mostrando el cálculo viejo.
35. Ejemplo crítico de eliminar producción
Situación: se duplicó accidentalmente una producción de 2 kg.
1.  El usuario pulsa Eliminar/Anular en el registro duplicado.
2.  El sistema verifica si esa entrada tiene cantidades ya consumidas por movimientos dependientes.
3.  Si no existen conflictos, revierte los 2 kg del stock, anula el registro y recalcula todo el día.
4.  Si existe dependencia, impide una corrupción silenciosa y ofrece una corrección compatible o muestra qué movimiento debe revisarse.
5.  La app conserva auditoría pero la operación diaria deja de contar esa producción.
36. Pruebas obligatorias
Añade/actualiza tests alrededor de la lógica crítica. No basta con probar componentes visuales.
Producción crea stock correcto.
Editar producción recalcula stock y venta esperada.
Eliminar/anular producción revierte efectos.
Merma reduce stock una sola vez.
Editar merma recalcula delta correctamente.
Eliminar/anular merma restaura stock.
Cambiar merma a reutilización mueve cantidad a stock futuro sin pérdida.
Cambiar reutilización a merma elimina stock futuro y registra pérdida.
Cortesía/consumo reducen vendible sin contar como merma.
Stock final + movimientos concilia con stock inicial/producción.
Venta esperada no incluye stock válido para mañana.
Caja esperada solo incluye los movimientos/medios pertinentes.
Cambio de precio no altera historia.
Cambio de costo no altera lotes históricos.
Corrección después de cierre sigue el mecanismo autorizado.
Conversión entre kg y g en ambos sentidos.
Decimal monetario.
Concurrencia/duplicados según riesgo real.
Permisos de edición/anulación/cierre.
37. Casos límite
Stock cero.
Merma total de una producción.
Intento de merma mayor al disponible.
Producción editada por debajo de cantidad ya consumida.
Registro duplicado.
Venta cancelada.
Transferencia cancelada.
Corrección después de cierre.
Dos usuarios editando el mismo registro.
Cambio de unidad.
Cambio de producto en una merma ya vinculada.
Jornada que cruza medianoche.
Precio/promoción distinto durante el día.
Registro offline/reintento si la app soporta ese comportamiento.
38. Plan de implementación adaptativo
No sigas una lista rígida si el código real requiere otro orden. Como referencia, después de auditar define fases pequeñas, seguras y verificables:
1.  Mapa del sistema actual + contrato de identidad.
2.  Modelo de datos/reglas centralizadas mínimas necesarias.
3.  Corrección/anulación segura de producción y merma.
4.  Conciliación de inventario.
5.  Merma/destinos/reutilización.
6.  Venta esperada vs real.
7.  Caja y medios de pago.
8.  Cierre diario.
9.  Stock mínimo/recomendación.
10.  Dashboard/reportes.
11.  Pulido UX de toda la app.
12.  Pruebas de regresión y hardening.
Después de cada fase ejecuta build/lint/tests/migraciones de prueba y revisa regresiones. Evita un cambio masivo que haga difícil detectar qué rompió algo.
39. Revisión transversal de TODA la app
Después de resolver el núcleo Producción/Ventas/Mermas/Stock/Caja, vuelve a revisar todos los apartados existentes. Identifica mejoras pequeñas de alto valor en claridad, organización, responsive, nombres, formularios, tablas, filtros, buscadores, acciones rápidas, vacíos, mensajes de error y consistencia visual.
Pero recuerda: NO cambies por cambiar. Para cada mejora transversal aplica la pregunta: “¿Hace la app más clara, rápida, confiable o coherente sin perder identidad?” Si la respuesta es no, no la hagas.
40. Qué NO quiero
Rehacer la app desde cero.
Cambiar el branding o identidad porque sí.
Instalar muchas dependencias nuevas.
Crear un ERP gigantesco.
Duplicar módulos existentes.
Crear dashboards bonitos con cálculos inconsistentes.
Ocultar diferencias reales transformándolas en “merma automática”.
Hard-delete silencioso de operaciones financieras/inventario cerradas.
Lógica de stock repartida por múltiples componentes.
Magic numbers.
IA predictiva antes de datos fiables.
Formularios largos para tareas frecuentes.
Obligar a empleados a hacer cálculos.
Pedir al usuario información que puedes descubrir inspeccionando el repositorio.
41. Entregables del agente
Al finalizar, entrega un resumen técnico/funcional breve y accionable con:
Qué encontraste en la app.
Qué mantuviste y por qué.
Qué mejoraste.
Qué añadiste.
Qué decidiste no añadir/posponer y por qué.
Cambios de base de datos/migraciones.
Reglas de negocio centralizadas.
Cambios de UX.
Cómo funciona editar/eliminar producción y merma.
Cómo se recalcula el día.
Tests añadidos y resultados.
Riesgos/deuda técnica restante.
Sugerencias opcionales para una siguiente etapa.
42. Criterios de aceptación finales
Considera esta evolución correcta solo si un usuario puede completar el flujo siguiente de forma clara, rápida y sin cálculos manuales:
1.  Ver qué stock tiene al comenzar el día.
2.  Ver qué conviene producir.
3.  Registrar producción.
4.  Corregir una producción mal cargada.
5.  Eliminar/anular una producción duplicada.
6.  Registrar una merma desde el peso de la balanza.
7.  Editar una merma equivocada.
8.  Eliminar/anular una merma equivocada.
9.  Indicar si el producto se descarta, regala, consume, transfiere o queda para mañana.
10.  Ver cómo un sobrante válido pasa al siguiente día sin convertirse en pérdida.
11.  Ver stock disponible y mínimo.
12.  Registrar/consultar ventas.
13.  Ver venta esperada y venta real.
14.  Entender cualquier diferencia.
15.  Ver caja esperada y caja real.
16.  Cerrar el día.
17.  Corregir un error posterior mediante un mecanismo autorizado y trazable.
18.  Consultar históricamente qué ocurrió.
43. Regla maestra de autonomía
No me preguntes cosas que puedas descubrir leyendo código, base de datos, configuraciones, componentes o pruebas. Investiga. Toma decisiones senior basadas en evidencia del proyecto. Si dos soluciones son posibles, elige la que preserve mejor identidad, compatibilidad, simplicidad y consistencia de datos.
Si una mejora de este prompt contradice una solución existente que ya es mejor, conserva la solución existente y explica por qué. Este prompt define objetivos y principios, NO obliga a reemplazar una implementación superior que la app ya tenga.
44. Regla maestra de producto
LA APP DEBE PENSAR POR EL USUARIO
El usuario registra hechos simples: “produje 5 kg”, “se perdieron 180 g”, “estos 300 g quedan para mañana”, “regalé 100 g”, “vendí X”, “en caja tengo X”. El sistema se encarga de mantener stock, costos, valor comercial, venta esperada, pérdidas, reservas, caja, diferencias, auditoría y reportes.

El resultado final debe sentirse como una versión claramente superior de LA MISMA aplicación: más confiable, más intuitiva, más ordenada y más inteligente, pero reconocible para quien ya la utiliza.
FIN DEL PROMPT
Anexo A — Matriz de decisión recomendada para la auditoría de la IA
Área
Qué existe
Diagnóstico
Decisión
Impacto
Riesgo
Producción
...
...
Mantener / Mejorar / Añadir
Alto/Medio/Bajo
Alto/Medio/Bajo
Mermas
...
...
...
...
...
Ventas
...
...
...
...
...
Stock
...
...
...
...
...
Caja
...
...
...
...
...
UX/UI
...
...
...
...
...
Anexo B — Fórmulas conceptuales de referencia
Estas fórmulas son una guía para validar la lógica, no una orden de copiar literalmente. El agente debe adaptarlas a las entidades y reglas reales de la app.
Costo unitario = costo total de producción / cantidad producida normalizada.
Stock vendible disponible = stock inicial + producción liberada + entradas válidas.
Salidas no venta = merma real + cortesías + consumo interno + transferencias salientes + ajustes clasificados.
Cantidad vendida teórica = disponible − salidas no venta − stock final vendible/reservado.
Venta esperada = valor histórico correcto de la cantidad atribuible a venta.
Merma % = merma real / base de producción definida × 100.
Diferencia inventario = stock real − stock teórico.
Diferencia venta = venta real − venta esperada.
Diferencia caja = efectivo real − efectivo esperado.
Anexo C — Principio especial de correcciones
Toda edición relevante se interpreta como una modificación del hecho de origen, no como un parche numérico en el dashboard. Por lo tanto, el sistema debe propagar el delta a todas las proyecciones derivadas o recalcular el día desde una fuente de verdad. Esta regla evita que una merma muestre 150 g en su pantalla pero el dashboard siga descontando 250 g.
```
