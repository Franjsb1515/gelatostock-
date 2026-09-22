# TODO — estado real de 0.42.1

Solo lo pendiente, ordenado por área. Lo ya hecho está en CHANGELOG.md (una entrada por versión) y, resumido, al final. La especificación de origen sigue en docs/TODO.md; no es estado.

Marcas: **[tú]** necesita algo del usuario · **[app]** se puede hacer sin él · **[decidir]** hay que acordarlo antes.

## 1. Siguiente, en este orden

- [x] [app] Producción, ventas, mermas y caja: plan por fases en docs/PLAN_PRODUCCION_VENTAS_CAJA.md. Hechas las seis fases (0.28.0 a 0.33.0).
- [x] Prueba de escritorio al día: 21 PASS con el ejecutable 0.42.1 el 2026-09-22 (salida en reports/desktop-smoke-2026-09-22-v0421.txt); antes, 21 PASS con la 0.42.0 lanzada por ti el 2026-09-21. Cubre dentro del ejecutable el «Vale desde» del valor de venta y el botón de escribir al proveedor desde Mensajes.
- [ ] [tú] Usar unos días la 0.42.1 con tus gelatos y decir qué no se entiende o estorba: esas correcciones van antes que nada.
- [ ] [tú] Aplazado por ti el 2026-09-20: los pedidos siguen naciendo como «simulación» y queda el botón «Simular envío» porque los usas para probar. Recuérdalo cuando quieras quitarlos (fase diferida del plan).
- [x] [app] Formularios de Inventario: ya no dicen «unidad base», sino la unidad de cada producto («Cantidad que hay ahora en kilos»), en 0.34.0.
- [x] [tú] Preguntas del plan respondidas el 2026-09-18 (sin caja; formatos y precios los pone él; el día cambia de madrugada; una sola categoría de invitación o consumo). Queda opcional decir si hay TPV.
- [x] Mermas de ingredientes con los mismos motivos que el cierre del día (0.39.0, pedido por ti el 2026-09-21). La Semana trae «Mermas por motivo» con las dos juntas.
- [x] Objetivo de merma con aviso (0.40.0): por producto, en su unidad o en porcentaje, mirando los últimos 7 días (decidido por ti el 2026-09-21). Solo avisa.
- [ ] [app] Compras y Mensajes II: plan por fases en docs/PLAN_COMPRAS_MENSAJES_II.md. Hechas la 1 (0.34.0, otro proveedor del mismo producto), la 2 (0.35.0, reclamar respuesta y textos editables), la 3 (0.36.0, texto de los PDF) y la 5 (0.37.0, catálogo y precios por proveedor). Queda solo la 4, listas de precios en foto, parada hasta que mandes tus tarifas reales.
- [ ] [tú] Prueba real del ciclo completo con tus dos números: envío por lotes, respuesta directa desde el mensaje, respuesta rápida y confirmación automática del pedido. Todo eso solo está probado con cliente simulado.

## 2. Depende de ti

- [ ] Confirmar productos, proveedores, recetas, unidades y sistema de ventas reales.
- [ ] Fichas de composición reales de tus ingredientes (el balance técnico usa las de demostración).
- [ ] Mac: ejecutar docs/MAC.md en tu equipo y enviar la salida de scripts/measure-ai-memory.cjs. De ahí salen: ajustar descarga e hilos de la IA, adaptar la prueba de escritorio, nombre e icono del bundle y firma.
- [ ] Entre cinco y diez tarifas reales para medir la fase 4 (fotos como las que haces y algún PDF; puedes tapar el nombre del proveedor, pero los precios y formatos han de ser los de verdad).
- [ ] Documentos y mensajes reales autorizados (anonimizados) para medir OCR, clasificación, lectura de respuestas y chat. Hoy todos los corpus son sintéticos y escritos por la misma sesión que las reglas.
- [ ] Paleta exacta de Artello si la facilitan (hoy es una interpretación propia).
- [ ] Makro u otro proveedor web: aplazado por ti el 2026-09-09, sin cuenta todavía. No avanzar hasta que lo pidas; la web se puede guardar en la ficha del proveedor.

## 3. Compras, mensajes y WhatsApp

- [x] Plantillas de respuesta editables: Configuración → Respuestas rápidas (0.35.0).
- [x] Precios: un mensaje con un precio claro y un documento archivado permiten apuntar el precio citando de dónde sale (0.37.0). Falta leer las líneas de una lista de precios: es la fase 4.
- [x] Aviso de mensajes nuevos (0.38.0). Corrección de esta lista: las reglas ya leían el mensaje **al importarlo**, no al abrir la bandeja; lo que faltaba era enterarse con la app abierta. Ahora un mensaje nuevo avisa en la pantalla (abajo a la derecha, con lo que dice) y en Windows con la misma lectura, sin redibujar lo que estés haciendo.
- [ ] Notificaciones para entregas previstas (las de mensajes nuevos ya están, y se silencian en Configuración → Aviso de mensajes nuevos).
- [x] Escribir tú al proveedor desde Mensajes y ver ahí la conversación con los dos lados (0.42.0, pedido por ti el 2026-09-21).
- [ ] Recuperar adjuntos del historial y mensajes más antiguos que los que carga WhatsApp Web.
- [ ] Memoria de equivalencias por proveedor (código de albarán → producto), consultada al leer documentos. Fase 4 del plan.
- [ ] Los precios se apuntan desde un documento escribiendo el importe a mano: leer las líneas de la tarifa es la fase 4.
- [ ] Abrir la carpeta del proveedor desde la app (hoy se muestra la ruta).

