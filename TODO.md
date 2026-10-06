# TODO — estado real de 0.57.0

Solo lo pendiente, ordenado por área. Lo ya hecho está en CHANGELOG.md (una entrada por versión) y, resumido, al final. La especificación de origen sigue en docs/TODO.md; no es estado.

Marcas: **[tú]** necesita algo del usuario · **[app]** se puede hacer sin él · **[decidir]** hay que acordarlo antes.

## 1. Siguiente, en este orden

- [x] [app] Producción, ventas, mermas y caja: plan por fases en docs/PLAN_PRODUCCION_VENTAS_CAJA.md. Hechas las seis fases (0.28.0 a 0.33.0).
- [x] Prueba de escritorio al día: 21 PASS con el ejecutable 0.45.0 el 2026-09-22 (reports/desktop-smoke-2026-09-22-v0450.txt) y prueba del instalador 16 PASS (reports/instalador-2026-09-22-v0450.txt); antes, lo mismo con la 0.44.0; antes, 21 PASS con la 0.43.0 y la 0.42.1 el mismo día; antes, 21 PASS con la 0.42.0 lanzada por ti el 2026-09-21. Cubre dentro del ejecutable el «Vale desde» del valor de venta y el botón de escribir al proveedor desde Mensajes.
- [x] «Guía local» en lugar de «IA local» y auditoría con 26 arreglos (0.47.0, pedido por ti el 2026-10-04).
- [x] Marca Artello (0.46.0, pedido por ti el 2026-10-04): la app se llama ArtelloAPP, la ventana «Artello Gelato Control System», tu logo en la barra lateral, un sello pequeño en lugar del recuadro verde del cucurucho, icono nuevo y la zona «Vitrina» pasa a «Pozzetti». Por dentro la carpeta de datos sigue llamándose GelatoStock para no perder nada.
- [ ] [tú] Cambiar el nombre del negocio a «Artello Gelato» en Configuración → Identidad del negocio (es un dato tuyo; no se tocó con la app abierta). Si prefieres otra grafía que «Pozzetti», dímelo.
- [x] [app] Calendario, fase 1 (0.48.0): año → mes → día con la ficha de cada día, y «La tienda no abrió» (adelantado de la fase 2 a petición tuya).
- [ ] [decidir] Aplazado por ti el 2026-10-04 (también la clave del Calendario). Datos con clave (pedido por ti el 2026-10-04: «que no puedan abrir los datos sin la clave»). Dos caminos: (a) la app cifra con tu clave la base, las fotos y las copias; si olvidas la clave y no tienes el código de recuperación, se pierden todos los datos; las carpetas por proveedor dejarían de existir en claro; sesión propia con pruebas de corte de corriente. (b) Contraseña de Windows y cifrado del dispositivo en el ordenador de la tienda: protege todo el equipo y lo activas tú. Falta que elijas.
- [x] [app] Calendario, fase 2 (0.49.0): horario de la semana (apertura y turnos, copiar la anterior), vacaciones por persona, stock al terminar el día y avisos del día y del mes.
- [x] [app] Calendario, fase 3 (0.50.0): «Subir foto» propone día y apartado (horario, ventas, documento o nota) y la persona confirma. Medido con 12 fotos sintéticas: 8 exactas, 0 inventos.
- [x] [app] Ficha de producción del día (0.52.0): pesada de la mañana, vendido estimado por sabor, dos facturaciones, resúmenes de día, semana e histórico, alta rápida de sabores.
- [x] [app] Mínimos por sabor con «Hoy no se hace» y «En pausa» (0.53.0).
- [ ] [tú] Poner los mínimos de tus sabores (ficha de producción → «Mínimos por sabor»).
- [ ] [tú] Dar de alta tus sabores (Calendario → Producción del día → «Dar de alta sabores»), el primer día «Igualar el stock de la app a la pesada», y poner el valor por kilo de cada sabor en el Recetario.
- [ ] [app] La prueba de escritorio no recorre la ficha de producción (lo cubre work/check-ficha-produccion.cjs).
- [ ] [tú] Manda 3–5 fotos reales (una escrita a mano) para medir la lectura de verdad. Dime también si el umbral del 10 % de la venta real te vale.
- [x] El Ayudante explica horario, vacaciones y fotos (0.50.0, chat 39/39).
- [ ] [app] La prueba de escritorio no recorre todavía el horario de la semana ni la subida de fotos (lo cubren work/check-calendario-fase2.cjs y work/check-calendario-fotos.cjs).
- [ ] [tú] Usar unos días la 0.46.0 con tus gelatos y decir qué no se entiende o estorba: esas correcciones van antes que nada.
- [x] [app] Cuadrante de turnos en foto (0.54.0): lectura por casillas con revisión; tu cuadrante 55/56, ninguna mal dada por segura.
- [ ] [tú] Más cuadrantes reales (otro mes, otra persona) para medir; mejor captura con zoom.
- [ ] [app] Guardar también la foto del cuadrante en su primer día; tipos de turno con horas por defecto (Apertura = 10:00–17:00) si los quieres.
- [x] [app] Producción rápida por sabor con tandas, bases y «Hecho» en un paso; Recetario en botones con contraseña (0.55.0).
- [ ] [tú] Poner la contraseña del Recetario, crear la Base blanca (familia Base) y usarla en tus sabores; corregir «cocadado» (500 L → 500 ml).
- [x] [app] La prueba de escritorio recorre la producción rápida y «Preparar» (0.56.0).
- [x] [app] «Preparar» paso a paso, − / + de 500 g y «Orden de preparación» por receta (0.56.0, pedido por ti el 2026-10-05).
- [x] [app] Tabla de ingredientes con la composición (0.57.0) y precios por proveedor en Compras (0.57.0), pedidos por ti el 2026-10-05 con tus dos PDF.
- [ ] [tú] Subir tus dos PDF en la app: Inventario → «Tabla de ingredientes» → «Subir tabla», y Compras → «Precios por proveedor». No se han cargado en tus datos reales: lo confirmas tú en pantalla.
- [ ] [tú] Decidir: (1) qué fila de rangos de tu tabla vale para cada familia (gelato, gelato de fruta, sorbete de fruta, sorbete de cremas, base) para usarlos en el balance en lugar de los de la app; (2) si los precios de tu lista son todos por kilo o litro; (3) qué nombres parecidos de la lista son el mismo ingrediente y cuáles son tus ingredientes estrella (se marcan en pantalla).
- [ ] [app] Que la comparación de precios llegue al carrito y a «Sugerir reposición»; proponer «posibles iguales» para que los confirmes; recordar a qué producto corresponde cada nombre de la lista.
- [ ] [app] La prueba de escritorio no recorre la tabla de ingredientes ni los precios por proveedor (los cubren work/check-tabla-ingredientes.cjs y work/check-pricelist-ui.cjs).
- [ ] [tú] Poner el orden de preparación de tus recetas (Recetario → la receta → «Orden de preparación»).
- [ ] [app] Lista de mejoras de textos, visual y tablets: docs/CHECKLIST_MEJORAS.md. Siguiente paso propuesto: interfaz táctil y estrecha (botones de 44 px, barra lateral plegable, Compras e Inventario a 768 px).
- [ ] [tú] Tablets: decir qué tablet (Windows o iPad/Android), si acompaña al ordenador, y si hay wifi separada de la de clientes (preguntas al final de docs/CHECKLIST_MEJORAS.md).
- [ ] [tú] Antes de entregar la app: quitar «Envío simulado» y los mensajes y pedidos de demostración (siguen por tu decisión del 2026-09-20).
- [ ] [tú] Aplazado por ti el 2026-09-20: los pedidos siguen naciendo como «simulación» y queda el botón «Simular envío» porque los usas para probar. Recuérdalo cuando quieras quitarlos (fase diferida del plan).
- [x] [app] Formularios de Inventario: ya no dicen «unidad base», sino la unidad de cada producto («Cantidad que hay ahora en kilos»), en 0.34.0.
- [x] [tú] Preguntas del plan respondidas el 2026-09-18 (sin caja; formatos y precios los pone él; el día cambia de madrugada; una sola categoría de invitación o consumo). Queda opcional decir si hay TPV.
- [x] Mermas de ingredientes con los mismos motivos que el cierre del día (0.39.0, pedido por ti el 2026-09-21). La Semana trae «Mermas por motivo» con las dos juntas.
- [x] Objetivo de merma con aviso (0.40.0): por producto, en su unidad o en porcentaje, mirando los últimos 7 días (decidido por ti el 2026-09-21). Solo avisa.
- [ ] [app] Compras y Mensajes II: plan por fases en docs/PLAN_COMPRAS_MENSAJES_II.md. Hechas la 1 (0.34.0, otro proveedor del mismo producto), la 2 (0.35.0, reclamar respuesta y textos editables), la 3 (0.36.0, texto de los PDF) y la 5 (0.37.0, catálogo y precios por proveedor). Queda solo la 4, listas de precios en foto, parada hasta que mandes tus tarifas reales.
- [ ] [tú] Prueba real del ciclo completo con tus dos números: envío por lotes, respuesta directa desde el mensaje, respuesta rápida y confirmación automática del pedido. Todo eso solo está probado con cliente simulado.
- [x] Hora de Palma: decidido por ti el 2026-10-04: la app se usará cada día en un ordenador de la tienda en Palma, con su hora; no se cambia. (Si algún día se usa a diario en un equipo de otra zona, revisar reports/2026-10-04T23-00-00-000Z-auditoria-guia-local.md.)
- [x] «Ayudante» en lugar de «Guía local» (0.48.0, decidido por ti el 2026-10-04); «Guía» sigue siendo el manual.
- [ ] [app] Pendiente menor de la auditoría 0.47.0: confirmación de WhatsApp cuando no devuelve id (puede tomar un mensaje antiguo con el mismo texto; plausible), respuestas externas leídas enteras antes de mirar el tamaño. (Hecho en 0.48.0: los cruceros ya rechazan 2026-02-31.)

