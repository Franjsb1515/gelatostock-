# Entrada para Claude · entrega vigente 0.28.0

Este archivo se carga entero en cada sesión: aquí van solo las reglas vigentes y el mapa. El detalle de cada versión está en docs/CONTINUIDAD.md (léelo solo para el módulo que vayas a tocar) y en reports/.

## Cómo trabajar aquí
- Proyecto en D:/CARPETAPROYECTOS/APPGELATOSTOCK. App local de escritorio (Electron) para una gelatería de Palma. Sin APIs de IA de pago ni llamadas externas ocultas.
- El usuario no programa y pide respuestas MUY breves en el chat; el detalle técnico va a reports/. Antes de un encargo grande, dile qué no es viable y por qué; luego decide y construye.
- Antes de cambiar archivos: `git status`. Ejecuta pruebas antes de proponer reescrituras. Implementa solo lo necesario para la tarea.
- Mejora continua: cada sesión audita lo que toca y corrige al menos un hueco verificado con evidencia. Ninguna afirmación sin salida de comando o captura. No degradar garantías ni ocultar abstenciones o pruebas fallidas. Si un documento de continuidad induce a error, corrígelo en la misma sesión.
- No inventar datos: cada dato es confirmado (lo dice la fuente), derivado (con fórmula visible) o «No disponible». Nunca se rellena con conocimiento propio.
- Nunca borres datos reales del usuario para probar (usa carpetas temporales en work/). Nunca cambies una prueba solo para que pase; explica cualquier cambio de expectativa.
- Herramienta: los heredoc y `node -e` pierden las barras invertidas de las expresiones regulares. Para código con `\d`, `\.` o `\p{…}` usa Write o Edit. Los parches de sesión, de una sola pasada y con guardia de «ya aplicado».

## Sesiones ligeras
- Un encargo grande del usuario se condensa una vez en `docs/PLAN_*.md` (decisiones, fases, preguntas abiertas) y el original se archiva en `docs/origen/`. Después se trabaja desde el plan: no releas el original.
- Una fase por sesión, una versión por fase y un solo cierre (paquete, prueba de escritorio, evaluación del chat, ZIP). Los cambios pequeños se agrupan en la versión de la fase.
- Lee solo lo que vayas a tocar: TODO.md, el plan vigente y la entrada del módulo en docs/CONTINUIDAD.md. No leas reports/ antiguos ni docs/origen/ salvo duda concreta.
- Si la conversación ya es muy larga al acabar una fase, recomienda al usuario abrir una sesión nueva: todo lo necesario está en estos documentos.
- Plan vigente: docs/PLAN_PRODUCCION_VENTAS_CAJA.md (hecha la fase 1; siguiente: fase 2).

## WhatsApp (seguridad)
Envío real desde 0.9.1 con vista previa, confirmación explícita en pantalla, solo a chats autorizados y una vez por pedido. Los números +34XXXXXXXXX y +549XXXXXXXXXX son del usuario y están autorizados para pruebas reales que él lance. Nunca enviar sin su confirmación en pantalla ni desde pruebas automáticas. No exportar data/whatsapp/sessions ni historial privado. No conectar el QR solo por revisar la app. GELATO_TEST_QR=1 solo con prueba explícita.

## Mapa
- `core/` TypeScript estricto, puro y probado; `build/` es su salida generada. schema.ts (zod), domain.ts (apply y acciones), store.ts (SQLite canónico, user_version 4), messages.ts (lectura de respuestas por reglas), documents.ts, balance.ts, report.ts, inventory.ts, orders.ts, sales.ts, cruises.ts, context.ts.
- `src/` servidor local (server.cjs, 127.0.0.1 con cookie, CSP y control de Origin), Electron (desktop.cjs, preload mínimo), IA (ai*.cjs), WhatsApp (whatsapp.cjs), cruceros (cruises/), clima y festivos (context/), interfaz en `src/ui/*.js` (scripts clásicos que comparten ámbito global; un archivo nuevo se registra en index.html y en la lista de recursos de server.cjs). La CSP prohíbe estilos en línea: usa clases; para geometría, SVG.
- Datos en `data/`: gelatostock.sqlite y attachments son canónicos; las carpetas por proveedor son copias derivadas. cruceros.sqlite y contexto.sqlite son registros propios con copia diaria en backups/.
- `docs/GUIA_USO.md` genera la pantalla Guía (scripts/build-guide.cjs). `src/ai-help.cjs` es la guía del chat: si cambia, repite `node scripts/evaluate-ai.cjs --chat`.

## Garantías por módulo (no degradar)
- Stock: cantidades en unidad base, recepciones solo incrementales, presentaciones del pedido como instantánea. No mezclar kg, L y ud. Un movimiento compensado no cuenta en ningún informe.
- IA local (Qwen3 0.6B Q4, elegido tras comparar variantes): solo propone etiquetas revisables; reglas primero; no ejecuta acciones; la evidencia que genera se descarta y se muestra el original. Doble lectura del mismo modelo, sin independencia estadística. Cambiar prompts exige repetir la evaluación de 11 casos (línea base 10/11, conserva pass:false). Las reglas leen las respuestas de proveedores mejor que los modelos (80/80 frente a 55/80): no sustituir sin cifras. Pesos fuera de las fuentes; scripts/package.cjs copia solo el modelo del manifiesto.
- Mensajes: el aprendizaje por correcciones cambia la lectura, nunca la decisión. Una respuesta vinculada solo fija fecha prevista y confirmación del pedido; cantidades y stock no cambian solos.
- Cierre del día: el día de negocio y el motivo viajan en el texto del movimiento («Venta del día AAAA-MM-DD», «Merma del día AAAA-MM-DD · Motivo»). Lo leen core/sales.ts, report.ts y context.ts: no cambies el formato sin migrarlos.
- Cruceros, clima y festivos: única salida a internet además de WhatsApp; solo lectura, cuerpo fijo, respuesta no fiable y validada; un interruptor (cruises_off) y GELATO_CRUISES_AUTO=0; nunca automáticas bajo node:test; pruebas con `createApp({ cruiseProvider, contextProviders })`. «Hoy» y las horas son de Palma (este equipo está en UTC−3). Pasajeros declarados no es capacidad ni clientes. El impacto es una fórmula visible con umbrales del usuario. El clima de un día pasado es «previsión guardada». Citar siempre las fuentes (APB, MET Norway, Govern balear).

## Pruebas y cierre de sesión
- `npm test` · `npm run format:check` · `npm run typecheck` · `npm run package:win` · `npm run test:desktop` (usa el modelo real; tarda varios minutos; si falla en `page.screenshot: Timeout`, la pantalla del equipo está suspendida: repite con el equipo activo).
- Cierre: informe nuevo en reports/ + CHANGELOG + TODO + entrada en docs/CONTINUIDAD.md + pruebas reales + ejecutable reconstruido si cambió src/ + commit + ZIP (work/make-zip.cjs) sin datos, credenciales, node_modules ni binarios. Conserva los informes anteriores. No marques nada como probado en Mac desde Windows.
- Pendiente y prioridades: TODO.md. Siguiente acordado: fase 2 del plan vigente; después, Compras y Mensajes II.
