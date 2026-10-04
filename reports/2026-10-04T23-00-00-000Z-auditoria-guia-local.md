# 0.47.0 · «Guía local» y auditoría (2026-10-04)

## Encargo del usuario
1. Las fotos del calendario: subirlas desde el propio Calendario y que la app las coloque en su día y apartado. Anotado en docs/PLAN_CALENDARIO.md (fase 3), siempre como propuesta que la persona confirma; sin fecha en la foto, se pregunta.
2. «IA local» pasa a «Guía local», para que la app no hable de IA.
3. Auditar la app y corregir errores.

## «Guía local»
- Menú, pantalla, botones («Analizar con Guía local», «Preguntar a la Guía local», «Leer con Guía local», «Segunda lectura con Guía local», «Revisar texto con Guía local»), avisos y mensajes de error del servidor (src/ai.cjs, src/ai-review.cjs).
- Fuera de pantalla también «modelo», «Qwen» e «Inteligencia integrada»: «Dos lecturas coinciden», «Incluida en el equipo», «lectura automática».
- Guía de uso (docs/GUIA_USO.md → src/ui/guide.js) y guía del chat (src/ai-help.cjs, que dice «antes IA local» para que el chat entienda a quien pregunte con el nombre viejo).
- Evidencia: volcado de las 14 pantallas sobre una copia de data/ (work/audit-fase6.cjs): ninguna aparición de «IA», «modelo», «Qwen», «GelatoStock», «Tu negocio, en orden» ni «Vitrina» como zona. Chat 35/35 (`node scripts/evaluate-ai.cjs --chat`, reports/ai-chat-v0470.json).
- Nombres internos (src/ai*.cjs, rutas /api/ai, carpeta runtime/models) no cambian: no se ven.
- Queda en el menú «Guía local» junto a «Guía» (la de instrucciones). Se le pregunta al usuario si quiere otro nombre para una de las dos.

## Auditoría
Tres revisiones en paralelo (cálculos de core/, servidor y copias, interfaz), solo lectura, cada fallo reproducido con un guion en work/audit-*.cjs. Después, cada arreglo con su prueba o con el mismo guion repetido.