## 2. Depende de ti

- [ ] Confirmar productos, proveedores, recetas, unidades y sistema de ventas reales.
- [ ] Fichas de composición reales de tus ingredientes (el balance técnico usa las de demostración).
- [x] Mac: el `.dmg` lo construye GitHub Actions (repositorio público https://github.com/Franjsb1515/gelatostock-, etiqueta v*). Conseguido el 2026-09-22 al cuarto intento: 205 pruebas en macOS, la app arranca en Apple Silicon e Intel y los dos `.dmg` están en https://github.com/Franjsb1515/gelatostock-/releases/tag/v0.45.0. Registros en reports/mac-2026-09-22-v0450-<arch>/.
- [ ] [tú] Mac real: que la persona instale el `.dmg` (Privacidad y seguridad → «Abrir de todos modos»), lo use y diga qué falla; WhatsApp en Mac no se ha probado; enviar la salida de scripts/measure-ai-memory.cjs si el Mac tiene 8 GB. Después, la salida de scripts/measure-ai-memory.cjs, adaptar la prueba de escritorio y firma/notarización.
- [ ] Entre cinco y diez tarifas reales para medir la fase 4 (fotos como las que haces y algún PDF; puedes tapar el nombre del proveedor, pero los precios y formatos han de ser los de verdad).
- [ ] Documentos y mensajes reales autorizados (anonimizados) para medir OCR, clasificación, lectura de respuestas y chat. Hoy todos los corpus son sintéticos y escritos por la misma sesión que las reglas.
- [ ] Paleta exacta de Artello si la facilitan (hoy es una interpretación propia). El logo ya está (0.46.0, sacado de tu .ai en negro): corazón y logotipo en la barra lateral, el sello del Resumen, el arranque y el icono.
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
- [x] Día cerrado y movimientos manuales de un gelato: decidido por ti el 2026-10-04: NO se bloquean (los hace el administrador a propósito); el resumen sigue avisando si el día deja de cuadrar.
- [x] Merma de un gelato a cualquier hora (0.43.0, decidido por ti el 2026-09-22: cambia el personal a mitad del día): desde Inventario cuenta como merma del cierre de ese día en todas partes, y con el día confirmado se rechaza. Lo que se guarda para mañana no es merma.
- [ ] Coste: usa el precio actual de la ficha al aprobar, no el de cada compra recibida (sin lotes no se sabe qué compra se gastó). Las producciones anteriores a 0.30.0 no tienen coste guardado y se valoran con el coste actual de la receta.
- [x] Valor de venta con fecha de inicio elegible (0.41.0): «Vale desde» en el Recetario, hacia atrás o hacia delante.
- [ ] Precio de compra fechado hacia atrás: no es lo mismo que el valor de venta y por eso no se hizo con él. El coste de cada producción es una instantánea al aprobarla, así que cambiar la fecha de un precio no cambiaría ningún número pasado: solo movería el historial y los avisos de subida de 30 días. Decidir si merece la pena.
- [ ] Con meses de ventas registradas: ventas frente a clima y festivos además del impacto de cruceros, siempre como hechos y sin predicción hasta poder validarla.
- [ ] Observaciones meteorológicas reales si aparece una fuente abierta (AEMET exige una clave propia del usuario).

## 6. Antes de usarla como sistema real

- [x] Instalador de Windows (0.44.0, pedido por ti el 2026-09-22 para enviársela a alguien): `npm run installer:win`, docs/INSTALADOR.md. Sin firma.
- [ ] Firmar la distribución de Windows (certificado de pago; hasta entonces SmartScreen avisa) y actualizaciones seguras. Icono del propio ejecutable (hoy el genérico de Electron; el instalador y la ventana ya llevan el de la marca).
- [ ] Firmar y notarizar en Mac (cuenta de desarrollador de Apple); hasta entonces, «Abrir de todos modos» en Privacidad y seguridad.
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