## 4. Documentos e IA local

- [x] Leer el texto de los PDF (0.36.0). Queda extraer cantidades y fecha con revisión: va en la fase 4 del plan.
- [ ] Reducir abstenciones legítimas (la proforma de prueba discrepa entre lecturas); no tocar prompts sin repetir la evaluación de 11 casos.
- [ ] Chat con contexto de inventario y pedidos: solo tras definir qué datos se exponen y con pruebas de fuga.
- [ ] Sandbox real del trabajador de IA: hoy se desactivan módulos de red de Node, no el proceso nativo.

## 5. Producción, ventas y planificación

- [ ] Lotes y vencimientos; rendimientos por receta.
- [ ] Día cerrado: los movimientos manuales de Inventario (conteo, entrada, salida) sobre un gelato no se bloquean; si caen en un día cerrado, el resumen avisa de que algo cambió. Decidir si deben bloquearse.
- [ ] [decidir] Merma de un gelato apuntada desde Inventario → Entrada / salida (auditoría 0.42.1): la Semana y el objetivo de merma la cuentan como merma, pero el resumen del día la enseña como «ajuste de inventario» y el historial de 30 días y los informes de venta y coste no la cuentan. Opciones: que la merma del gelato se apunte solo en el cierre (y el formulario de Inventario lo diga), o contarla como merma en todas partes. Evidencia en reports/audit-2026-09-22-v0421-sonda-dia.txt.
- [ ] Coste: usa el precio actual de la ficha al aprobar, no el de cada compra recibida (sin lotes no se sabe qué compra se gastó). Las producciones anteriores a 0.30.0 no tienen coste guardado y se valoran con el coste actual de la receta.
- [x] Valor de venta con fecha de inicio elegible (0.41.0): «Vale desde» en el Recetario, hacia atrás o hacia delante.
- [ ] Precio de compra fechado hacia atrás: no es lo mismo que el valor de venta y por eso no se hizo con él. El coste de cada producción es una instantánea al aprobarla, así que cambiar la fecha de un precio no cambiaría ningún número pasado: solo movería el historial y los avisos de subida de 30 días. Decidir si merece la pena.
- [ ] Con meses de ventas registradas: ventas frente a clima y festivos además del impacto de cruceros, siempre como hechos y sin predicción hasta poder validarla.
- [ ] Observaciones meteorológicas reales si aparece una fuente abierta (AEMET exige una clave propia del usuario).

## 6. Antes de usarla como sistema real

- [ ] Firmar la distribución de Windows y crear instalador y actualizaciones seguras.
- [ ] Empaquetar, firmar y probar en el Mac real.
- [ ] Prueba de disco lleno y validación del corte de corriente en el equipo real.
- [ ] Autenticación y permisos por persona si la usan varias (hoy: una contraseña opcional para el recetario).
- [ ] Revisión de arquitectura completa de core/, servidor y WhatsApp con ojos nuevos.
- [ ] Adaptar la app entera a ventanas estrechas (la barra lateral no se pliega).
- [ ] Sincronización entre lugares con resolución de conflictos y un único envío por pedido.

## Límites conocidos

Una instancia de escritorio por perfil. SQLite detecta conflictos entre conexiones; no hay sincronización distribuida. Exportación JSON en memoria hasta 100 MB; fotos hasta 5 MB. El estado se envía recortado a la interfaz (300 movimientos y actividades, el resto bajo demanda), pero no se ha probado gran volumen. Sin pagos. WhatsApp Web es experimental y requiere internet; cruceros, clima y festivos también, y se apagan con un interruptor. Las lecturas por reglas y por modelo pueden equivocarse: son revisables y nunca ejecutan compras ni cambian stock. Las fotos no cambian stock.

## Hecho, en una línea por bloque

Detalle y pruebas de cada uno en CHANGELOG.md y en reports/.

- 0.1–0.7: inventario, carrito, pedidos por proveedor, recepción parcial, bandeja de mensajes, fotos por proveedor con OCR, WhatsApp por QR, control de entregas, IA local Qwen3 0.6B.
- 0.8–0.9: doble lectura con abstención, chat de dudas, SQLite con migración, recetas y producción, lectura de respuestas por reglas, envío real por WhatsApp con confirmación, diagnóstico del canal.
- 0.10–0.14: ventas y mermas, avisos, historial, CSV, recetario protegido, limpieza periódica, aprendizaje por correcciones, identidad visual, documentos por proveedor, sistema de diseño.
- 0.15–0.19: conversación por proveedor, decisiones, guía en la app, botones más y menos, compra en webs, IA con reglas primero, recetario completo, auditoría general y sus correcciones, copia secundaria, historial paginado, respuesta directa y envío por lotes, arte y gelato en el chat.
- 0.20–0.23: balance técnico, resumen semanal, historial de precios, conteo por zonas, carpetas del sistema, preparación para Mac, Compras y Mensajes I.
- 0.24–0.27: cruceros en Palma con datos oficiales e histórico desde 2014, impacto potencial auditable, clima, festivos y eventos, ventas por nivel de impacto, restauración del registro, cierre del día con motivos de merma.