### Arreglado
| # | Dónde | Fallo | Evidencia del arreglo |
|---|---|---|---|
| C1 | core/domain.ts reverse | «Revertir» deshacía una venta o merma de un día **cerrado** (esquivaba ensureDayOpen) y la salida de gelato de una producción (el valor y la Semana seguían contándola) | tests/audit-0470.test.cjs; la interfaz ya no ofrece «Revertir» en esas líneas (src/ui/core.js reversible). El consumo de un ingrediente sí se puede compensar, como antes (tests/domain.test.cjs:527 sin cambios) |
| C2 | core/domain.ts dailySales | Cerrar un día pasado pesando la cubeta restaba del stock de hoy: vendido 8,5 en vez de 6,5 y «queda para mañana» negativo | stockAtDayEnd en core/day.ts; prueba nueva |
| C3 | core/report.ts | La Semana sumaba kg, L y ud de merma y lo pintaba como «kg» | totals.waste solo kg + totals.wasteOther por unidad; la fila del día, solo kg; prueba nueva |
| C6 | core/balance.ts | Un dato de composición que falta contaba como 0 y la receta salía «completa» | lacking por valor → «sin datos»; prueba nueva |
| C7 | core/domain.ts needed | 2,1 kg en paquetes de 0,7 proponía 4 paquetes (coma flotante) | prueba nueva: 3 |
| C8 | core/messages.ts readPriceChange | Con porcentaje proponía el precio viejo; «1.250,00 €» se leía 250 € | prueba nueva |
| C9 | core/domain.ts editCloseLine | Cambiar el motivo de una merma de gelato borraba el detalle escrito | closeDetailOf; prueba nueva |
| S1 | src/server.cjs | cruceros.sqlite o contexto.sqlite dañado impedía abrir la app | el archivo se aparta (.danado-…, no se borra) y se abre uno nuevo; el registro se cierra antes de fallar. work/audit-srv-3.cjs: «arranca» |
| S2 | cruises/repository.cjs, context/service.cjs | La copia diaria de un registro vacío machacaba la única copia buena | no se sobrescribe con un registro sin filas. audit-srv-3: 1 escala antes y 1 después |
| S3 | src/server.cjs autoBackup | Una copia con fecha futura apagaba las copias automáticas | una fecha futura cuenta como «no hay copia» |
| S5 | src/server.cjs | Una clave con letras de varios bytes o una dirección rota tumbaban el servidor antes de comprobar la sesión | comparación por bytes y 400. work/audit-srv-2.cjs: «SIGUE VIVO» |
| S6 | src/server.cjs | Una ruta que fallaba dejaba la pantalla cargando para siempre | todo error responde 500 con su mensaje y queda en runtime/logs/servidor.log. work/audit-srv-1.cjs: sin rechazos sin atender |
| S7 | src/pdftext.cjs | Un PDF de miles de páginas congelaba la app (el límite de 50 no se aplicaba) | 5.000 páginas: 5.719 ms congelada → 130 ms (work/audit-srv-5.cjs); tests/pdftext 3/3 |
| — | src/desktop.cjs | La web del proveedor se comprobaba por comienzo de texto («https://prov.es.otro.com» pasaba) | mismo host y ruta |
| — | src/server.cjs, src/whatsapp.cjs | Avisos en voseo («Abrí…», «volvé…») en una app de Palma | «Abre…», «vuelve…» |

Interfaz:

| # | Dónde | Fallo | Evidencia del arreglo |
|---|---|---|---|
| U0 | src/ui/core.js mutate | Causa común: al entrar un WhatsApp sube la revisión y el siguiente guardado daba 409 «Los datos cambiaron» | si entre medias solo cambiaron mensajes, adjuntos o actividad, se repite sola con la revisión nueva; si cambió algo más, se guarda lo nuevo sin redibujar (no se pierde lo escrito) |
| U1 | src/ui/actions.js (objetivo, cerrar y reabrir día, valor de venta, anular y corregir producción, corregir y deshacer cierre) | El formulario se cerraba aunque el guardado fallara: la persona creía cerrado un día que no lo estaba | sigue abierto con el error. work/audit-ui-silent.cjs: «Objetivo guardado», 0 → 7 |
| U2 | cierre del día | Un 409 borraba todo lo tecleado | work/audit-ui-close.cjs: «Cierre del día registrado», 1 venta guardada |
| U3 | src/ui/views-messages.js | Con «Sin leer», abrir un mensaje mostraba otro (de otro proveedor) | work/audit-ui-unread.cjs: pide «Segundo», muestra «Segundo» |
| U4 | hoja de conteo | Una casilla vacía ponía el stock a 0 | pide la cantidad («si no queda nada, escribe 0»). audit-ui-forms: 1 → 1 |
| U5 | receta | «Ninguno: es una base…» no desvinculaba el gelato | acción recipe con noProduct. audit-ui-forms: id → undefined |
| U6 | autorizar pedidos | Bloqueado tras un cambio ajeno (revisión fija al abrir) | revisión al enviar y comprobación de que el carrito no cambió. audit-ui-checkout: «intento 1 … pedidos pendientes: 1 carrito: 0» |
| U8 | Compras, Documentos, Configuración | «Simulación» en pedidos pendientes reales, «Envío simulado» en pedidos enviados de verdad, «podrás simular el envío», «datos de demostración» al restaurar | textos según el estado real del pedido |
| U9 | src/ui/events.js | «Ver mensajes» del Resumen no aplicaba «Debes leer» | el filtro viaja con la navegación |
| U10 | carrito, pedido, autorizar | Una línea sin precio contaba como 0 € en el total | «No disponible (N sin precio)» |
| U11 | Resumen | «Entregas en los próximos dos días» incluía entregas vencidas | de hoy a dos días |

Comprobado limpio por el revisor de interfaz: texto sin escapar (0 en 15 pantallas y 39 formularios con marcas HTML en todos los textos), 129 botones con manejador, sin variables sin definir, 0 avisos de CSP, coma decimal correcta.

### Sin arreglar (apuntado en TODO.md)
- **Hora de Palma** (alta para este equipo): el día de negocio sale del reloj del equipo (UTC−3 aquí), no de Palma; lo de antes de las 10:00 de Palma en verano cuenta como el día anterior. Si la app corre en un ordenador de la tienda en Palma, no pasa. Cambio transversal (localDate en todo core): se pregunta al usuario dónde se usará antes de tocarlo.
- **Día cerrado y movimientos manuales de un gelato** (conteo, entrada, salida): siguen sin bloquearse; ya era una decisión pendiente del usuario en TODO.md.
- WhatsApp: si sendMessage no devuelve id, la confirmación podría tomar un mensaje antiguo con el mismo texto (plausible, no reproducido).
- Menores: respuestas externas leídas enteras antes de mirar el tamaño; /api/cruises/range acepta 2026-02-31.

## Pruebas
- npm test: 213/213 (7 nuevas en tests/audit-0470.test.cjs). Expectativa cambiada: tests/domain.test.cjs «resumen semanal» esperaba 0,75 de merma total sumando 0,5 kg y 0,25 L; ahora 0,5 kg y 0,25 L aparte, que es el arreglo C3.
- format:check y typecheck limpios. Chat 35/35 (reports/ai-chat-v0470.json).
- Escritorio con dist/ArtelloAPP-0.47.0-win32-x64/ArtelloAPP.exe: 21 PASS, salida 0 (reports/desktop-smoke-2026-10-04-v0470.txt); recorre «Guía local» con sus botones nuevos.
- Instalador ArtelloAPP-Instalador-0.47.0.exe (751 MB): TODO PASS (reports/instalador-2026-10-04-v0470.txt).
- Guiones de los revisores repetidos tras los arreglos: audit-srv-1 (sin rechazos sin atender), -2 (sigue vivo), -3 (arranca con cruceros dañado; copia 1 → 1), -5 (5.000 páginas en 130 ms); audit-ui-silent, -close, -unread, -forms y -checkout con el resultado correcto citado arriba.
